# AGENTS.md

Agent Profile — Electron desktop app for managing AI agent settings (Claude Code, Gemini CLI, GitHub Copilot CLI).

## Startup Workflow

Before writing any code:

1. Read this file
2. Run `./init.sh` to verify the project builds and tests pass
3. Read `feature_list.json` to see what is done / in-progress
4. Read `PROGRESS.md` to see blockers, risks, and last session's endpoint
5. Read `SESSION-HANDOFF.md` to see last session's endpoint
5. **For any UI/UX work**: read `DESIGN.md` — the project's design system (Notion-inspired warm neutrals, typography, components, color tokens)

> `CLAUDE.md` is a pointer to this file — no need to read it separately.

## Commands

```bash
bun run dev          # Vite dev server + Electron (hot-reload)
bun run test         # Run all tests once via Vitest  ← always use `bun run test`, NOT `bun test`
bun run test:watch   # Watch mode
bun run lint         # ESLint check
bun run lint:fix     # ESLint autofix
bun run build        # Production build
bun run typecheck    # Type-check only
bun run electron:win # Build + package for Windows
```

Run a single test file:
```bash
bunx vitest run src/main/ipc/__tests__/configHandlers.test.ts
```

## Architecture

Electron + React 19 + TypeScript desktop app built with `vite-plugin-electron`. Full details in `docs/ARCHITECTURE.md`:

| Need… | Read the tagged section |
|-------|-------------------------|
| Layer boundaries, aliases, entry points | `<electron-layers>` |
| IPC envelope & wrapper | `<ipc-pattern>` |
| `assertSafePath` / `assertSafeName` usage | `<security-guards>` |
| Renderer file tree | `<component-map>` |
| Per-agent tab list | `<agent-tabs>` |
| Test layout, setup, coverage paths | `<testing-strategy>` |

**Load-bearing rules** (keep in mind at all times — enforced in Working Rules below):
- Never throw across the IPC boundary — always return `{ success, data? }` or `{ success: false, error }`.
- Always call `assertSafePath` / `assertSafeName` for renderer-supplied inputs.
- Renderer never imports Node APIs directly — all FS/OS calls go through `callElectron()`.

## Working Rules

- **One feature at a time.** Pick the first `in-progress` or `planned` item from `feature_list.json` and complete it before moving on.
- **Verification before done.** A feature is not done until `bun run test` + `bun run lint` both pass.
- **Never mutate objects.** Use spread/`structuredClone`.
- **IPC envelope.** Every IPC handler returns `{ success, data? }` or `{ success: false, error }`. Never throw across the IPC boundary.
- **Security guards.** Always call `assertSafePath` / `assertSafeName` for renderer-supplied inputs before touching the file system.
- **Design system compliance.** All UI changes must follow `DESIGN.md`: warm neutral palette, whisper borders (`1px solid rgba(0,0,0,0.1)`), Notion Blue (`#0075de`) for primary CTA, agent accent colors for interactive highlights.
- **Update state before ending.** Update `feature_list.json` (status + evidence) + `progress.md` (snapshot) + `session-log.jsonl` (append one line) + `session-handoff.md` (▶ 下次 Session 區塊) at the end of every session.
- **Reusable patterns** Update AGENTS.md files if you discover reusable patterns (see below)

## Claude Plugins / CLI Runner — 規則

`src/main/ipc/handlers/cliRunner.ts` 是唯一允許 spawn `claude` binary 的模組。修改前先讀本段。

- **No shell.** `child_process.spawn(cmd, args, { shell: false })`. `exec` / `execSync` 一律禁止 (C1, C2)。
- **Whitelist.** 只接受 11 條 token pattern (L4) — `plugin marketplace add|remove|update|list --json`、`plugin install|uninstall <id> --scope <user|project|local>`、`plugin enable|disable <id>`、`plugin reload`、`--version`、`plugin --help`。`isWhitelisted(args)` 與 `runWith(args)` 是強制閘道；任何新增 CLI 互動必須先擴 L4 白名單。
- **Input validation.** 市場名走 `assertSafeMarketplaceName` (拒 `..` / 路徑分隔 / shell 元字元)；plugin id 走 `assertSafePluginId` (拒非 `name@marketplace` 格式)；scope 限於 `user|project|local`；git URL 限於 regex `L6 = /^(https://[\w./@:-]+|git@[\w./:-]+:[\w./-]+|github:[\w-]+/[\w.-]+)$/`；directory path 拒 NUL/CR/LF/tab。任何驗證失敗 → 直接回 `{ success: false, error }`，**不 spawn**。
- **Timeout.** 60 s 觸發 `SIGTERM`；額外 5 s grace 後 `SIGKILL`；回 `{ success: false, error: "claude CLI timeout (60s)" }`。
- **Binary detection.** Windows 用 `where claude`（解析 `%PATHEXT%`：`claude.cmd` → `claude.exe` → `claude.bat`），macOS / Linux 用 `which claude`。找不到 → `{ success: false, error: "claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup" }`。結果在 process 內 cache。
- **DV5.** plugin enable/disable **不**走 cliRunner — 直接寫 `~/.claude/settings.json#enabledPlugins`，避免 spawn 開銷與 binary 依賴。

新增 cliRunner 指令的步驟：(1) 在 L4 加 token pattern；(2) 加 `Commands.*` builder + 對應 `assertSafe*` 校驗；(3) 加 `runWith(args)` 包裝函式；(4) 加 vitest case 涵蓋 reject path；(5) 對應 IPC handler 委派至新 builder。

## Update AGENTS.md Files

- **Identify directories with edited files** - Look at which directories you modified
- **Check for existing AGENTS.md** - Look for AGENTS.md in those directories or parent directories
- **Add valuable learnings** - If you discovered something future developers/agents should know:
    - API patterns or conventions specific to that module
    - Gotchas or non-obvious requirements
    - Dependencies between files
    - Testing approaches for that area
    - Configuration or environment requirements

**Examples of good AGENTS.md additions:**
- "When modifying X, also update Y to keep them in sync"
- "This module uses pattern Z for all API calls"
- "Tests require the dev server running on PORT 3000"
- "Field names must match the template exactly"

**Do NOT add:**
- Story-specific implementation details
- Temporary debugging notes
- Information already in `progress.md` or `session-log.jsonl`

## Definition of Done

A feature is complete when:

- [ ] Implementation matches the description in `feature_list.json`
- [ ] `bun run test` passes (378 tests, 21 files, 0 failures)
- [ ] `bun run lint` passes (0 errors, 0 warnings)
- [ ] `bun run typecheck` passes
- [ ] `feature_list.json` entry updated to `"status": "done"` with evidence
- [ ] `progress.md` 快照已更新（上次結束點）
- [ ] `session-log.jsonl` 已追加本次紀錄（一行 JSON）
- [ ] `session-handoff.md` 本次實際執行結果

## End of Session

Before ending a session, execute these steps **in order**:

### 1. Verification gates — all must be green
```bash
bun run typecheck && bun run lint && bun run test
bash scripts/check-architecture.sh
```

### 2. Append to `session-log.jsonl` — exactly one line, TODAY's date
> **CRITICAL:** Use today's actual date (`date +%Y-%m-%d`). Do NOT copy the date from previous session context.
> Check if today's entry already exists before appending to avoid duplicates.
```
{"date":"YYYY-MM-DD","summary":"<一句話>","tests":<N>,"lint_errors":0,"lint_warnings":0}
```

### 3. Update `session-handoff.md` — fill the "▶ 下次 Session 從這裡開始" block
Four fields, all required:
- **最後更新** → today's date (same as step 2)
- **驗證狀態** → actual gate results from step 1
- **上次動作** → one sentence summary of this session
- **下次起點** → concrete feat-id or action (not vague)

### 4. Update `feature_list.json` and `progress.md`
- `feature_list.json`: set completed items to `"status": "done"` with evidence; no stale `in-progress`
- `progress.md`: update feature table and "上次 Session 結束點" to match current state

### 5. Commit — exactly these 4 files, this exact format
```bash
git add feature_list.json progress.md session-log.jsonl session-handoff.md
git commit -m "chore: end-of-session handoff YYYY-MM-DD"
```
> Do NOT use `git add .` — only the 4 listed files belong in the handoff commit.

Full binary gate checklist: `clean-state-checklist.md`.

## Current Focus

All 18 features are **done** (feat-001 ~ feat-018). See `feature_list.json` for the full list with evidence.

**Next work candidates (add new features to `feature_list.json` as `planned` before starting):**
- feat-016 E2E tests — unblock via `chromium.connectOverCDP()` (see `docs/E2E_BLOCKED.md`)
- Dark mode CTA contrast follow-up — `#ffffff` on `#62aef0` = 2.22:1, below 3:1 for large text
- Merge `feat/018-notion-ui` → `main`
