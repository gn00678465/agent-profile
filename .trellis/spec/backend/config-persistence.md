# Config Persistence — JSON & Markdown Files

> There is **no database**. The app's entire state is the agent config files on disk: JSON
> (`settings.json`, `installed_plugins.json`, MCP configs…), Markdown (`CLAUDE.md`, `GEMINI.md`,
> rules, skills), and JSONL session logs. The app reads and writes them in place.

## Config roots

| Agent | Config root |
|-------|-------------|
| Claude Code | `~/.claude/` |
| GitHub Copilot CLI | `~/.copilot/` (and `~/.config/copilot/`) |
| Gemini CLI | `~/.gemini/` |
| Shared skills | `~/.claude/` (linked into per-agent dirs) |

The actual `configDir` is supplied by the renderer and **must be guarded** before use
(`assertSafePath` / `assertSafeName`, see [security-guards.md](./security-guards.md)). App-level
roots come from `app.getPath('home')` / `app.getPath('userData')` exposed via the `app.*` IPC
handlers — the renderer never calls `os.homedir()` itself.

## Reading: `readJsonFile<T>()`

`src/main/ipc/handlers/configUtils.ts` is the canonical reader. It **never throws on a missing
file** — it distinguishes "absent" from "corrupt" so the UI can show an empty state vs. an error:

```typescript
export async function readJsonFile<T>(filePath: string): Promise<ConfigFile<T>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    return { path: filePath, exists: true, data: JSON.parse(content) as T };
  } catch (err) {
    const isNotFound = err instanceof Error && 'code' in err
      && (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) return { path: filePath, exists: false, data: null };   // absent → not an error
    return { path: filePath, exists: true, data: null,                       // present but unparseable
             error: err instanceof Error ? err.message : String(err) };
  }
}
```

Callers must handle all three states: `exists: false` (no file yet), `data: null` + `error` (corrupt
JSON), and the happy path. Do **not** assume `data` is non-null.

## Writing: `writeJsonFile()`

```typescript
export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });            // create parent dirs
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');   // 2-space pretty-print
}
```

- Always `mkdir({ recursive: true })` first — the target directory may not exist yet.
- Always pretty-print with `JSON.stringify(data, null, 2)`; these files are user-editable, so keep
  them diff-friendly.

## Rules

1. **Never read/write config with bare `fs` in a handler** when `readJsonFile` / `writeJsonFile`
   fit — they encode the missing-file and pretty-print conventions. Reserve raw `fs` for non-JSON
   content (Markdown, JSONL, ZIP extraction).
2. **Tolerate missing and corrupt files.** A config file not existing is the normal first-run state,
   not an error. Surface corruption via `ConfigFile.error`, not by throwing.
3. **Immutable edits.** When updating a settings object, build a new object
   (`{ ...settings, key: value }`) and write the whole thing back — don't mutate the parsed object in
   place. (See [`../shared/code-quality.md`](../shared/code-quality.md).)
4. **Preserve unknown keys.** These are real user files shared with the CLIs. When you parse, edit,
   and re-write, keep fields you don't manage — read the full object, spread it, change only what you
   own, write it back. Never replace a file with only the keys this app knows about.
5. **Types live in `shared/types.ts`.** `ClaudeSettings`, `GeminiSettings`, `CopilotConfig`,
   `McpSettings`, `ConfigFile<T>`, etc. are defined there and imported by both layers.
