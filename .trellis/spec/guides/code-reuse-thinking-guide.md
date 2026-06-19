# Code Reuse Thinking Guide

> **Purpose**: Identify patterns and reduce duplication before they become tech debt.

---

## Why Think About Code Reuse?

**Duplicated code is a "didn't think of that" problem**:

- Didn't think that this pattern exists elsewhere -> wrote it again
- Didn't think about the shared abstraction -> copy-pasted with small changes
- Didn't think about type definitions -> defined the same types in multiple places
- Didn't think about future changes -> now need to update 5 files instead of 1

---

## Pre-Modification Checklist (CRITICAL)

> **Before modifying ANY value, ALWAYS search first!**

```bash
# Search for the value you're about to change
rg "the_value_to_change" --type ts --type tsx
rg "schemaName|configName" --type ts
```

**Checklist**:

- [ ] How many files define this value?
- [ ] If 2+ places -> Extract to shared constant FIRST, then modify
- [ ] After modification, are ALL usages updated?

**Why This Matters**: Changing a label in one component but missing another leads to inconsistent UI/behavior. This is one of the most common "didn't think of that" bugs.

---

## Pre-Coding Checklist

Before writing new code, ask yourself:

### 1. Does This Pattern Already Exist? (CRITICAL)

> **This is the #1 cause of duplicate code. Search BEFORE you write, not after.**

- [ ] Search for similar function names in the codebase
- [ ] Check if there's a utility in shared locations
- [ ] Look for existing hooks for similar functionality

```bash
# MUST DO before creating any new utility function
rg "functionName|similarKeyword" src/ --type ts

# Example: Before creating isDirectory helper
rg "isDirectory|checkDirectory" src/ --type ts

# Example: Before creating tree traversal
rg "traverse|Recursive|walkTree" src/ --type ts
```

**If you find existing code**: Reuse it, extend it, or extract to shared location. Do NOT create a duplicate.

### 2. Am I Defining Types That Exist?

- [ ] Check shared types location for existing types
- [ ] Look for similar interfaces/types in the codebase
- [ ] Renderer should import from shared, not redefine

```typescript
// BAD: Redefining types
interface User {
  id: string;
  name: string;
}

// GOOD: Import from source of truth
import type { User } from '@shared/types';
```

### 3. Is This a Repeated Pattern?

Count how many times you see similar code:

| Count | Action                                |
| ----- | ------------------------------------- |
| 1     | Just write it                         |
| 2     | Consider extracting, but okay to wait |
| 3+    | **Must extract** to shared utility    |

### 4. Where Should Shared Code Live?

| Code Type          | Location                         |
| ------------------ | -------------------------------- |
| General utilities  | `shared/lib/` or `shared/utils/` |
| React hooks        | `renderer/hooks/`                |
| UI components      | `renderer/components/`           |
| Shared types       | `shared/types/`                  |
| Constants          | `shared/constants/`              |
| Main process utils | `main/lib/`                      |

---

## Common Reuse Patterns

### Pattern 1: Shared Types in `src/shared/types.ts`

This project uses hand-written interfaces (no Zod / runtime schema). Define a cross-layer type once
and import it from both layers:

```typescript
// src/shared/types.ts — single source of truth
export interface ClaudeSettings { /* ... */ }
export interface IpcResponse<T = unknown> { success: boolean; data?: T; error?: string; }

// renderer (alias)            // main (relative path — no @shared alias outside the renderer)
import type { ClaudeSettings } from '@shared/types';
import type { ClaudeSettings } from '../../../shared/types';
```

### Pattern 2: Shared Response Formatting

```typescript
// shared/lib/response.ts
export function successResponse<T>(data: T) {
  return { success: true as const, data };
}

export function errorResponse(message: string, code?: string) {
  return { success: false as const, error: { message, code } };
}
```

### Pattern 3: Reuse Existing Renderer Helpers (`src/renderer/lib/`)

```typescript
// Reuse the shared helpers instead of re-deriving inline
import { cn } from '@/lib/utils';            // clsx + tailwind-merge for class names
import { parseMcpCommand } from '@/lib/parseMcpCommand';
```

### Pattern 4: Permission Checks

```typescript
// shared/lib/permissions.ts
export function canUserEdit(user: User, resource: Resource): boolean {
  return resource.ownerId === user.id || user.role === 'admin';
}

// Reuse across codebase
import { canUserEdit } from '@shared/lib/permissions';
```

### Pattern 5: Data Hooks (useState + callElectron)

This project has no TanStack Query — data hooks follow one shape (see
[`../frontend/state-management.md`](../frontend/state-management.md)):

```typescript
// renderer/hooks/useResource.ts
export function useResource(configDir: string | null) {
  const [data, setData] = useState<Resource[]>([]);
  const load = useCallback(async () => {
    if (!configDir) return;
    setData(await callElectron(() => electronAPI().config.getResource(configDir)));
  }, [configDir]);
  useEffect(() => { void load(); }, [load]);
  return { data, reload: load };
}
```

---

## Red Flags: Signs of Missing Reuse

Watch for these warning signs:

| Red Flag                 | What It Means               |
| ------------------------ | --------------------------- |
| Copy-pasting a function  | Pattern should be extracted |
| Same schema in 2 files   | Consolidate to shared types |
| Similar error handling   | Create shared error handler |
| Repeated date formatting | Use date-utils              |
| Same permission logic    | Extract to lib/permissions  |
| Similar fetch patterns   | Create shared hook          |

---

## Refactoring Decision Guide

When you notice duplication:

```
Is it duplicated 3+ times?
|-- Yes -> Extract immediately
+-- No -> Is it likely to be needed again soon?
    |-- Yes -> Extract now
    +-- No -> Leave it, but add a TODO comment
```

---

## Lessons Learned

### Case 1: Date Formatting Bug

**Problem**: Multiple files called `.toISOString()` on session timestamps read from JSONL, which are strings, not Date objects.

**Solution**: Created shared `date-utils.ts` with `formatDate()` that handles all formats.

**Rule**: Never assume date types; always use the utility.

### Case 2: Permission Logic Scattered

**Problem**: Permission logic was scattered across multiple files.

**Solution**: Extracted to shared `permissions.ts`.

**Rule**: If logic is reused in 2+ places, create a shared module.

### Case 3: Inconsistent Response Format

**Problem**: Some handlers returned `{ error: "message" }`, others returned `{ error: { message, code } }`.

**Solution**: Created shared response utilities.

**Rule**: All responses should use the same format. Define once, use everywhere.

### Case 4: Created Duplicate Utility Function

**Problem**: Created `isDirectory()` in new file, but another file already had an identical implementation.

**Root Cause**:

- Only searched after completing the work
- Should have searched **before** creating the new function

**What Should Have Happened**:

```bash
# BEFORE creating the function
rg "isDirectory" src/ --type ts
# Would have found existing implementation
```

**Rule**: Before creating ANY new utility function, search for similar implementations first. The search should happen at the START of implementation, not at the end during review.

### Case 5: Batch Modifications Without Pattern Check

**Problem**: After optimizing similar code in multiple files, didn't immediately check if all similar patterns were addressed.

**What Was Missed**:

- Created optimized pattern but didn't search for other instances
- Created similar logic in multiple places without checking for deduplication

**Rule**: After batch modifications:

1. Search for similar patterns: `rg "pattern" src/`
2. Check if new shared code replaces old implementations
3. Document which implementations stay separate and why

---

## Quick Reference

### Before Writing New Code

```bash
# 1. Search for existing patterns
rg "keyword" src/

# 2. Check existing utilities
ls src/shared/lib/
ls src/renderer/hooks/

# 3. Check existing types
ls src/shared/types/
```

### Extraction Locations

```
src/
|-- shared/
|   |-- lib/              # Cross-layer utilities
|   |   |-- date-utils.ts
|   |   |-- permissions.ts
|   |   +-- response.ts
|   |-- types/            # Shared type definitions
|   +-- constants/        # Shared constants
|-- renderer/
|   |-- hooks/            # React hooks
|   +-- components/       # Reusable UI components
+-- main/
    +-- lib/              # Main process utilities
```

---

## Shared vs Specific Utilities

When deciding whether to extract a helper to a shared location, use this framework:

### Decision Matrix: When to Share vs Keep Separate

| Criteria              | Share to shared location     | Keep Specific                        |
| --------------------- | ---------------------------- | ------------------------------------ |
| **Filter conditions** | Generic (only basic filters) | Domain-specific (complex conditions) |
| **Return type**       | Simple (IDs, booleans)       | Complex (with domain context)        |
| **Usage count**       | 3+ callers                   | 1-2 callers                          |
| **Business logic**    | Pure data operation          | Includes business rules              |

### Pattern: Shared Utility (Should Share)

```typescript
// src/main/ipc/handlers/configUtils.ts — generic, reused by every handler
export async function readJsonFile<T>(filePath: string): Promise<ConfigFile<T>>;
export function assertSafePath(inputPath: string, ...allowedRoots: string[]): void;
```

### Pattern: Handler-Specific Implementation (Don't Share)

```typescript
// src/main/ipc/handlers/claudePluginsDelete.ts — encodes one agent's on-disk layout
// Don't share: Claude-plugin-specific path structure + side effects
export async function deletePlugin(configDir: string, pluginId: string, installPath: string): Promise<void> {
  // assertSafePluginId + plugin-specific file/dir removal
}
```

### Sync Strategy: Shared vs Domain Updates

```
When fixing a bug in shared code:
|-- Fix in shared location
|-- Run: rg "function_name" to find all callers
+-- Verify all callers still work (typecheck + test)

When fixing a bug in domain-specific code:
|-- Fix in domain location
|-- Search for similar patterns: rg "similar_pattern"
|-- For each similar pattern, ask:
|   |-- Same root cause? -> Apply same fix
|   +-- Different context? -> Evaluate independently
+-- Document pattern in this guide if recurring
```

---

**Core Principle**: If you're about to copy-paste, stop and think about extraction.
