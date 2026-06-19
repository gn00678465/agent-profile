# CLI Runner — Spawning the `claude` Binary

> `src/main/ipc/handlers/cliRunner.ts` is the **only** module allowed to spawn the `claude` binary.
> Read this before adding or changing any CLI interaction. The whole module is a security boundary.

## Hard rules

- **No shell.** Always `child_process.spawn(cmd, args, { shell: false, windowsHide: true })`.
  `exec` / `execSync` are forbidden everywhere — they re-introduce shell parsing of arguments.
- **Whitelist gate.** Only the fixed set of argument patterns is allowed. `isWhitelisted(args)` and
  the `runWith(args)` wrapper are mandatory gates — nothing spawns unless the arg vector matches an
  approved pattern. The approved patterns are:
  - `plugin marketplace add|remove|update|list --json`
  - `plugin install|uninstall <id> --scope <user|project|local>`
  - `plugin enable|disable <id>` *(but see DV5 below — usually not spawned)*
  - `plugin reload`
  - `--version`
  - `plugin --help`
- **Input validation before building args.** Marketplace name → `assertSafeMarketplaceName`; plugin
  id → `assertSafePluginId`; scope ∈ `user|project|local`; git URL must match
  `L6 = /^(https:\/\/[\w./@:-]+|git@[\w./:-]+:[\w./-]+|github:[\w-]+\/[\w.-]+)$/`; directory paths
  reject NUL/CR/LF/tab. Any validation failure → `return { success: false, error }`, **never spawn**.
  (See [security-guards.md](./security-guards.md).)
- **Timeout.** 60 s → `SIGTERM`; 5 s grace → `SIGKILL`; result is
  `{ success: false, error: "claude CLI timeout (60s)" }`.
- **Binary detection.** Windows uses `where claude` (resolves `%PATHEXT%`: `claude.cmd` →
  `claude.exe` → `claude.bat`); macOS/Linux use `which claude`. Not found →
  `{ success: false, error: "claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup" }`.
  The resolved path is cached in-process.

## Structure

```
Commands.*              # pure builders → return an approved arg vector (string[])
isWhitelisted(args)     # boolean gate: does this vector match an approved pattern?
runRaw(cmd, args)       # spawn(shell:false) + timeout/kill + stdout/stderr capture
detectBinary()          # which/where + PATHEXT resolution, cached
runWith(args)           # detectBinary() → runRaw(bin, args); the only public run path
run*(...)               # per-command wrappers: validate → Commands.build → runWith
```

A handler must call a `run*` wrapper (which validates and builds), or `runWith` with a
`Commands.*`-built vector — never assemble raw args and spawn directly.

## DV5 — enable/disable bypasses the CLI

`plugin enable` / `plugin disable` do **not** go through `cliRunner`. They write
`~/.claude/settings.json#enabledPlugins` directly (see `claudePluginsHandler.ts`), avoiding spawn
overhead and a hard dependency on the binary being installed. Keep this path file-based.

## Adding a new CLI command (required steps)

1. Add the new token pattern to the **L4 whitelist** in `isWhitelisted`.
2. Add a `Commands.*` builder **and** its `assertSafe*` validation for every dynamic argument.
3. Add a `run*(args)` wrapper that validates, builds, and calls `runWith`.
4. Add a **vitest case that covers the reject path** (malformed input must not spawn) alongside the
   happy path.
5. Have the corresponding IPC handler delegate to the new `run*` builder.

Skipping any step (especially the whitelist entry or the reject-path test) means the change is not
done. An arg vector that is not whitelisted must be impossible to spawn.

## Anti-patterns

```typescript
// WRONG — shell parsing, injection surface
execSync(`claude plugin install ${pluginId}`);

// WRONG — bypasses isWhitelisted / validation
spawn('claude', userProvidedArgs, { shell: true });

// CORRECT — validated, built, gated, no shell
const args = Commands.pluginInstall(pluginId, scope); // after assertSafePluginId + scope check
return runWith(args);                                  // runRaw uses shell:false + 60s timeout
```
