# AGENTS.md

Agent Profile — Electron desktop app for managing AI agent settings (Claude Code, Gemini CLI, GitHub Copilot CLI).

## Startup Workflow

> **狀態與 handoff 由 Trellis 管理**（`.trellis/`）。本專案已從自訂 root harness（`feature_list.json` / `PROGRESS.md` / `SESSION-HANDOFF.md` / `SESSION-LOG.jsonl` / `init.sh`）**完整切換**到 Trellis；舊檔已凍結於 `docs/legacy-harness/`（僅供查歷史，不再維護）。

Before writing any code:

1. Read this file + `.trellis/workflow.md`（開發三階段、task 建立時機、skill 路由）
2. `python3 ./.trellis/scripts/task.py current --source` — 看目前 active task（若有）
3. `python3 ./.trellis/scripts/get_context.py` — 取得 session runtime（git 狀態、tasks、journal、近期 commits）
4. 看現役 / 已封存任務：`task.py list` 與 `task.py list-archive`（歷史 feature 在 archive `06-19-legacy-feat-001-019`）
5. 進入某層寫碼前，讀對應 `.trellis/spec/<package>/<layer>/index.md`
6. 驗證建置仍綠：`bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh`
7. **For any UI/UX work**: read `DESIGN.md` — the project's design system (Notion-inspired warm neutrals, typography, components, color tokens)

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

- **One task at a time.** 用 Trellis task 系統：一個 task 走完 plan → execute → finish 再開下一個（見 `.trellis/workflow.md`）。
- **Verification before done.** A feature is not done until `bun run test` + `bun run lint` both pass.
- **Never mutate objects.** Use spread/`structuredClone`.
- **IPC envelope.** Every IPC handler returns `{ success, data? }` or `{ success: false, error }`. Never throw across the IPC boundary.
- **Security guards.** Always call `assertSafePath` / `assertSafeName` for renderer-supplied inputs before touching the file system.
- **Design system compliance.** All UI changes must follow `DESIGN.md`: warm neutral palette, whisper borders (`1px solid rgba(0,0,0,0.1)`), Notion Blue (`#0075de`) for primary CTA, agent accent colors for interactive highlights.
- **Update state before ending.** 走 Trellis Phase 3：驗證閘 → spec update → commit → `add_session.py` 記錄 journal → `task.py archive`（見下方 End of Session）。
- **Reusable patterns** Update AGENTS.md files if you discover reusable patterns (see below)

## Claude Plugins / CLI Runner

`src/main/ipc/handlers/cliRunner.ts` 是唯一允許 spawn `claude` binary 的模組。完整契約已**正式下放到 `.trellis/spec/`**（單一事實來源），寫碼前讀對應文件：

- cliRunner（no-shell / 11 條 L4 白名單 / `isWhitelisted`+`runWith` 閘道 / 60 s timeout / binary detection / DV5 / 新增指令 5 步驟）→ `.trellis/spec/backend/cli-runner.md`
- IPC envelope（never throw across IPC、`success`/`failure`、handler 註冊）→ `.trellis/spec/backend/ipc-handlers.md`
- security guards（`assertSafePath`/`assertSafeName`/`assertSafeMarketplaceName`/`assertSafePluginId`）→ `.trellis/spec/backend/security-guards.md`
- config 持久化（`readJsonFile`/`writeJsonFile`、無 DB、JSON 檔模型）→ `.trellis/spec/backend/config-persistence.md`
- 4-layer 邊界 + import alias（由 `scripts/check-architecture.sh` 強制）→ `.trellis/spec/shared/architecture.md`

### Evidence Capture Driver (feat-019 dev-only)

`scripts/capture-evidence.cjs` spawns the production-built Electron app with `--remote-debugging-port=9222` (renderer V8 CDP — different mechanism from the `--inspect=0` Node inspector that crashes on Windows per `docs/E2E_BLOCKED.md`), connects via Playwright `chromium.connectOverCDP`, drives 14 UI scenarios + writes PNGs to `evidence/feat-019/m{1..14}.png` + `m4-no-binary.png`. Two passes: real `~/.claude/` (M1-M11) + mocked TEMP home with corrupt `installed_plugins.json` (M12-M14 + m4-no-binary). Run via `bun run build && node scripts/capture-evidence.cjs`. Out-of-whitelist by sprint contract Exclusions but kept because (a) dev-only — never shipped, (b) no production code touched, (c) unblocks the same E2E infrastructure feat-016 was waiting on (`connectOverCDP` works where `_electron.launch()` doesn't). `eslint.config.mjs` adds one ignore entry for this CJS script.

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
- Information already captured in the Trellis workspace journal (`.trellis/workspace/`) or task artifacts (`.trellis/tasks/`)

> 專案層級的編碼慣例（IPC、security guards、cliRunner、layer 邊界、frontend 模式）的**單一事實來源是 `.trellis/spec/`**——已由 task `00-bootstrap-guidelines`（focused pass）從 `trellis init` 通用範本改寫為本專案真實內容，並清除描述別專案的外來檔。AGENTS.md 僅留薄指標；進入某層寫碼前先讀對應 `.trellis/spec/<layer>/index.md`。

## Definition of Done

A task is complete when:

- [ ] Implementation matches the task's `prd.md`（acceptance criteria 全勾）
- [ ] `bun run test` passes (baseline ≥ 409 tests, 0 failures)
- [ ] `bun run lint` passes (0 errors, 0 warnings)
- [ ] `bun run typecheck` passes
- [ ] `bash scripts/check-architecture.sh` passes (0 violations)
- [ ] task.json status → `completed`（透過 `task.py archive`）
- [ ] 本次 session 已記錄到 workspace journal（`add_session.py`）
- [ ] 學到的慣例已寫回 `.trellis/spec/`（若適用）

## End of Session

走 Trellis **Phase 3**（若平台有 `/trellis:finish-work` 指令，優先用它）。手動步驟，**依序執行**：

### 1. Verification gates — all must be green
```bash
bun run typecheck && bun run lint && bun run test
bash scripts/check-architecture.sh
```

### 2. Spec update（若適用）
把本次學到的 pattern / 慣例 / bug 預防寫回 `.trellis/spec/<package>/<layer>/`（見 `trellis-update-spec`）。

### 3. Commit
遵循 conventional commits；逐項 `git add <file>`，**不要 `git add .`**。

### 4. 記錄 session 到 workspace journal
```bash
python3 ./.trellis/scripts/add_session.py --title "<標題>" --commit "<hash>" --summary "<一句話>"
```
> 用今天實際日期（`date +%Y-%m-%d`），勿沿用先前 context 的日期。

### 5. 收尾 task
完成的 task → `python3 ./.trellis/scripts/task.py archive <task-dir>`；中途暫停 → `task.py finish`（清 active pointer，status 不變）。

## Current Focus

所有歷史 feature（feat-001 ~ feat-019）已收口，凍結於 archive task `06-19-legacy-feat-001-019`（feat-016 為 blocked，其餘 done）。

**現役 / 待辦（用 `task.py list` 查最新）：**
- `06-19-feat-020-auto-update`（planned）— Marketplace auto-update Switch 寫入路徑
- feat-016 E2E — unblock via `chromium.connectOverCDP()`（見 `docs/E2E_BLOCKED.md`）
- Dark mode CTA contrast follow-up — `#ffffff` on `#62aef0` = 2.22:1, below 3:1 for large text
- Merge `feat/018-notion-ui` → `main`
- `00-bootstrap-guidelines`（in_progress）— ✅ focused pass 完成：`.trellis/spec/` 已從通用範本改寫為本專案真實內容（backend IPC/guards/cliRunner/config-persistence + shared architecture/ts/quality/git + frontend 4 檔 + big-question + guides 清矛盾），並刪除 29 個外來檔。剩餘（選擇性後續）：frontend components/hooks/css 深掘
<!-- TRELLIS:START -->
# Trellis Instructions

These instructions are for AI assistants working in this project.

This project is managed by Trellis. The working knowledge you need lives under `.trellis/`:

- `.trellis/workflow.md` — development phases, when to create tasks, skill routing
- `.trellis/spec/` — package- and layer-scoped coding guidelines (read before writing code in a given layer)
- `.trellis/workspace/` — per-developer journals and session traces
- `.trellis/tasks/` — active and archived tasks (PRDs, research, jsonl context)

If a Trellis command is available on your platform (e.g. `/trellis:finish-work`, `/trellis:continue`), prefer it over manual steps. Not every platform exposes every command.

If you're using Codex or another agent-capable tool, additional project-scoped helpers may live in:
- `.agents/skills/` — reusable Trellis skills
- `.codex/agents/` — optional custom subagents

Managed by Trellis. Edits outside this block are preserved; edits inside may be overwritten by a future `trellis update`.

<!-- TRELLIS:END -->
