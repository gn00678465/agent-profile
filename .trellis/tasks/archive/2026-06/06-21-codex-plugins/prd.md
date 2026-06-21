# Codex Marketplace/Plugins tab

## Goal

在 Codex agent 新增 **Plugins 分頁**,管理 Codex 的外掛市集(marketplace)與外掛(plugin):讀取目錄與安裝狀態,並支援 marketplace `add`/`remove`/`upgrade` 與 plugin `install`/`remove`。範圍 **T2**。

## Background（已用 live codex v0.136.0 + `DietrichGebert/ponytail` 驗證）

- CLI 動詞(實機確認,比官方文件多):`codex plugin marketplace {add,list,upgrade,remove}`、`codex plugin {add,list,remove}`、`--version`。
- 狀態存放:
  - 使用者 marketplaces → `~/.codex/config.toml` 的 `[marketplaces.<name>]`(`source_type`/`source`/`last_updated`,**TOML**)。
  - marketplace clone 與 manifest → `~/.codex/.tmp/marketplaces/<name>/.agents/plugins/marketplace.json`(內部佈局,避免直接依賴)。
  - 內建 `openai-curated`(~30 plugins)**不在 config.toml**,只出現在 `codex plugin marketplace list` / `codex plugin list`。
  - 安裝/啟用 → `config.toml` 的 `[plugins."<name>@<marketplace>"]`(由 codex CLI 自己寫)。
- `codex plugin list` / `marketplace list` **沒有 `--json`**,只有表格輸出。
- `codex plugin add` 無非互動旗標;manifest 的 `policy.authentication: ON_INSTALL` 暗示安裝當下可能需要互動授權。

## Scope (T2)

**In:** 讀取 marketplaces + plugins 目錄與安裝狀態;marketplace `add`/`remove`/`upgrade`;plugin `install`(`codex plugin add`)/`remove`。
**Out（明確排除）:** plugin **enable/disable**(codex 無對應 CLI 動詞,需自寫 config.toml,有註解遺失風險)→ 延後,要做時再引入保留註解的 TOML 寫入(Taplo)。

> 因為排除 enable/disable,T2 **只讀不寫** config.toml,變更全由 codex CLI 寫入 → 無 TOML 註解遺失風險,smol-toml 唯讀解析即可。

## Resolved design decisions（grill 共識）

| 面向 | 決策 |
|------|------|
| 範圍 | T2(見上) |
| 讀取來源 | **Hybrid**:marketplaces 讀 `config.toml [marketplaces.*]`;plugin 目錄+安裝狀態解析 `codex plugin list` 表格 |
| CLI 執行 | **獨立 `codexCliRunner`**(複製 cliRunner 安全骨架:no-shell spawn / 60s timeout→SIGTERM→SIGKILL / `where codex` 偵測 / 專用 whitelist) |
| UI | Codex agent 新增 **Plugins 分頁**,內含兩子分頁 **Marketplaces + Plugins** |
| Install 互動風險 | 走 runner + 60s timeout;卡住/失敗顯示「請在終端機執行 `codex plugin add x@y`」 |
| 內建 marketplace | Marketplaces 分**兩區**:使用者來源(config.toml,可 remove/upgrade)+ 內建 openai-curated(唯讀);內建來自 `codex plugin marketplace list` |
| 測試 | **fixture 驅動 + 真實擷取**(用 live codex + ponytail 擷取真實輸出當 parser fixture)+ runner whitelist 拒絕/注入測試 + component 測試(mock IPC) |

## Requirements

### 後端
- `src/main/ipc/handlers/codexCliRunner.ts` — 唯一允許 spawn `codex` binary 的模組(第二個安全邊界)。
  - whitelist(7 條 + version):`plugin marketplace list`、`plugin marketplace add <source> [--ref <ref>]`、`plugin marketplace remove <name>`、`plugin marketplace upgrade [name]`、`plugin list`、`plugin add <plugin-id>`、`plugin remove <plugin-id>`、`--version`。
  - 驗證:source(`owner/repo[@ref]` | git URL | 路徑)、plugin-id(`name@marketplace`)、marketplace name;沿用 `assertSafe*` 與 git-URL regex 模式。`isWhitelisted` 位置式比對。
  - `where codex` 偵測 + binary 快取;60s timeout。
- 表格 parser(fixture 驅動,真實輸出):
  - `parseCodexPluginList(stdout)` → `{ marketplace, plugins: [{ id, name, marketplace, status, version?, path }] }[]`。
  - `parseCodexMarketplaceList(stdout)` → `[{ name, root }]`。
- `config.toml` 讀取:smol-toml 解析 `[marketplaces.*]`(只讀)。
- `src/main/ipc/handlers/codexPluginsHandler.ts` — 讀×2(get marketplaces = `marketplace list` ∪ config.toml 細節;get plugins = parse `plugin list`)+ 變更×5(marketplace add/remove/upgrade、plugin add/remove)經 codexCliRunner。
- IPC channels(`CONFIG_GET_CODEX_*` / `CODEX_CLI_*`)+ preload + `electron.ts` 型別。

### 前端
- `CodexPluginsView`(2 tabs)掛在 Codex agent 新 `plugins` 分頁(App.tsx `AGENT_TABS.codex`)。
- `CodexMarketplacesTab`:兩區(使用者可 add/remove/upgrade;內建唯讀)。
- `CodexPluginsTab`:目錄 + installed/not-installed 狀態 + marketplace 篩選 + install/remove;install 失敗顯示終端機指令。
- 複用 `shared/ExtensionRow`、`ExtensionListLayout`。

### 型別
- `CodexMarketplace`(name, source?, sourceType?, lastUpdated?, root, builtin: boolean)、`CodexPlugin`(id, name, marketplace, status, version?, path)。

## Constraints

- 安全:codexCliRunner 為唯一 spawn `codex` 的模組;no-shell、whitelist、輸入驗證;非互動 spawn + timeout。
- IPC envelope:不跨界 throw,回 `{ success, data? }` / `{ success: false, error }`。
- 不寫 config.toml(T2 變更全走 codex CLI)。
- codex 未安裝時:`where codex` 失敗 → 友善提示(類比 cliRunner 的 NOT_FOUND_MSG)。

## Acceptance Criteria

- [ ] codexCliRunner:7 條 whitelist 全部正確建構;非白名單/注入字串被拒(unit)。
- [ ] parser:對真實擷取 fixture 正確解析 `plugin list`(含多 marketplace、installed/not-installed)與 `marketplace list`。
- [ ] Marketplaces 分頁:顯示使用者來源 + 內建唯讀兩區;可 add(`owner/repo`/URL)/remove/upgrade 使用者來源(對 live codex 實機驗證一次)。
- [ ] Plugins 分頁:列出各 marketplace 的 plugins 與狀態,可篩選;install/remove 走 CLI;install 卡住/失敗顯示終端機指令。
- [ ] codex 未安裝時顯示友善提示,不崩潰。
- [ ] 既有 Claude plugins、cliRunner 與其測試零變更(codexCliRunner 完全獨立)。
- [ ] `bun run test` / `bun run lint` / `bash scripts/check-architecture.sh` 全綠(baseline 不退)。
- [ ] component 測試覆蓋兩分頁(mock IPC);runner whitelist 拒絕測試。

## Phased plan

1. **Phase 1 — runner + parsers**:`codexCliRunner` + 兩個 parser + 真實 fixture 擷取與單元測試(含 whitelist 拒絕)。
2. **Phase 2 — IPC/handler**:`codexPluginsHandler`(讀×2 + 變更×5)+ channels + preload + 型別。
3. **Phase 3 — UI**:`CodexPluginsView` + 兩子分頁 + 接 App.tsx;複用 shared list 元件。
4. **Phase 4 — 驗證**:component 測試、對 live codex 實機 smoke(用 ponytail fixture)、spec。

## Spec

- 新增 `.trellis/spec/backend/codex-cli-runner.md`(第二個安全邊界,記錄 binary 偵測、whitelist、驗證規則、與 cliRunner 的關係)。

## Open items / risks

- 表格 parser 對 codex 版本格式變更脆弱 → fixture + 寬鬆解析 + 版本標註;未來 codex 若加 `--json` 應切換。
- `~/.codex/.tmp/...` 內部佈局可能變動 → 盡量只靠 CLI 介面(`marketplace list` / `plugin list`),不直讀 `.tmp` manifest。
- `codex plugin add` 互動授權未實證(只查了 --help)→ Phase 1/4 對一個 auth=NONE 的 plugin 實機驗證行為。

## References

- 研究:`.trellis/tasks/add-codex-support/research/codex-plugins.md`、`codex-config.md`、`codex-subagents.md`（gitignored scratch）。
- 來源:https://developers.openai.com/codex/plugins 、 https://developers.openai.com/codex/plugins/build
- 既有對照:`src/main/ipc/handlers/cliRunner.ts`、`src/renderer/components/agents/ClaudePlugins*`、`src/renderer/components/shared/Extension*`。
