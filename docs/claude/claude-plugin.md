# Claude Plugin — 開發者使用指南

> **對象**：擴充 / 維護 ClaudePlugins 頁面與 cliRunner 的開發者。
> **配對閱讀**：`docs/CLAUDE_PLUGIN_LAYOUT.md`（`~/.claude/` 真實檔案佈局 schema）為本文件的單一事實來源；本文件聚焦「如何在程式碼中使用 / 擴充」。

---

## 1. 系統概觀

`feat-019` 把 ClaudePlugins 頁面對齊官方 `/plugin` 4-tab 模型（Installed / Marketplaces / Discover / Errors），分三層：

```
┌─────────────────────────────────────────────────────────────┐
│ Renderer  src/renderer/components/agents/ClaudePlugins/    │
│  ├── ClaudePlugins.tsx              4-tab router (lazy)    │
│  ├── InstalledTab.tsx               已安裝清單 + filter    │
│  ├── PluginManifestPanel.tsx        詳細面板                │
│  ├── MarketplacesTab.tsx            市場列表                 │
│  ├── MarketplaceDialog.tsx          + Add Marketplace       │
│  ├── DiscoverTab.tsx                可安裝外掛 + scope      │
│  ├── ErrorsTab.tsx                  錯誤聚合 + counter      │
│  └── FilterToolbar.tsx              all / user / project   │
└─────────────────────────────────────────────────────────────┘
                         ↑↓ IPC envelope { success, data?, error? }
┌─────────────────────────────────────────────────────────────┐
│ Preload   src/preload/index.ts                             │
│  electronAPI.config.getClaude{Plugins,Marketplaces,...}    │
│  electronAPI.claudeCli.{marketplaceAdd,pluginInstall,...}  │
└─────────────────────────────────────────────────────────────┘
                         ↑↓
┌─────────────────────────────────────────────────────────────┐
│ Main      src/main/ipc/handlers/                            │
│  ├── claudePluginsHandler.ts        5 read + 6 CLI handler │
│  └── cliRunner.ts                   spawn(claude) gateway  │
└─────────────────────────────────────────────────────────────┘
                         ↑↓
              ~/.claude/{settings.json, plugins/*}
              `claude` CLI binary (PATH detection)
```

**一條鐵律**：renderer 永不直呼 Node API；所有 FS / spawn 走 `callElectron(() => electronAPI()...)`。IPC handler 永不 throw 過 boundary，全部回 envelope `{ success, data? } | { success: false, error }`。

---

## 2. 型別速查（`src/shared/types.ts`）

### `ClaudePlugin` — 已安裝外掛單筆
```ts
interface ClaudePlugin {
  id: string;                    // "name@marketplace"
  name: string;
  marketplace: string;
  scope: 'user' | 'project' | 'managed';
  projectPath?: string;          // scope=project|local 時必有
  installPath: string;
  version: string;
  installedAt: string;
  lastUpdated: string;
  gitCommitSha?: string;
  enabled?: boolean;
  // manifest extensions
  description?: string;
  author?: { name: string; email?: string; url?: string };
  homepage?: string;
  repository?: string;
  license?: string;
  category?: string;
  components?: { skills, agents, hooks, mcp, lsp, monitors };
}
```

> **主鍵是 4-tuple `(id, scope, projectPath ?? '', installPath)`**。常見地雷：sentry-skills / harness 同 plugin 同 scope=`local` 但 `projectPath` 不同（從不同專案 install）會出現多筆 — 漏掉 `projectPath` 會撞 React key。

### `ClaudeMarketplace` — 已註冊市場
```ts
interface ClaudeMarketplace {
  name: string;
  source: ClaudeMarketplaceSource;   // 5 種 discriminated union（見下）
  installLocation: string;            // empty 字串 = unsynced（只在 settings.json）
  lastUpdated?: string;
  autoUpdate: boolean;                // official 強制 true（內建邏輯）
  isOfficial: boolean;                // claude-plugins-official only
  pluginCount: number;
  unsynced?: boolean;                 // RC6: extraKnownMarketplaces 衝突
}
```

### `ClaudeMarketplaceSource` — 5 種來源
```ts
type ClaudeMarketplaceSource =
  | { source: 'github';     repo: string }                      // owner/name
  | { source: 'git';        url: string; ref?: string; sha?: string }
  | { source: 'git-subdir'; url: string; path: string; ref?: string; sha?: string }
  | { source: 'url';        url: string; sha?: string }
  | { source: 'directory';  path: string };                     // 本機路徑 symlink
```

### 其他
- `ClaudePluginDiscoveryItem` — Discover tab 用（含 `installed: boolean`）
- `ClaudePluginError` — Errors tab 用 `{ scope: 'plugin'|'marketplace'|'cli', targetId, severity, message, raisedAt }`
- `CliRunResult` — cliRunner 統一回傳格式 `{ success, exitCode?, stdout?, stderr?, error? }`

---

## 3. IPC Channels（共 9 個 feat-019 新增）

| Channel 字串 | preload 方法 | 用途 |
|---|---|---|
| `config:get-claude-plugins` | `config.getClaudePlugins(configDir)` | manifest-enriched 已安裝清單 |
| `config:get-claude-marketplaces` | `config.getClaudeMarketplaces(configDir)` | 已註冊市場（known + extra 合併） |
| `config:get-claude-plugin-discovery` | `config.getClaudePluginDiscovery(configDir, marketplaceName)` | 指定市場可安裝清單 |
| `config:get-claude-plugin-errors` | `config.getClaudePluginErrors(configDir)` | 累積錯誤 |
| `claude-cli:marketplace-add` | `claudeCli.marketplaceAdd(name, source)` | 走 CLI 註冊新市場 |
| `claude-cli:marketplace-remove` | `claudeCli.marketplaceRemove(name)` | 走 CLI 解除市場 |
| `claude-cli:marketplace-update` | `claudeCli.marketplaceUpdate(name)` | 走 CLI refresh 市場 |
| `claude-cli:plugin-install` | `claudeCli.pluginInstall(pluginId, scope)` | 走 CLI 安裝外掛 |
| `claude-cli:plugin-uninstall` | `claudeCli.pluginUninstall(pluginId, scope)` | 走 CLI 解除安裝 |
| `claude-cli:reload` | `claudeCli.reload()` | 等同 `/reload-plugins` |

**plugin enable/disable** 走的是既有 `config.setPluginEnabled(configDir, pluginId, enabled)` 直接寫 `settings.json#enabledPlugins`，**不**走 cliRunner（DV5：避免 spawn 開銷）。

> F1 grep `CLAUDE_(CLI|PLUGINS)_` 還包含 3 個 alias 常數 (`CLAUDE_PLUGINS_GET_*`)，是純 export 別名，channel 字串值與 L1 canonical 名一致。詳見 `src/shared/types.ts` 註解。

---

## 4. cliRunner — spawn(claude) 唯一入口

`src/main/ipc/handlers/cliRunner.ts` 是**唯一**允許 spawn `claude` binary 的模組。任何其他地方 spawn 都應該被拒絕（`scripts/check-architecture.sh` 不檢這條，靠 code review）。

### 4.1 安全約束（每條動 cliRunner 前必讀）

| 約束 | 強制方式 | 違反 → |
|---|---|---|
| `shell: false` 永遠 | hardcoded 在 `runRaw()` | 引入 shell injection 風險 |
| 禁用 `exec` / `execSync` | 整個檔案不 import | 同上 |
| 11-token 白名單 (L4) | `isWhitelisted(args)` + per-command builders | `runWhitelisted` 回 `command not whitelisted` |
| Marketplace name 過濾 | `assertSafeMarketplaceName()` 拒 `..` / 路徑分隔 / shell 元字元 | builder throw → caller catch → `{ success: false, error: 'invalid marketplace name: ...' }` |
| Plugin id 格式 | `assertSafePluginId()` 強制 `name@marketplace` | 同上 |
| Scope 限制 | `assertSafeScope()` 限 `user|project|local` | 同上 |
| Git URL 限制 | `L6` regex `/^(https://...|git@...:...|github:owner/repo)$/` | `runMarketplaceAdd` builder throw |
| Directory path | `hasControlChars()` 拒 NUL / CR / LF / tab | 同上 |
| 60 s timeout | `setTimeout` → `SIGTERM` → +5 s grace → `SIGKILL` | 回 `{ success: false, error: 'claude CLI timeout (60s)' }` |
| Binary detection | `where claude` (Win) / `which claude` (Unix) | 回 `{ success: false, error: 'claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup' }` |

### 4.2 11 條白名單（L4）

```
plugin marketplace add    <name> <source-arg>
plugin marketplace remove <name>
plugin marketplace update <name>
plugin marketplace list   --json
plugin install   <id> --scope <user|project|local>
plugin uninstall <id> --scope <user|project|local>
plugin enable    <id>           ← 預留，目前走 setPluginEnabled (DV5)
plugin disable   <id>           ← 同上預留
plugin reload
--version
plugin --help
```

### 4.3 新增 cliRunner 指令（5 步 SOP）

```
1. 在 isWhitelisted(args) switch 加新的 token pattern (L4)
2. 在 Commands.* 加 builder + 對應 assertSafe* 校驗
3. 加 export async function run<Name>(...) — 包 try/catch 回 { success: false } 而不是 throw
4. 加 vitest case 涵蓋至少：(a) success path、(b) reject 不合法輸入、(c) reject 非白名單
5. 在 claudePluginsHandler 加 ipcMain.handle 委派至新 builder
```

> 任何新指令都會 patch 到 sprint contract L4 lock-in — 應該配合 evaluator 重評（避免和現行合約 drift）。

### 4.4 公開 API

```ts
// src/main/ipc/handlers/cliRunner.ts
export async function detectBinary(): Promise<string | null>;
export async function runMarketplaceAdd(name: string, source: ClaudeMarketplaceSource): Promise<CliRunResult>;
export async function runMarketplaceRemove(name: string): Promise<CliRunResult>;
export async function runMarketplaceUpdate(name: string): Promise<CliRunResult>;
export async function runMarketplaceListJson(): Promise<CliRunResult>;
export async function runPluginInstall(pluginId: string, scope: string): Promise<CliRunResult>;
export async function runPluginUninstall(pluginId: string, scope: string): Promise<CliRunResult>;
export async function runPluginReload(): Promise<CliRunResult>;
export async function runWhitelisted(args: string[]): Promise<CliRunResult>;  // 給測試用
export function isWhitelisted(args: string[]): boolean;
export function _resetBinaryCache(): void;                                    // 給測試用
```

---

## 5. claudePluginsHandler — 5 reads + 6 CLI delegates

### 5.1 讀取流程

```
loadInstalledPlugins(configDir)
  ├── readJsonFile(installed_plugins.json)
  │     - ENOENT  → exists:false data:null         → return []  (RC2)
  │     - corrupt → exists:true  data:null error:..→ pushError + throw (RC3)
  ├── readJsonFile(settings.json) → enabledPlugins
  ├── for each pluginId × installs:
  │     - 4-tuple dedupe (sentry-skills 場景)
  │     - readPluginManifest(installPath)
  │         ├── read .claude-plugin/plugin.json      → 各欄位
  │         └── 列舉 skills/ agents/ hooks/ .mcp.json .lsp.json monitors/
  │     - merge into ClaudePlugin
  └── return ClaudePlugin[]
```

```
loadMarketplaces(configDir)
  ├── readJsonFile(known_marketplaces.json)         → CLI 寫的市場
  ├── readJsonFile(settings.json)                    → extraKnownMarketplaces
  ├── merge:
  │     - known_marketplaces 為主
  │     - extraKnownMarketplaces 同名同 source → 略過
  │     - extraKnownMarketplaces 同名異 source → unsynced=true (RC6)
  │     - extraKnownMarketplaces 純新 → unsynced=true installLocation=''
  └── return ClaudeMarketplace[]
```

```
loadDiscovery(configDir, marketplaceName)
  ├── 取 known_marketplaces[marketplaceName].installLocation
  ├── readFile(<installLocation>/.claude-plugin/marketplace.json)
  ├── intersect with installed_plugins.json → installed flag
  └── return ClaudePluginDiscoveryItem[]
```

### 5.2 errorBuffer 模型

`errorBuffer: ClaudePluginError[]` 是 module-level 累積：
- `loadInstalledPlugins` / `loadMarketplaces` / `loadDiscovery` 遇到 corrupt JSON / missing file 等 → `pushError(...)`（dedup 同 scope+targetId+message）
- `loadErrors` 每次被呼叫時先重跑 `loadInstalledPlugins` + `loadMarketplaces` 讓 buffer 重新填充，再回 `[...errorBuffer]`
- 測試用 `_resetErrorBufferForTests()` 重置

### 5.3 註冊樣板（compact via wrap()）

```ts
function wrap<Args, R>(fn: (...args: Args) => Promise<R>) {
  return async (_event, ...args) => {
    try { return success(await fn(...args)); }
    catch (err) { return failure(err); }
  };
}

// 11 行搞定 11 個 handler 註冊：
ipcMain.handle(IPC_CHANNELS.CONFIG_GET_CLAUDE_PLUGINS, wrap(loadInstalledPlugins));
ipcMain.handle(IPC_CHANNELS.CLAUDE_CLI_MARKETPLACE_ADD, wrap((name, src) => runMarketplaceAdd(name, src)));
// ...
```

> 檔案 ≤ 400 行（maintainability cap）— 目前 397。新加 handler 時若超出，先 `wrap()`-ize 或抽 helper。

---

## 6. UI 元件規範（feat-018 token 沿用）

### 6.1 D-grep 必過閾值

| 檢查 | 規則 | 工具 |
|---|---|---|
| D1 | 0 hard-coded Tailwind palette colors（`bg-blue-500/20` 等一律禁） | `grep -rnE "(bg|text|border)-(blue|amber|green|...)-(50..900)(/[0-9]+)?"` |
| D2 | 0 inline hex border (`border-[#...]` / `borderColor: '#...'`) | `grep -rnE "border-\[#|borderColor:\s*['\"]#"` |
| D3 | 0 inline numeric width (`minWidth: 320` 等) | `grep -rnE "minWidth:\s*[0-9]\|maxWidth:\s*[0-9]"` |
| D4 | `badge-notion` ≥ 5（feat-019 落地 17） | `grep -rn "badge-notion"` |
| D5 | `shadow-notion-card` 或 `border-whisper` ≥ 4（feat-019 落地 14） | `grep -rnE "shadow-notion-card\|border-whisper"` |
| D6 | 每個新元件 ≥ 1 個 import 自 `@/components/ui/` | `grep -lE "from '@/components/ui/(button\|card\|tabs\|switch\|dialog\|select\|scroll-area)'"` |

### 6.2 ClaudePlugins 元件對應

| 元件 | 主用 ui primitive | scope |
|---|---|---|
| `ClaudePlugins.tsx` | `tabs` | router、lazy-mount via `visited: Set` |
| `InstalledTab.tsx` | `switch`, FilterToolbar | 4-tuple plugin identity；4 scope filter |
| `PluginManifestPanel.tsx` | `switch`, `remove-button` | 顯示 manifest + components badges + projectPath meta row |
| `MarketplacesTab.tsx` | `button`, `switch`, `card` | auto-update Switch **disabled (read-only)** — feat-020 待補寫入 |
| `MarketplaceDialog.tsx` | `dialog`, `button`, `switch`, `input`, `label` | 4 source-type radio + 動態欄位 |
| `DiscoverTab.tsx` | `button`, `card`, `dialog` | scope chooser dialog (User/Project/Local) |
| `ErrorsTab.tsx` | `card`, ExtensionListLayout | counter badge via `onCountChange` callback |

### 6.3 Lazy-mount 機制（重要）

`ClaudePlugins.tsx` 用一個 `visited: Set<TabValue>` 追蹤被點過的 tab，**只有被點過的 tab 才會 mount 對應子元件**：

```tsx
const [visited, setVisited] = useState(() => new Set(['installed']));
// onTabChange: setVisited(prev => new Set(prev).add(next))
<TabsContent value="marketplaces">
  {visited.has('marketplaces') && <MarketplacesTab ... />}
</TabsContent>
```

**為什麼**：原本 `ClaudePlugins.test.tsx` 的 7 個 case 假設「初始 render 只發一個 IPC call」(getClaudePlugins)。如果所有 tab 都 eager-mount，每個 tab 的 `useEffect` 都會發 IPC，那些 case 的 `expect(callElectron).toHaveBeenCalledTimes(1)` 會壞掉（R5 不可破）。lazy-mount 讓既有 assertion 仍成立，又能在切 tab 時觸發 IPC。

---

## 7. 測試覆蓋

### 7.1 各檔案 case 數

| 檔案 | cases |
|---|---|
| `src/main/ipc/__tests__/cliRunner.test.ts` | 6（binary not found / SIGTERM / whitelist reject / unsafe name / illegal git URL / success exit） |
| `src/main/ipc/__tests__/claudePluginsHandler.test.ts` | 6（parse + components / dedupe duplicates / missing file / corrupt JSON / merge known + extra / discovery installed flag） |
| `src/renderer/components/agents/__tests__/ClaudePlugins.test.tsx` | 11（既有 7 + S3-3 新 4） |
| `MarketplacesTab.test.tsx` | 3 |
| `DiscoverTab.test.tsx` | 3 |
| `ErrorsTab.test.tsx` | 3 |
| `MarketplaceDialog.test.tsx` | 3 |

合計 baseline 378 + feat-019 新 28 = **406 tests**（V3 gate: ≥ 405）。

### 7.2 跑單檔測試

```bash
bunx vitest run src/main/ipc/__tests__/cliRunner.test.ts
bunx vitest run src/renderer/components/agents/__tests__/MarketplaceDialog.test.tsx
```

### 7.3 新增元件測試常見坑

- **Radix Dialog 需要 `ResizeObserver` polyfill**：在 test file 頂部 `class ROStub { observe(){} unobserve(){} disconnect(){} } (globalThis as any).ResizeObserver = ROStub;`（`src/test/setup.ts` 受 sprint contract Exclusions 保護不能改）。
- **Radix Tabs 不認 `fireEvent.click`**：用 `userEvent.setup()` + `await user.click(trigger)`。
- **Disabled 按鈕 hover** 需要 `force: true`：`await locator.hover({ force: true })`。
- **`getByLabel('Name')` strict-mode violation**：當其他 label 含 "Name"（如 "GitHub repo (owner/name)"）會 ambiguous → 用 `getByLabel('Name', { exact: true })`。

---

## 8. 邊界情況清單

| 情境 | Handler 行為 | RC 對應 |
|---|---|---|
| `installed_plugins.json` 缺檔 | `{ success: true, data: [] }` | RC2 |
| `installed_plugins.json` 損毀 | `{ success: false, error }` + push errorBuffer | RC3 |
| `known_marketplaces.json` 與 `extraKnownMarketplaces` 同名衝突 | known 為準，extra 標 `unsynced` | RC6 |
| `marketplace.json` 不存在（directory 來源指向不存在） | `{ success: true, data: [] }` + push errorBuffer | — |
| `installPath` 是 symlink | resolve 後跑 `assertSafePath` | PE4 |
| `installPath` 不存在 | components 計數 fallback 全 0 / false | — |
| `source.source` 未知 schema | UI 顯示 `unknown` source pill | — |
| `claude` binary 不在 PATH | cliRunner 直接回 NOT_FOUND_MSG | RC1 |
| CLI 超過 60 s | SIGTERM → 5 s 後 SIGKILL → `{ success: false, error: 'claude CLI timeout (60s)' }` | RC4 |
| Marketplace 名含 `..` / `;` | `assertSafeMarketplaceName` throw → cliRunner catch → invalid name error | RC5 |
| Git URL 不符 L6 | builder throw → invalid git URL | C4 |
| Plugin enable/disable | 走 `setPluginEnabled` 直接寫 settings.json | DV5 |
| Managed scope plugin | UI 顯示但 toggle / delete disabled | DV1 |
| `claude-plugins-official` Remove | 永久 disabled + tooltip | DV2 |
| Auto-update Switch 點擊 | **目前 read-only（disabled）** — 寫入路徑待 feat-020 | feat-020 |

---

## 9. 自動化截圖（dev-only）

`scripts/capture-evidence.cjs` 重新生成 M1-M14 + m4-no-binary 證據截圖：

```bash
bun run build                    # 必須先 build
node scripts/capture-evidence.cjs
# 輸出至 evidence/feat-019/m{1..14}.png + m4-no-binary.png + capture.log
```

**機制**：
1. spawn `node_modules/electron/dist/electron.exe`（直接 .exe，不走 .cmd shim — 才能讓 `HOME`/`USERPROFILE` env 真的 propagate 到 `os.homedir()`）
2. 加 `--remote-debugging-port=9222`（renderer V8 CDP，**不是** Node `--inspect`）
3. 加 `--user-data-dir=<temp>`（避免 Chromium state 跨 pass leak）
4. Playwright `chromium.connectOverCDP('http://127.0.0.1:9222')` 接管
5. 兩個 pass：
   - **Pass 1 (real)**：用真實 `~/.claude/` → M1-M11
   - **Pass 2 (mocked)**：建 TEMP `~/.claude/`，寫 `installed_plugins.json = '{not valid json'` → M12-M14 + m4-no-binary

> **這個技術同時是 feat-016 E2E 解封路徑** — `_electron.launch()` 卡的 STATUS_BREAKPOINT 是 `--inspect=0` Node inspector 的 V8 bug；`--remote-debugging-port` 走的是 renderer V8 CDP，完全不同 protocol。把 `e2e/fixtures.ts` 從 `_electron.launch()` 改成 `connectOverCDP` 模式即可解封 feat-016。

---

## 10. 對照官方文件 — 已 cover / 未 cover

| 官方功能 | feat-019 狀態 |
|---|---|
| `/plugin` 4-tab UI | ✅ 對齊 |
| Installed plugin manifest 顯示 | ✅ 含 author / homepage / repository / license / category / components |
| Marketplaces add/remove/update | ✅ via cliRunner |
| Discover plugin install (user/project/local) | ✅ via cliRunner |
| Errors tab + counter badge | ✅ |
| `claude-plugins-official` 內建 | ✅ Built-in pill + Remove disabled |
| `extraKnownMarketplaces` 偵測 | ✅ unsynced warn pill |
| Plugin enable / disable | ✅ via `setPluginEnabled`（DV5：不走 CLI） |
| `--scope managed`（受管設定） | ⚠️ 顯示但 toggle / delete disabled (DV1) |
| Plugin developer mode (`--plugin-dir`) | ❌ FC2（待新 DevTab） |
| LSP code-intelligence diagnostics | ❌ FC1（型別已預留） |
| Plugin 提交至官方 marketplace UI | ❌ exclusions |
| Auto-update flag 寫入 | ⚠️ feat-020 規劃中（目前 read-only） |
| Background monitor 觸發 | ❌ exclusions |

---

## 11. 進一步閱讀

- `docs/CLAUDE_PLUGIN_LAYOUT.md` — `~/.claude/` 真實檔案 schema（單一事實來源）
- `sprint-contract.md` — feat-019 完整 lock-in（L1-L7、DV1-DV5、PE1-PE5、FC1-FC4、RC1-RC6）
- `evaluator-rubric.md` — 6 維評分準則 + 評分結果（ACCEPT 28/30）
- `evidence/feat-019/` — 完整驗證證據（V/F/C/D/M/R/RC）
- 官方文件（合約 Requirement Sources）：
  - https://code.claude.com/docs/zh-TW/plugins
  - https://code.claude.com/docs/zh-TW/discover-plugins
- `AGENTS.md` §「Claude Plugins / CLI Runner — 規則」+ §「Evidence Capture Driver」
