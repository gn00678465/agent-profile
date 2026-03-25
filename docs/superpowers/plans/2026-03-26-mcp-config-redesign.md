# MCP Configuration Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Replace the broken/useless MCP editors for Claude and Gemini with a command-input UI that parses `claude mcp add ...` / `gemini mcp add ...` strings client-side and writes to the correct config files; keep Copilot on JsonFileEditor.

**Architecture:** A new `McpCommandEditor` component parses CLI-style command strings into `McpServer` objects and reads/writes directly via IPC. The backend handlers gain an `agentType` parameter to route to the correct file (`~/.claude.json` for Claude, `settings.json` for Gemini, `mcp-config.json` for Copilot). A standalone parser utility (`parseMcpCommand`) is tested independently of the component.

**Tech Stack:** React 19, TypeScript, Electron IPC (`ipcMain.handle`), Vitest + React Testing Library, `@/lib/electron` (`callElectron` / `electronAPI()`).

**Spec:** `docs/superpowers/specs/2026-03-25-mcp-config-design.md`

---

## File Map

| Action | File | Responsibility |
|--------|------|---------------|
| Modify | `src/shared/types.ts` | Add `trust?: boolean` to `McpServer` |
| Create | `src/renderer/lib/parseMcpCommand.ts` | Pure parser: string → `ParsedMcpServer` discriminated union |
| Create | `src/renderer/lib/__tests__/parseMcpCommand.test.ts` | Unit tests for all parse cases |
| Modify | `src/preload/index.ts` | Add `agentType: AgentType` param to `getMcp` / `saveMcp` |
| Modify | `src/main/ipc/configHandlers.ts` | Add `AgentType` import; rewrite `CONFIG_GET_MCP` and `CONFIG_SAVE_MCP` handlers; update existing MCP tests |
| Modify | `src/main/ipc/__tests__/configHandlers.test.ts` (or relevant test file) | Fix old MCP tests + add new behaviour tests |
| Create | `src/renderer/components/editors/McpCommandEditor.tsx` | New UI: command input + server list + delete |
| Create | `src/renderer/components/editors/__tests__/McpCommandEditor.test.tsx` | Component tests |
| Modify | `src/renderer/App.tsx` | Wire Claude/Gemini to `McpCommandEditor`; keep Copilot on `JsonFileEditor`; remove `GeminiMcpView` |
| Modify | `src/renderer/hooks/useConfig.ts` | Remove `useMcpSettings` function and its `McpSettings` import |
| Modify | `src/renderer/hooks/__tests__/useConfig.test.ts` | Remove `useMcpSettings` describe block |
| Delete | `src/renderer/components/editors/McpEditor.tsx` | Replaced by `McpCommandEditor` |

---

## Task 1: Extend `McpServer` type with `trust` field

**Files:**
- Modify: `src/shared/types.ts`

This is a type-only change — no runtime logic, so no TDD test is written first.

- [ ] **Step 1: Add `trust` field to `McpServer`**

In `src/shared/types.ts`, find the `McpServer` interface and add `trust`:

```typescript
export interface McpServer {
  type?: 'stdio' | 'sse' | 'http' | 'local' | 'remote';
  command?: string;
  args?: string[];
  url?: string;
  headers?: Record<string, string>;
  env?: Record<string, string>;
  disabled?: boolean;
  alwaysAllow?: string[];
  tools?: string[];
  timeout?: number;
  trust?: boolean;   // Gemini-specific: bypass confirmation dialogs
}
```

- [ ] **Step 2: Verify type-check passes**

```bash
cd D:/Projects/agent-profile && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

Call the `commit-message` skill to generate and execute the commit for the `src/shared/types.ts` change.

---

## Task 2: Write `parseMcpCommand` parser (TDD)

**Files:**
- Create: `src/renderer/lib/parseMcpCommand.ts`
- Create: `src/renderer/lib/__tests__/parseMcpCommand.test.ts`

### 2a — Write the failing tests first

- [ ] **Step 1: Create the test file**

Create `src/renderer/lib/__tests__/parseMcpCommand.test.ts`:

```typescript
import { describe, it, expect } from 'vitest';
import { parseMcpCommand } from '../parseMcpCommand';

describe('parseMcpCommand — claude-code', () => {
  it('parses http transport', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport http notion https://mcp.notion.com/mcp',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('notion');
    expect(r.server).toEqual({ type: 'http', url: 'https://mcp.notion.com/mcp' });
  });

  it('parses stdio transport with -- separator', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport stdio airtable -- npx -y airtable-mcp-server',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('airtable');
    expect(r.server.command).toBe('npx');
    expect(r.server.args).toEqual(['-y', 'airtable-mcp-server']);
    expect(r.server.type).toBe('stdio');
  });

  it('parses --env flags', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport stdio --env API_KEY=abc myserver -- python server.py',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.env).toEqual({ API_KEY: 'abc' });
  });

  it('parses multiple --env flags', () => {
    const r = parseMcpCommand(
      'claude mcp add --env A=1 --env B=2 myserver -- cmd',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.env).toEqual({ A: '1', B: '2' });
  });

  it('parses --header flag', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport http --header "Authorization: Bearer tok" myserver https://x.com',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('consumes --scope and its value without treating value as server name', () => {
    const r = parseMcpCommand(
      'claude mcp add --scope user --transport http myserver https://example.com',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('myserver');
  });

  it('returns error for wrong prefix', () => {
    const r = parseMcpCommand('gemini mcp add foo https://x.com', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/claude mcp add/);
  });

  it('returns error for missing server name', () => {
    const r = parseMcpCommand('claude mcp add --transport http', 'claude-code');
    expect(r.ok).toBe(false);
  });

  it('returns error for http transport without URL', () => {
    const r = parseMcpCommand('claude mcp add --transport http myserver', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/URL/i);
  });

  it('returns error for stdio without command after --', () => {
    const r = parseMcpCommand('claude mcp add --transport stdio myserver', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/command/i);
  });

  it('returns error for malformed --env (no =)', () => {
    const r = parseMcpCommand('claude mcp add --env BADVAL myserver -- cmd', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/KEY=VALUE/i);
  });
});

describe('parseMcpCommand — gemini', () => {
  it('parses http transport', () => {
    const r = parseMcpCommand(
      'gemini mcp add --transport http myserver https://example.com/mcp',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('myserver');
    expect(r.server).toEqual({ type: 'http', url: 'https://example.com/mcp' });
  });

  it('parses --trust flag', () => {
    const r = parseMcpCommand(
      'gemini mcp add --trust myserver /path/to/server',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.trust).toBe(true);
    expect(r.server.command).toBe('/path/to/server');
  });

  it('parses -e shorthand for env', () => {
    const r = parseMcpCommand(
      'gemini mcp add -e API_KEY=xyz myserver /path/server',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.env).toEqual({ API_KEY: 'xyz' });
  });

  it('parses --header flag', () => {
    const r = parseMcpCommand(
      'gemini mcp add --transport http -H "X-Key: tok" myserver https://x.com',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.headers).toEqual({ 'X-Key': 'tok' });
  });

  it('returns error for wrong prefix', () => {
    const r = parseMcpCommand('claude mcp add foo https://x.com', 'gemini');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/gemini mcp add/);
  });
});
```

- [ ] **Step 2: Run tests to verify they fail (module not found)**

```bash
cd D:/Projects/agent-profile && bunx vitest run src/renderer/lib/__tests__/parseMcpCommand.test.ts
```

Expected: FAIL — `Cannot find module '../parseMcpCommand'`

### 2b — Implement the parser

- [ ] **Step 3: Create `src/renderer/lib/parseMcpCommand.ts`**

```typescript
import type { McpServer, AgentType } from '@shared/types';

type ParsedMcpServer =
  | { ok: true;  name: string; server: McpServer; error: null }
  | { ok: false; name?: never; server?: never;    error: string };

export type { ParsedMcpServer };

export function parseMcpCommand(input: string, agentType: AgentType): ParsedMcpServer {
  const expectedPrefix = agentType === 'claude-code' ? 'claude mcp add' : 'gemini mcp add';

  const trimmed = input.trim();
  if (!trimmed.startsWith(expectedPrefix)) {
    return { ok: false, error: `Command must start with "${expectedPrefix}"` };
  }

  const rest = trimmed.slice(expectedPrefix.length).trim();
  const tokens = tokenize(rest);

  let transport: McpServer['type'] = 'stdio';
  const env: Record<string, string> = {};
  const headers: Record<string, string> = {};
  let trust = false;
  const positionals: string[] = [];
  let dashDashArgs: string[] | null = null;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === '--') {
      dashDashArgs = tokens.slice(i + 1);
      break;
    }

    if (tok === '--transport' || tok === '-t') {
      transport = (tokens[++i] ?? 'stdio') as McpServer['type'];
    } else if (tok === '--env' || tok === '-e') {
      const val = tokens[++i] ?? '';
      const eqIdx = val.indexOf('=');
      if (eqIdx === -1) {
        return { ok: false, error: `--env value must be in KEY=VALUE format, got: "${val}"` };
      }
      env[val.slice(0, eqIdx)] = val.slice(eqIdx + 1);
    } else if (tok === '--header' || tok === '-H') {
      const val = tokens[++i] ?? '';
      const colonIdx = val.indexOf(':');
      if (colonIdx !== -1) {
        headers[val.slice(0, colonIdx).trim()] = val.slice(colonIdx + 1).trim();
      }
    } else if (tok === '--scope') {
      i++; // consume value token (user/local/project) — discard both flag and value
    } else if (tok === '--trust') {
      trust = true;
    } else if (!tok.startsWith('-')) {
      positionals.push(tok);
    }

    i++;
  }

  const name = positionals[0];
  if (!name) {
    return { ok: false, error: 'Missing server name' };
  }

  const server: McpServer = { type: transport };

  if (transport === 'http' || transport === 'sse') {
    const url = positionals[1];
    if (!url) {
      return { ok: false, error: `Transport "${transport}" requires a URL as the next argument after the server name` };
    }
    server.url = url;
  } else {
    if (agentType === 'claude-code') {
      if (!dashDashArgs || dashDashArgs.length === 0) {
        return { ok: false, error: 'stdio transport requires a command after "--" (e.g., -- npx -y package)' };
      }
      server.command = dashDashArgs[0];
      if (dashDashArgs.length > 1) server.args = dashDashArgs.slice(1);
    } else {
      const cmd = positionals[1];
      if (!cmd) {
        return { ok: false, error: 'stdio transport requires a command as the second argument (e.g., gemini mcp add name /path/to/server)' };
      }
      server.command = cmd;
      if (positionals.length > 2) server.args = positionals.slice(2);
    }
  }

  if (Object.keys(env).length > 0) server.env = env;
  if (Object.keys(headers).length > 0) server.headers = headers;
  if (trust) server.trust = true;

  return { ok: true, name, server, error: null };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; }
      else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
```

- [ ] **Step 4: Run tests and verify they pass**

```bash
cd D:/Projects/agent-profile && bunx vitest run src/renderer/lib/__tests__/parseMcpCommand.test.ts
```

Expected: all tests PASS.

- [ ] **Step 5: Type-check**

```bash
cd D:/Projects/agent-profile && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 6: Commit**

Call the `commit-message` skill to generate and execute the commit for the parser files.

---

## Task 3: Update IPC signatures, backend handlers, and tests (one atomic commit)

**Note:** The handler rewrite changes the IPC signature, which breaks existing MCP backend tests. All handler changes and test fixes are committed together in this task to keep the build green throughout.

**Files:**
- Modify: `src/preload/index.ts`
- Modify: `src/main/ipc/configHandlers.ts`
- Modify: `src/main/ipc/__tests__/configHandlers.test.ts` (or the relevant test files)

### 3a — Update preload and backend

- [ ] **Step 1: Add `AgentType` import to `configHandlers.ts`**

Find the import block at the top of `src/main/ipc/configHandlers.ts` and add `AgentType`:

```typescript
import type {
  // ...existing imports...
  AgentType,
} from '../../shared/types';
```

Verify `AgentType` is not already imported before adding.

- [ ] **Step 2: Update preload `getMcp` / `saveMcp` signatures**

In `src/preload/index.ts`, add `AgentType` to the import at the top:
```typescript
import type {
  // ...existing...
  AgentType,
} from '../shared/types';
```

Replace the existing `getMcp` / `saveMcp` lines (currently lines 87-90):
```typescript
getMcp: (configDir: string, agentType: AgentType) =>
  invoke<ConfigFile<McpSettings>>(IPC_CHANNELS.CONFIG_GET_MCP, configDir, agentType),
saveMcp: (configDir: string, agentType: AgentType, settings: McpSettings) =>
  invoke<void>(IPC_CHANNELS.CONFIG_SAVE_MCP, configDir, agentType, settings),
```

- [ ] **Step 3: Rewrite `CONFIG_GET_MCP` handler in `configHandlers.ts`**

Replace the existing handler (find `ipcMain.handle(IPC_CHANNELS.CONFIG_GET_MCP, ...`):

```typescript
ipcMain.handle(
  IPC_CHANNELS.CONFIG_GET_MCP,
  async (_event, configDir: string, agentType: AgentType) => {
    try {
      let targetPath: string;
      if (agentType === 'claude-code') {
        targetPath = path.join(os.homedir(), '.claude.json');
      } else if (agentType === 'gemini') {
        targetPath = path.join(configDir, 'settings.json');
      } else {
        targetPath = path.join(configDir, 'mcp-config.json');
      }

      assertSafePath(targetPath, os.homedir());

      let content: string;
      try {
        content = await fs.readFile(targetPath, 'utf-8');
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code === 'ENOENT') {
          return success<ConfigFile<McpSettings>>({
            path: targetPath,
            exists: false,
            data: { mcpServers: {} },
          });
        }
        throw err;
      }

      // Abort on malformed JSON — do not silently use empty object
      const parsed = JSON.parse(content) as Record<string, unknown>;
      const mcpServers = (parsed.mcpServers ?? {}) as McpSettings['mcpServers'];
      return success<ConfigFile<McpSettings>>({
        path: targetPath,
        exists: true,
        data: { mcpServers },
      });
    } catch (err) {
      return failure(err);
    }
  }
);
```

- [ ] **Step 4: Rewrite `CONFIG_SAVE_MCP` handler in `configHandlers.ts`**

Replace the existing handler (find `ipcMain.handle(IPC_CHANNELS.CONFIG_SAVE_MCP, ...`):

```typescript
ipcMain.handle(
  IPC_CHANNELS.CONFIG_SAVE_MCP,
  async (_event, configDir: string, agentType: AgentType, settings: McpSettings) => {
    try {
      let targetPath: string;
      if (agentType === 'claude-code') {
        targetPath = path.join(os.homedir(), '.claude.json');
      } else if (agentType === 'gemini') {
        targetPath = path.join(configDir, 'settings.json');
      } else {
        targetPath = path.join(configDir, 'mcp-config.json');
      }

      assertSafePath(targetPath, os.homedir());

      // Read existing file — abort on malformed JSON to prevent data loss
      let existing: Record<string, unknown> = {};
      try {
        const content = await fs.readFile(targetPath, 'utf-8');
        existing = JSON.parse(content) as Record<string, unknown>;
      } catch (err: unknown) {
        if ((err as NodeJS.ErrnoException).code !== 'ENOENT') {
          // File exists but is malformed — abort rather than wipe
          throw err;
        }
        // ENOENT: new file, start from empty
      }

      // Preserve all existing keys; update only mcpServers
      const merged = { ...existing, mcpServers: settings.mcpServers };
      await writeJsonFile(targetPath, merged);
      return success(undefined);
    } catch (err) {
      return failure(err);
    }
  }
);
```

### 3b — Update backend tests

- [ ] **Step 5: Find existing MCP tests and check their signatures**

```bash
cd D:/Projects/agent-profile && grep -n "CONFIG_GET_MCP\|CONFIG_SAVE_MCP\|getMcp\|saveMcp" src/main/ipc/__tests__/configHandlers.test.ts
```

Read those lines. Any call that passes only `(configDir)` to `CONFIG_GET_MCP` or `(configDir, settings)` to `CONFIG_SAVE_MCP` must have `agentType` added as the second argument. Adapt to the actual mock style used in that file (it uses `vi.mocked(fs.readFile).mockResolvedValue(...)` — follow that pattern).

- [ ] **Step 6: Fix existing MCP test calls to pass `agentType`**

For each existing call like:
```typescript
// before
await handlers[IPC_CHANNELS.CONFIG_GET_MCP](null, '/mock/dir')
// after
await handlers[IPC_CHANNELS.CONFIG_GET_MCP](null, '/mock/dir', 'copilot')
```

And:
```typescript
// before
await handlers[IPC_CHANNELS.CONFIG_SAVE_MCP](null, '/mock/dir', { mcpServers: {} })
// after
await handlers[IPC_CHANNELS.CONFIG_SAVE_MCP](null, '/mock/dir', 'copilot', { mcpServers: {} })
```

- [ ] **Step 7: Add new MCP handler behaviour tests**

Append to the MCP test section — using the existing `vi.mocked(fs.readFile)` pattern, NOT `mockFs` (which does not exist):

```typescript
// claude-code reads ~/.claude.json not configDir/settings.json
it('getMcp for claude-code reads ~/.claude.json', async () => {
  const claudeJsonContent = JSON.stringify({
    model: 'claude-3',
    mcpServers: { notion: { type: 'http', url: 'https://mcp.notion.com' } }
  });
  vi.mocked(fs.readFile).mockResolvedValueOnce(claudeJsonContent as never);

  const result = await handlers[IPC_CHANNELS.CONFIG_GET_MCP](null, '/some/configDir', 'claude-code');
  expect(result.success).toBe(true);
  expect(result.data?.data?.mcpServers).toHaveProperty('notion');
  // Path must be the absolute ~/.claude.json, not relative to configDir
  expect(result.data?.path).toContain('.claude.json');
  expect(result.data?.path).not.toContain('configDir');
});

// gemini reads configDir/settings.json
it('getMcp for gemini reads configDir/settings.json', async () => {
  const content = JSON.stringify({
    mcpServers: { myserver: { type: 'stdio', command: 'python' } }
  });
  vi.mocked(fs.readFile).mockResolvedValueOnce(content as never);

  const result = await handlers[IPC_CHANNELS.CONFIG_GET_MCP](null, '/mock/gemini', 'gemini');
  expect(result.success).toBe(true);
  expect(result.data?.data?.mcpServers).toHaveProperty('myserver');
});

// saveMcp preserves unrelated keys in ~/.claude.json
it('saveMcp for claude-code preserves existing keys', async () => {
  const existing = JSON.stringify({ model: 'claude-3', permissions: { allow: ['*'] } });
  vi.mocked(fs.readFile).mockResolvedValueOnce(existing as never);

  await handlers[IPC_CHANNELS.CONFIG_SAVE_MCP](
    null, '/ignored', 'claude-code',
    { mcpServers: { test: { type: 'http', url: 'https://x.com' } } }
  );

  // Capture what was written
  const writeCall = vi.mocked(fs.writeFile).mock.calls[0];
  const written = JSON.parse(writeCall[1] as string);
  expect(written.model).toBe('claude-3');
  expect(written.permissions).toEqual({ allow: ['*'] });
  expect(written.mcpServers).toHaveProperty('test');
});

// saveMcp aborts on malformed JSON
it('saveMcp returns error when file is malformed JSON', async () => {
  vi.mocked(fs.readFile).mockResolvedValueOnce('not valid json {{{' as never);

  const result = await handlers[IPC_CHANNELS.CONFIG_SAVE_MCP](
    null, '/ignored', 'claude-code', { mcpServers: {} }
  );
  expect(result.success).toBe(false);
});

// getMcp returns empty on ENOENT
it('getMcp returns empty config on ENOENT', async () => {
  const err = Object.assign(new Error('ENOENT'), { code: 'ENOENT' });
  vi.mocked(fs.readFile).mockRejectedValueOnce(err);

  const result = await handlers[IPC_CHANNELS.CONFIG_GET_MCP](null, '/mock/dir', 'copilot');
  expect(result.success).toBe(true);
  expect(result.data?.exists).toBe(false);
  expect(result.data?.data?.mcpServers).toEqual({});
});
```

**Note:** If the test file uses a different pattern (e.g., `ipcHandlers` vs `handlers`, or `fs.promises.readFile` vs `fs.readFile`), adapt the mock target to match. The pattern to follow is whatever is already used in the file's other test blocks.

- [ ] **Step 8: Run all backend tests**

```bash
cd D:/Projects/agent-profile && bunx vitest run src/main/ipc/__tests__/
```

Expected: all tests PASS.

- [ ] **Step 9: Type-check**

```bash
cd D:/Projects/agent-profile && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Commit**

Call the `commit-message` skill to generate and execute the commit covering the preload update, handler rewrite, and test fixes together.

---

## Task 4: Build `McpCommandEditor` component (TDD)

**Files:**
- Create: `src/renderer/components/editors/McpCommandEditor.tsx`
- Create: `src/renderer/components/editors/__tests__/McpCommandEditor.test.tsx`

### 4a — Write failing tests

- [ ] **Step 1: Create the test file**

Create `src/renderer/components/editors/__tests__/McpCommandEditor.test.tsx`:

```typescript
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpCommandEditor } from '../McpCommandEditor';

function mockGetMcp(servers: Record<string, unknown> = {}) {
  (window.electronAPI.config.getMcp as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: { path: '/mock/.claude.json', exists: true, data: { mcpServers: servers } },
  });
}

function mockSaveMcp() {
  (window.electronAPI.config.saveMcp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMcp();
  mockSaveMcp();
});

describe('McpCommandEditor', () => {
  it('shows empty state when no servers', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);
    expect(await screen.findByText(/No MCP servers configured/i)).toBeInTheDocument();
  });

  it('shows existing servers', async () => {
    mockGetMcp({ notion: { type: 'http', url: 'https://mcp.notion.com/mcp' } });
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);
    expect(await screen.findByText('notion')).toBeInTheDocument();
  });

  it('adds a server on valid command submit', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    const input = await screen.findByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, {
      target: { value: 'claude mcp add --transport http notion https://mcp.notion.com/mcp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(window.electronAPI.config.saveMcp).toHaveBeenCalledWith(
        '/mock/.claude',
        'claude-code',
        expect.objectContaining({ mcpServers: expect.objectContaining({ notion: expect.any(Object) }) })
      );
    });
  });

  it('shows inline error on invalid command', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    const input = await screen.findByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, { target: { value: 'claude mcp add --transport http' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText(/server name|URL/i)).toBeInTheDocument();
    expect(window.electronAPI.config.saveMcp).not.toHaveBeenCalled();
  });

  it('shows error on duplicate server name', async () => {
    mockGetMcp({ notion: { type: 'http', url: 'https://x.com' } });
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    await screen.findByText('notion');

    const input = screen.getByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, {
      target: { value: 'claude mcp add --transport http notion https://mcp.notion.com/mcp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('deletes a server and saves with it removed', async () => {
    mockGetMcp({ notion: { type: 'http', url: 'https://mcp.notion.com/mcp' } });
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    await screen.findByText('notion');
    const deleteBtn = screen.getByRole('button', { name: /delete notion/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(window.electronAPI.config.saveMcp).toHaveBeenCalledWith(
        '/mock/.claude',
        'claude-code',
        { mcpServers: {} }
      );
    });
  });

  it('preserves disabled field on existing servers when adding new server', async () => {
    const servers = {
      notion: { type: 'http', url: 'https://mcp.notion.com/mcp', disabled: true },
    };
    mockGetMcp(servers);
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);
    await screen.findByText('notion');

    const input = screen.getByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, {
      target: { value: 'claude mcp add --transport http new https://new.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(window.electronAPI.config.saveMcp).toHaveBeenCalledWith(
        '/mock/.claude',
        'claude-code',
        expect.objectContaining({
          mcpServers: expect.objectContaining({
            notion: expect.objectContaining({ disabled: true }),
          }),
        })
      );
    });
  });

  it('renders with gemini agentType and shows correct placeholder', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.gemini" agentType="gemini" />);
    expect(await screen.findByPlaceholderText(/gemini mcp add/i)).toBeInTheDocument();
  });
});
```

- [ ] **Step 2: Run tests to verify they fail**

```bash
cd D:/Projects/agent-profile && bunx vitest run src/renderer/components/editors/__tests__/McpCommandEditor.test.tsx
```

Expected: FAIL — `Cannot find module '../McpCommandEditor'`

### 4b — Implement the component

- [ ] **Step 3: Create `src/renderer/components/editors/McpCommandEditor.tsx`**

```typescript
import { useState, useEffect, useCallback } from 'react';
import { Trash2, Plus, RefreshCw } from 'lucide-react';
import { parseMcpCommand } from '@/lib/parseMcpCommand';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { ScrollArea } from '@/components/ui/scroll-area';
import { callElectron, electronAPI } from '@/lib/electron';
import type { McpServer, McpSettings, AgentType } from '@shared/types';

interface McpCommandEditorProps {
  configDir: string;
  agentType: 'claude-code' | 'gemini';
}

export function McpCommandEditor({ configDir, agentType }: McpCommandEditorProps) {
  const [servers, setServers] = useState<Record<string, McpServer>>({});
  const [loading, setLoading] = useState(true);
  const [input, setInput] = useState('');
  const [parseError, setParseError] = useState<string | null>(null);
  const [saveError, setSaveError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);

  const placeholder = agentType === 'claude-code'
    ? 'claude mcp add --transport http name https://...'
    : 'gemini mcp add --transport http name https://...';

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getMcp(configDir, agentType as AgentType)
      );
      setServers(result.data?.mcpServers ?? {});
    } finally {
      setLoading(false);
    }
  }, [configDir, agentType]);

  useEffect(() => { void load(); }, [load]);

  async function saveServers(updated: Record<string, McpServer>) {
    setSaving(true);
    setSaveError(null);
    try {
      const settings: McpSettings = { mcpServers: updated };
      await callElectron(() =>
        electronAPI().config.saveMcp(configDir, agentType as AgentType, settings)
      );
      setServers(updated);
    } catch (err) {
      setSaveError(err instanceof Error ? err.message : 'Failed to save MCP config');
    } finally {
      setSaving(false);
    }
  }

  function handleAdd() {
    setParseError(null);
    setSaveError(null);
    const parsed = parseMcpCommand(input.trim(), agentType);
    if (!parsed.ok) {
      setParseError(parsed.error);
      return;
    }
    if (parsed.name in servers) {
      setParseError(`Server "${parsed.name}" already exists`);
      return;
    }
    const updated = { ...servers, [parsed.name]: parsed.server };
    void saveServers(updated);
    setInput('');
  }

  function handleDelete(name: string) {
    // Immutable delete: destructure out the key, keep the rest
    const { [name]: _removed, ...updated } = servers;
    void saveServers(updated);
  }

  function serverSummary(server: McpServer): string {
    if (server.url) return server.url;
    if (server.command) {
      const args = server.args?.join(' ') ?? '';
      return args ? `${server.command} ${args}` : server.command;
    }
    return '';
  }

  if (loading) {
    return (
      <div className="flex h-full items-center justify-center text-muted-foreground">
        Loading MCP servers...
      </div>
    );
  }

  const serverEntries = Object.entries(servers);

  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-6 p-6">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-sm font-semibold">MCP Servers</h2>
            <p className="text-xs text-muted-foreground">
              {agentType === 'claude-code' ? '~/.claude.json' : `${configDir}/settings.json`}
            </p>
          </div>
          <Button variant="outline" size="sm" onClick={() => { void load(); }}>
            <RefreshCw className="h-4 w-4" />
            Refresh
          </Button>
        </div>

        {/* Command input */}
        <div className="flex flex-col gap-2">
          <div className="flex gap-2">
            <Input
              className="font-mono text-xs"
              placeholder={placeholder}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleAdd()}
            />
            <Button onClick={handleAdd} disabled={saving} size="sm">
              <Plus className="h-4 w-4" />
              Add
            </Button>
          </div>
          {parseError && <p className="text-xs text-destructive">{parseError}</p>}
          {saveError && (
            <p className="text-xs text-destructive">{saveError}</p>
          )}
        </div>

        {/* Server list */}
        {serverEntries.length === 0 ? (
          <div className="rounded-md border border-dashed border-border py-12 text-center text-sm text-muted-foreground">
            No MCP servers configured. Add one above.
          </div>
        ) : (
          <div className="flex flex-col gap-2">
            {serverEntries.map(([name, server]) => (
              <div
                key={name}
                className="flex items-center justify-between rounded-md border border-border/60 px-4 py-3"
              >
                <div className="flex items-center gap-3 font-mono text-xs min-w-0">
                  <span className="font-semibold shrink-0">{name}</span>
                  <span className="text-muted-foreground shrink-0">{server.type ?? 'stdio'}</span>
                  <span className="text-muted-foreground truncate">{serverSummary(server)}</span>
                  {server.disabled && (
                    <span className="shrink-0 rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
                      disabled
                    </span>
                  )}
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  className="h-7 w-7 shrink-0 text-destructive hover:bg-destructive/10"
                  onClick={() => handleDelete(name)}
                  aria-label={`Delete ${name}`}
                >
                  <Trash2 className="h-3.5 w-3.5" />
                </Button>
              </div>
            ))}
          </div>
        )}
      </div>
    </ScrollArea>
  );
}
```

- [ ] **Step 4: Run component tests**

```bash
cd D:/Projects/agent-profile && bunx vitest run src/renderer/components/editors/__tests__/McpCommandEditor.test.tsx
```

Expected: all tests PASS.

- [ ] **Step 5: Run full test suite**

```bash
cd D:/Projects/agent-profile && bunx vitest run
```

Expected: all tests pass (or only pre-existing failures unrelated to this change).

- [ ] **Step 6: Commit**

Call the `commit-message` skill to generate and execute the commit for the new component and its tests.

---

## Task 5: Wire up App.tsx and clean up dead code

**Files:**
- Modify: `src/renderer/App.tsx`
- Modify: `src/renderer/hooks/useConfig.ts`
- Modify: `src/renderer/hooks/__tests__/useConfig.test.ts`
- Delete: `src/renderer/components/editors/McpEditor.tsx`

- [ ] **Step 1: Verify no other consumers of `useMcpSettings` exist**

```bash
cd D:/Projects/agent-profile && grep -r "useMcpSettings" src/
```

Expected: only `McpEditor.tsx`, `useConfig.ts`, and `useConfig.test.ts`. If any other file is listed, update it before continuing.

- [ ] **Step 2: Verify Copilot MCP tab is already correctly wired**

```bash
cd D:/Projects/agent-profile && grep -n "mcp" src/renderer/App.tsx
```

Confirm the Copilot branch already uses `JsonFileEditor` pointing to `mcp-config.json`. No change needed there.

- [ ] **Step 3: Update App.tsx — Claude MCP tab**

Find in `src/renderer/App.tsx`:
```tsx
if (tabId === 'mcp')       return <McpEditor configDir={configDir} />;
```

Replace with:
```tsx
if (tabId === 'mcp') return <McpCommandEditor configDir={configDir} agentType="claude-code" />;
```

- [ ] **Step 4: Update App.tsx — Gemini MCP tab**

Find:
```tsx
if (tabId === 'mcp')        return <GeminiMcpView onNavigate={() => onTabChange('extensions')} />;
```

Replace with:
```tsx
if (tabId === 'mcp') return <McpCommandEditor configDir={configDir} agentType="gemini" />;
```

- [ ] **Step 5: Update App.tsx imports**

Remove `McpEditor` from the import list. Add:
```tsx
import { McpCommandEditor } from './components/editors/McpCommandEditor';
```

Delete the `GeminiMcpView` function from `App.tsx` — search for `function GeminiMcpView` and delete the entire function body (it is an inline component in App.tsx, not a separate file).

- [ ] **Step 6: Remove `useMcpSettings` from `useConfig.ts`**

In `src/renderer/hooks/useConfig.ts`:
- Delete the `useMcpSettings` function block (lines 6–51, the function from `export function useMcpSettings` through its closing `}`)
- On the import line (`import type { McpSettings, Skill, ConfigFile }`), remove `McpSettings` if it is now unused

Do **not** delete the file or the other imports and functions.

- [ ] **Step 7: Remove `useMcpSettings` tests**

In `src/renderer/hooks/__tests__/useConfig.test.ts`:
- Delete the entire `describe('useMcpSettings', ...)` block
- Remove `useMcpSettings` from any import statements

- [ ] **Step 8: Delete `McpEditor.tsx`**

```bash
rm "D:/Projects/agent-profile/src/renderer/components/editors/McpEditor.tsx"
```

- [ ] **Step 9: Type-check**

```bash
cd D:/Projects/agent-profile && bunx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 10: Run full test suite**

```bash
cd D:/Projects/agent-profile && bunx vitest run
```

Expected: all tests pass.

- [ ] **Step 11: Lint**

```bash
cd D:/Projects/agent-profile && bun run lint
```

Expected: no errors.

- [ ] **Step 12: Commit**

Call the `commit-message` skill to generate and execute the commit for the App.tsx wiring and cleanup.

---

## Done

After all tasks, the MCP configuration UX is:

| Agent | Tab UI | Reads/writes |
|-------|--------|-------------|
| Claude Code | `McpCommandEditor` (parses `claude mcp add ...`) | `~/.claude.json` |
| Gemini | `McpCommandEditor` (parses `gemini mcp add ...`) | `~/.gemini/settings.json` |
| Copilot | `JsonFileEditor` (unchanged) | `~/.copilot/mcp-config.json` |
