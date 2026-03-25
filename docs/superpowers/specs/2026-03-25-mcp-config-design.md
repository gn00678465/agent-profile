# MCP Configuration Redesign

Date: 2026-03-25

## Problem

Current state has three issues:

1. **Claude Code MCP reads the wrong file** — `McpEditor` uses `CONFIG_GET_MCP` which searches `mcp-config.json` then `settings.json` relative to `configDir`, but Claude Code's official user-scope MCP config is `~/.claude.json` (in home dir root, not inside `~/.claude/`).
2. **Gemini MCP tab is useless** — `GeminiMcpView` only shows a redirect message pointing to the Extensions tab, providing no actual MCP management.
3. **Inconsistent UX** — Each agent uses a different approach (custom form editor, JsonFileEditor, redirect) with no coherent pattern.

## Design Decision

Each agent's MCP management approach is determined by its CLI's native UX:

| Agent | CLI command style | App UI | Config file |
|-------|------------------|--------|-------------|
| Claude Code | `claude mcp add --transport http name url` | `McpCommandEditor` | `~/.claude.json` (`mcpServers` key) |
| Gemini | `gemini mcp add --transport http name url` | `McpCommandEditor` | `~/.gemini/settings.json` (`mcpServers` key) |
| Copilot | `/mcp add` (interactive, no CLI string syntax) | `JsonFileEditor` | `~/.copilot/mcp-config.json` |

## Architecture

### New Component: `McpCommandEditor`

Replaces `McpEditor` (Claude) and `GeminiMcpView` (Gemini).

```
src/renderer/components/editors/McpCommandEditor.tsx
```

Props:
```typescript
interface McpCommandEditorProps {
  configDir: string;  // passed for uniformity; Claude ignores it for file path (uses ~/.claude.json)
  agentType: 'claude-code' | 'gemini';
}
```

UI layout:
```
┌─ MCP Servers ──────────────────────────────────────────────────┐
│  claude mcp add --transport http notion https://mcp.notion... │  <- input
│                                                       [Add]   │
│  Error: missing server name                                   │  <- inline validation (only on submit)
├────────────────────────────────────────────────────────────────┤
│  notion    http   https://mcp.notion.com/mcp           [Del]  │
│  airtable  stdio  npx -y airtable-mcp-server           [Del]  │
│  (empty state: "No MCP servers configured. Add one above.")    │
└────────────────────────────────────────────────────────────────┘
```

The server list rows display: `name`, `type`, `url` or `command + args` joined as a single string, and a delete button. The `disabled` field on existing servers is **preserved on round-trips**: when saving, the full existing `McpServer` object is kept and only `mcpServers` keys are merged — disabled servers that are not touched by the user remain disabled.

### Command Parser (client-side, no CLI execution)

`parseMcpCommand(input: string, agentType: 'claude-code' | 'gemini'): ParsedMcpServer`

The parser extracts structured fields from the command string without running any shell command.

```typescript
// Discriminated union — exactly one branch is active at runtime
type ParsedMcpServer =
  | { ok: true;  name: string; server: McpServer; error: null }
  | { ok: false; name?: never; server?: never;    error: string };
```

When `ok` is `true`, `name` and `server` are always populated. When `ok` is `false`, only `error` is set. The UI shows the error inline on submit attempt and prevents the add action.

**Supported flags:**

| Flag | Claude | Gemini | Maps to |
|------|--------|--------|---------|
| `--transport` / `-t` | yes | yes | `type` field |
| `--env` / `-e KEY=val` | yes | yes | `env` record |
| `--header` / `-H "K: V"` | yes | yes | `headers` record |
| `--scope <value>` | yes | — | flag and its value token both consumed and discarded; prevents misidentifying `user`/`local`/`project` as server name |
| `--trust` | — | yes | `trust` boolean (requires `McpServer` type extension — see below) |
| `--` separator | yes (Claude) | — | separates server name from command+args |

**Gemini `trust` field — type extension required:**

`McpServer` in `src/shared/types.ts` must be extended:
```typescript
export interface McpServer {
  // ... existing fields ...
  trust?: boolean;   // Gemini-specific: bypass confirmation dialogs
}
```

**Parse rules by agent type:**

Claude: `claude mcp add [options] <name> [--] <command> [args...]` or `claude mcp add --transport http|sse <name> <url>`
- Server name is the first non-flag, non-value token before `--`
- After `--`: everything is the command and its args
- `--transport stdio` (or omitted): sets `type: 'stdio'`, command comes after `--`
- `--transport http|sse`: sets `type`, next non-flag token after name is the URL

Gemini: `gemini mcp add [options] <name> <commandOrUrl> [args...]`
- Server name is first positional; second positional is command-or-url
- No `--` separator needed

**Validation errors (shown on submit, not on every keystroke):**
- Input does not start with the expected prefix (`claude mcp add` / `gemini mcp add`)
- Missing server name
- `--transport http|sse` without a URL
- `--transport stdio` (or default) without a command
- Server name already exists in the current config
- `--env` value missing `=`

### IPC Changes

**New parameter `agentType` added to both MCP IPC calls.**

Preload (`src/preload/index.ts`):
```typescript
getMcp: (configDir: string, agentType: AgentType) =>
  invoke<ConfigFile<McpSettings>>(IPC_CHANNELS.CONFIG_GET_MCP, configDir, agentType),
saveMcp: (configDir: string, agentType: AgentType, settings: McpSettings) =>
  invoke<void>(IPC_CHANNELS.CONFIG_SAVE_MCP, configDir, agentType, settings),
```

Files requiring signature update alongside the handler:
- `src/preload/index.ts` — add `agentType` parameter
- `src/shared/types.ts` — `IPC_CHANNELS` constants unchanged (channel names stay the same)
- `src/renderer/components/editors/McpCommandEditor.tsx` — calls with `agentType`
- `src/test/setup.ts` — update mock signatures for `getMcp` / `saveMcp`

### Backend: `configHandlers.ts`

**`CONFIG_GET_MCP` — new handler signature:**
```typescript
ipcMain.handle(IPC_CHANNELS.CONFIG_GET_MCP,
  async (_event, configDir: string, agentType: AgentType) => { ... })
```

**File path resolution per agent type:**

```
claude-code → path.join(os.homedir(), '.claude.json')   // absolute, ignores configDir
gemini      → path.join(configDir, 'settings.json')      // reads mcpServers key from settings
copilot     → path.join(configDir, 'mcp-config.json')    // unchanged
others      → path.join(configDir, 'mcp-config.json')    // fallback
```

For `claude-code`, the path `~/.claude.json` resolves within `os.homedir()`, so `assertSafePath` passes (allowed root is `os.homedir()`). The path is **not derived from `configDir`** — it is always the absolute `~/.claude.json` regardless of what `configDir` is.

For Gemini, `CONFIG_GET_MCP` reads `settings.json` and returns only the `mcpServers` sub-key wrapped in a `ConfigFile<McpSettings>`. This is intentionally a separate read from `CONFIG_GET_GEMINI_SETTINGS` to keep the MCP editor's read/write cycle self-contained without touching unrelated Gemini settings fields.

**`CONFIG_SAVE_MCP` — merge strategy:**

For all agents, the merge must preserve all existing keys in the target file:
```typescript
// Correct merge pattern:
const existing = await readJsonFileSafe(targetPath); // returns {} on ENOENT
const merged = { ...existing, mcpServers: settings.mcpServers };
await writeJsonFile(targetPath, merged);
```

**IMPORTANT**: if `targetPath` exists but contains malformed JSON, the handler must **abort with an error** (return `failure(err)`) rather than proceeding with an empty base. This prevents silently wiping all Claude Code user settings in `~/.claude.json`. The same abort-on-malformed behavior applies to `CONFIG_GET_MCP`.

The `mcpServers` key name in `~/.claude.json` is `"mcpServers"` — confirmed by the Claude Code CLI documentation (user-scope MCP servers are stored at the root `mcpServers` key of `~/.claude.json`, as generated by `claude mcp add --scope user`).

### App.tsx changes

```tsx
// Claude Code mcp tab
if (tabId === 'mcp') return <McpCommandEditor configDir={configDir} agentType="claude-code" />;

// Gemini mcp tab
if (tabId === 'mcp') return <McpCommandEditor configDir={configDir} agentType="gemini" />;

// Copilot mcp tab — configDir is ~/.copilot/, file is ~/.copilot/mcp-config.json
if (tabId === 'mcp') return (
  <JsonFileEditor
    filePath={`${configDir}/mcp-config.json`}
    title="MCP Servers"
    description={`${configDir}/mcp-config.json`}
  />
);
```

### Deleted components and exports

- `src/renderer/components/editors/McpEditor.tsx` — deleted (replaced by `McpCommandEditor`); no corresponding test file exists at `__tests__/McpEditor.test.tsx` so no test cleanup is needed here
- `GeminiMcpView` inline component in `App.tsx` — deleted (replaced by `McpCommandEditor`)
- `useMcpSettings` **export** in `src/renderer/hooks/useConfig.ts` — function removed; the `useConfig.ts` file itself is not deleted (still exports `useSkills`, `useMarkdown`, `useMcpSettings` is just removed)
- `McpCommandEditor` calls IPC directly via `electronAPI().config.getMcp` / `saveMcp` — no hook

## Data Flow

```
User types: "claude mcp add --transport http notion https://mcp.notion.com/mcp"
     |
     v
parseMcpCommand(input, 'claude-code')
  -> { name: "notion", server: { type: "http", url: "https://..." }, error: null }
     |
     v
electronAPI().config.getMcp(configDir, 'claude-code')
  -> reads ~/.claude.json -> returns { mcpServers: { ...existing } }
     |
     v
merge: { ...existingServers, notion: { type: "http", url: "..." } }
  // disabled flag on existing servers is preserved because full server objects are kept
     |
     v
electronAPI().config.saveMcp(configDir, 'claude-code', { mcpServers: merged })
  -> reads ~/.claude.json -> { ...allExistingClaudeJsonKeys, mcpServers: merged }
  -> writes ~/.claude.json  (all other Claude settings preserved)
     |
     v
UI refreshes server list
```

## Testing

**New unit tests for `parseMcpCommand`:**
- Valid `claude mcp add --transport http name url`
- Valid `claude mcp add --transport stdio name -- npx -y package`
- Valid `gemini mcp add --transport http name url`
- Valid `gemini mcp add --trust name /path/to/server`
- `--env KEY=VALUE` parsing (single and multiple)
- `--header "K: V"` parsing
- Error: missing server name
- Error: missing URL for http/sse transport
- Error: missing command for stdio
- Error: malformed `--env` (no `=`)
- Error: wrong command prefix

**Updated backend handler tests (`configHandlers.test.ts`):**
- `getMcp` for `claude-code` reads `~/.claude.json`, not `configDir/settings.json`
- `getMcp` for `gemini` reads `configDir/settings.json`
- `saveMcp` merge preserves unrelated keys in `~/.claude.json`
- `saveMcp` aborts (returns error) when target file is malformed JSON
- `saveMcp` creates new file when ENOENT (empty base `{}`)
- `getMcp` returns `{ exists: false, data: { mcpServers: {} } }` on ENOENT

**New component tests for `McpCommandEditor`:**
- Renders empty state when no servers
- Parses valid command and adds server on submit
- Shows inline error on invalid command submit
- Calls delete handler and removes server from list
- Preserves `disabled` field on existing servers after re-save
- Shows error when submitted server name already exists in current config (duplicate check is component-level, requires knowledge of loaded server list)

**Deleted tests:**
- All tests in `useMcpSettings` describe block within `src/renderer/hooks/__tests__/useConfig.test.ts` — remove block, remove `useMcpSettings` import

**Unchanged:**
- `JsonFileEditor.test.tsx` — Copilot MCP path uses existing component with no new logic

## Out of Scope

- MCP server enable/disable toggle for any agent (deferred)
- Scope selection (local/project/user for Claude) — always writes user-scope `~/.claude.json`
- Copilot `/mcp show` status display
- Edit existing server (delete + re-add is the workaround)
