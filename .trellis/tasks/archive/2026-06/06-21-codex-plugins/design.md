# Design — Codex Marketplace/Plugins tab

## 1. 架構總覽

```
Renderer (CodexPluginsView)
  ├─ Marketplaces tab ──┐
  └─ Plugins tab ───────┤  callElectron()
                        ▼
Preload (electronAPI.config.*) ── IPC ──►  Main: codexPluginsHandler
                                              ├─ 讀:config.toml (smol-toml, 唯讀)
                                              ├─ 讀:parseCodexMarketplaceList / parseCodexPluginList
                                              └─ 變更:codexCliRunner ──spawn(no-shell)──► `codex`
```

兩個安全/責任邊界:
1. **`codexCliRunner`** — 唯一能 spawn `codex` binary 的模組(對應 cliRunner 之於 `claude`)。
2. **`codexPluginsHandler`** — 唯一的 IPC 表面;不跨界 throw,回 envelope。

## 2. 資料流（Hybrid）

| 視圖 | 來源 | 理由 |
|------|------|------|
| Marketplaces（使用者區） | `config.toml [marketplaces.*]`(smol-toml) | 穩定、含 source/source_type/last_updated |
| Marketplaces（內建區） | `codex plugin marketplace list` 表格 | openai-curated 不在 config.toml,只有 CLI 看得到 |
| Plugins 目錄 + 安裝狀態 | `codex plugin list` 表格 | 一次給 marketplace×plugin×status×version×path |
| 所有變更 | `codex plugin [marketplace] …` | codex 自寫 config.toml/cache;app 不寫 TOML |

> 合併規則:Marketplaces 清單以 `marketplace list` 的 name 為全集;`config.toml` 命中的標 `builtin=false`(可 remove/upgrade),未命中的標 `builtin=true`(唯讀)。

## 3. 契約

### 3.1 `codexCliRunner.ts`（複製 cliRunner 安全骨架）
- binary 偵測:`where codex`(win32)/`which codex`;候選 `codex.exe`/`codex.cmd`/`codex`;快取 + `_resetBinaryCache()`。
- 執行:`spawn(bin, args, { shell:false, windowsHide:true })`;60s timeout → SIGTERM → +5s SIGKILL;回 `CliRunResult`。
- **whitelist（`isWhitelisted` 位置式,8 條）**:
  | 動作 | args |
  |------|------|
  | versionProbe | `['--version']` |
  | marketplaceList | `['plugin','marketplace','list']` |
  | marketplaceAdd | `['plugin','marketplace','add', <source>]`(可選 `'--ref', <ref>`) |
  | marketplaceRemove | `['plugin','marketplace','remove', <name>]` |
  | marketplaceUpgrade | `['plugin','marketplace','upgrade']` 或 `[...,'upgrade', <name>]` |
  | pluginList | `['plugin','list']` |
  | pluginAdd | `['plugin','add', <plugin-id>]` |
  | pluginRemove | `['plugin','remove', <plugin-id>]` |
- 驗證器(沿用 cliRunner 模式):
  - `assertSafeMarketplaceSource(src)`:`owner/repo`(`^[\w-]+\/[\w.-]+$`,可帶 `@ref`)| git URL(現有 `GIT_URL_REGEX`)| 本機路徑(拒 NUL/CR/LF/tab)。
  - `assertSafeCodexPluginId(id)`:必含單一 `@`,兩側分別 `assertSafeName` / marketplace-name 規則。
  - `assertSafeRef(ref)`:`assertSafeName` 等級(無空白/shell metachar)。
- 公開:`runMarketplaceList/Add/Remove/Upgrade`、`runPluginList/Add/Remove`、`detectCodexBinary`、`runWhitelisted`(測試用)。
- 失敗訊息:`NOT_FOUND_MSG_CODEX`(codex 未安裝時)。

### 3.2 Parsers（fixture 驅動,純函式,易測）
- `parseCodexMarketplaceList(stdout): { name: string; root: string }[]`
  - 略過表頭 `MARKETPLACE  ROOT`;以多空白切兩欄。
- `parseCodexPluginList(stdout): CodexPlugin[]`
  - 區塊式:`Marketplace \`<name>\`` 標頭起,讀其下表格(欄:PLUGIN STATUS VERSION PATH);`PLUGIN` 形如 `name@marketplace`;`status` ∈ `installed`/`not installed`;`version` 可空;`path` 可能含空白 → 以欄位起始位置或「前三欄之後其餘為 path」解析。
  - 寬鬆:無法解析的列略過,不丟例外。

### 3.3 IPC channels（`shared/types.ts` `IPC_CHANNELS`）
- 讀:`CONFIG_GET_CODEX_MARKETPLACES` `'config:get-codex-marketplaces'`、`CONFIG_GET_CODEX_PLUGINS` `'config:get-codex-plugins'`
- 變更:`CODEX_CLI_MARKETPLACE_ADD/REMOVE/UPGRADE`、`CODEX_CLI_PLUGIN_ADD/REMOVE`(`'codex-cli:*'`)
- 維持 IPC_CHANNELS 值唯一性測試綠。

### 3.4 Handler 簽章（`codexPluginsHandler.ts`，回 envelope）
- `getCodexMarketplaces(configDir)` → `CodexMarketplace[]`(合併 `marketplace list` + config.toml)
- `getCodexPlugins()` → `CodexPlugin[]`(parse `plugin list`)
- `marketplaceAdd(source, ref?)` / `marketplaceRemove(name)` / `marketplaceUpgrade(name?)` → `CliRunResult`
- `pluginAdd(pluginId)` / `pluginRemove(pluginId)` → `CliRunResult`
- 所有變更後由 renderer 重新呼叫兩個讀 IPC 刷新（不在 handler 內 cache）。

### 3.5 型別（`shared/types.ts`）
```ts
export interface CodexMarketplace { name: string; root: string; builtin: boolean;
  source?: string; sourceType?: string; lastUpdated?: string; }
export interface CodexPlugin { id: string; name: string; marketplace: string;
  status: 'installed' | 'not-installed'; version?: string; path?: string; }
```

### 3.6 前端
- `App.tsx`:`AGENT_TABS.codex` 加 `{ id:'plugins', label:'Plugins' }`;render `<CodexPluginsView configDir accentColor={color.primary} />`。
- `CodexPluginsView`(2 tabs,lazy 如 ClaudePluginsView 的 visited 模式)。
- `CodexMarketplacesTab`:兩區清單 + 新增(owner/repo 或 URL,可填 ref)+ remove/upgrade(內建區唯讀)。
- `CodexPluginsTab`:依 marketplace 分組 + status 篩選 + install/remove;install 失敗顯示「請在終端機執行 `codex plugin add <id>`」。
- 複用 `shared/ExtensionListLayout`、`ExtensionRow`(視欄位調整)。

## 4. Tradeoffs（grill 已定）
- **獨立 runner vs 泛化 cliRunner** → 獨立:零風險動到 claude 安全路徑;代價 ~60 行 spawn/timeout 重複(安全邊界本應隔離)。
- **CLI 表格 vs 直讀檔** → Hybrid:config.toml 取使用者 marketplaces(穩),CLI 表格取 plugin 狀態(權威);不直讀 `.tmp` manifest。
- **install 互動** → 走 runner + timeout + 失敗給指令(不偵測 auth 欄位)。

## 5. 相容性 / 影響面
- **零變更**:`cliRunner.ts`、`claudePluginsHandler.ts`、ClaudePlugins UI 與其測試。
- 加法式:新 binary 偵測(`codex`)、新 IPC、新 UI 分頁。
- 既有 IPC_CHANNELS 唯一性 / agents 計數測試不受影響(沿用 codex agent,不新增 agent)。

## 6. Rollout / Rollback
- Rollout:純加法,新分頁;codex 未安裝 → 友善提示,不影響其他分頁。
- Rollback:移除 `plugins` 分頁項 + render 分支 + 新 handler 註冊;runner/parser/型別為孤立模組可留可刪。

## 7. 安全注意
- codexCliRunner 為唯一 spawn codex 之處;no-shell、whitelist、輸入驗證;非互動 + timeout 防卡。
- 不觸碰 `auth.json`;不寫 config.toml。
- renderer 傳入皆經驗證器(source/plugin-id/ref/name)後才入 args。
