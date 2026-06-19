# Security Guards

> The renderer is untrusted input. Every path, name, or id that originates in the renderer and is
> used to touch the file system or build a CLI argument **must** pass a guard first. Guards throw;
> the handler's `try/catch` converts the throw into `failure(err)` (see [ipc-handlers.md](./ipc-handlers.md)).

## Core guards (`src/main/ipc/handlers/configUtils.ts`)

```typescript
// Rejects paths that resolve outside every allowed root (path traversal).
export function assertSafePath(inputPath: string, ...allowedRoots: string[]): void {
  const resolved = path.resolve(inputPath);
  const safe = allowedRoots.some((root) => {
    const rootResolved = path.resolve(root);
    return resolved === rootResolved || resolved.startsWith(rootResolved + path.sep);
  });
  if (!safe) {
    throw new Error('Access denied: path is outside allowed directories');
  }
}

// Rejects name/id values that contain path separators or traversal sequences.
export function assertSafeName(name: string): void {
  if (!name || /[/\\]/.test(name) || name === '..' || name.includes('..')) {
    throw new Error(`Invalid name: "${name}"`);
  }
}
```

- Use **`assertSafePath(input, ...roots)`** whenever the renderer supplies a *path* you will read,
  write, or delete. Pass the legitimate roots (typically `os.homedir()` or a specific config dir) so
  the resolved path is confined to them. `path.resolve` collapses `..` before the prefix check, so
  `~/.claude/../../etc/passwd` is rejected.
- Use **`assertSafeName(name)`** whenever the renderer supplies a *single path component* (a skill
  id, rule folder name, subagent name) that you will join into a path. It blocks `/`, `\`, and any
  `..`, so the value can only ever name a child, never escape the directory.

## CLI-specific guards (`src/main/ipc/handlers/cliRunner.ts`)

The plugin/marketplace surface needs stricter, format-aware validation before arguments reach
`spawn`:

```typescript
function assertSafeMarketplaceName(name: string): void {
  if (!name) throw new Error('invalid marketplace name: empty');
  if (/[/\\]/.test(name)) throw new Error(`...path separator: "${name}"`);
  if (name.includes('..')) throw new Error(`...contains "..": "${name}"`);
  if (/[;&|`$<>"'\s]/.test(name)) throw new Error(`...shell metacharacters in "${name}"`); // defence in depth
}

function assertSafePluginId(pluginId: string): void {            // must be name@marketplace
  if (!pluginId || !pluginId.includes('@')) throw new Error(`invalid plugin id: "${pluginId}"`);
  const [name, marketplace, ...rest] = pluginId.split('@');
  if (rest.length) throw new Error(`too many '@' in "${pluginId}"`);
  if (!name || !marketplace) throw new Error(`invalid plugin id: "${pluginId}"`);
  assertSafeName(name);
  assertSafeMarketplaceName(marketplace);
}
```

The shell-metacharacter check is **defence in depth** — we already spawn with `shell: false`
([cli-runner.md](./cli-runner.md)), but rejecting metacharacters keeps malformed input from ever
reaching the child process.

## Where guards are applied (real call sites)

- `rulesHandler.ts` — `createRule` / `deleteRuleFolder`: `assertSafePath(rulePath, configDir)` and
  `assertSafeName(folderName)` before creating/removing under `~/.claude/rules`.
- `skillsHandler.ts` — `deleteSkill` / `saveSkill`: `assertSafeName(skillId)` before joining into the
  skills directory.
- `cliRunner.ts` — `runPluginInstall` / `runMarketplaceAdd`: `assertSafePluginId` /
  `assertSafeMarketplaceName` before building the whitelisted arg vector.

## Rules

1. **Guard before the side effect, not after.** Validate at the top of the handler/helper, before any
   `fs.*`, `spawn`, or `path.join` that uses the value.
2. **Choose the right guard.** Full path the renderer controls → `assertSafePath`. Single component
   you will join → `assertSafeName`. Plugin/marketplace identifiers → the cliRunner guards.
3. **Let guards throw.** Don't pre-check and branch — call the guard and rely on the handler's
   `try/catch` → `failure(err)`. The thrown message is already renderer-safe.
4. **Adding a new FS-touching handler is incomplete without a guard.** Reviewers should reject any
   renderer-supplied path/name reaching the file system unguarded.
