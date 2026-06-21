# codexCliRunner — Codex CLI 安全邊界

`src/main/ipc/handlers/codexCliRunner.ts` 是**唯一**允許 spawn `codex` binary 的模組(第二個 CLI 安全邊界,與 `cliRunner.ts` 之於 `claude` 對應)。Codex plugins/marketplace 功能的所有 `codex` 呼叫都必須經此模組。

## 鐵則

- **No shell.** 一律 `spawn(bin, args, { shell: false, windowsHide: true })`;禁止 `exec`/`execSync`/`shell:true`。args 為陣列,不做字串拼接 → 無 shell 注入面。
- **Whitelist 先行.** `isWhitelisted(args)` 位置式比對 + **精確長度檢查**(防 arg smuggling);非白名單一律在 spawn 前拒絕。
- **格式驗證器.** renderer 傳入的 token(source / plugin-id / ref / marketplace-name)在 `Commands.*` builder 內先過驗證器,throw → run* wrapper 轉成 `{ success:false, error }`。
- **不跨界 throw.** 公開 `run*` 一律回 `CliRunResult`;binary 不存在回 `NOT_FOUND_MSG_CODEX`。
- **Timeout.** 60s → SIGTERM → +5s → SIGKILL。
- **Binary 偵測.** `where codex`(win32)/`which codex`;候選 `codex.exe`/`codex.cmd`/`codex`;結果快取,`_resetBinaryCache()` 供測試。

## Whitelist(8 patterns,精確長度)

| 動作 | args |
|------|------|
| version | `['--version']` (len 1) |
| marketplace list | `['plugin','marketplace','list']` (len 3) |
| marketplace add | `['plugin','marketplace','add', <source>]` (len 4) 或 `[…, <source>, '--ref', <ref>]` (len 6,`a[4]==='--ref'`) |
| marketplace remove | `['plugin','marketplace','remove', <name>]` (len 4) |
| marketplace upgrade | `['plugin','marketplace','upgrade']` (len 3) 或 `[…,'upgrade', <name>]` (len 4) |
| plugin list | `['plugin','list']` (len 2) |
| plugin add | `['plugin','add', <plugin-id>]` (len 3) |
| plugin remove | `['plugin','remove', <plugin-id>]` (len 3) |

## 驗證器

- `assertSafeMarketplaceSource(src)` — 接受:`owner/repo`(`^[\w-]+\/[\w.-]+$`,可帶 `@ref`)| git URL(`GIT_URL_REGEX`)| 本機路徑(須「像路徑」:含 `/`、`\` 或以 `.`/`~` 開頭,且無 shell metachar)。拒絕:control chars、裸字(防 typo 變 arg)。
- `assertSafeMarketplaceName(name)` — 拒 path-sep、`..`、shell metachar/空白。
- `assertSafeCodexPluginId(id)` — 必須恰好一個 `@`;name 側 `assertSafeName`,marketplace 側 `assertSafeMarketplaceName`。
- `assertSafeRef(ref)` — 無空白/shell metachar/`..`。
- **`assertNoLeadingDash(s)`** — source/name/ref/plugin-name 一律不得以 `-` 開頭(防 argument injection,CWE-88;尤其阻擋 `-c key=value` config 覆寫)。合法 owner/repo/ref/name 不會以 `-` 開頭。

> 安全要點:即使某 token 通過驗證,no-shell + 精確長度 whitelist 已封死注入;leading-dash 防護 + 「source 必須像路徑」共同確保危險的 `-c`/`--config` 覆寫(那些 key 不含 `/`、不像路徑)無法被夾帶。

## 公開介面

`runMarketplaceList()`、`runMarketplaceAdd(source, ref?)`、`runMarketplaceRemove(name)`、`runMarketplaceUpgrade(name?)`、`runPluginList()`、`runPluginAdd(pluginId)`、`runPluginRemove(pluginId)`、`detectCodexBinary()`、`runWhitelisted(args)`(測試用)、`_internals`(測試用)。

## 資料讀取(Hybrid,不在本模組)

讀取在 `codexPluginsHandler.ts`,**不寫** config.toml:
- marketplaces:`runMarketplaceList()` → `parseCodexMarketplaceList`(全集,含內建)∪ `~/.codex/config.toml` 的 `[marketplaces.<name>]`(smol-toml **唯讀** parse,取 source/source_type/last_updated)。命中 config.toml → `builtin:false`(可 remove/upgrade);否則 `builtin:true`(唯讀)。
- plugins:`runPluginList()` → `parseCodexPluginList`(`codex plugin list` 無 `--json`,解析表格,以表頭欄位 offset 切欄,path 可含空白)。
- 變更(marketplace add/remove/upgrade、plugin add/remove)全走 CLI,由 codex 自寫 config.toml/cache → app 不寫 TOML、無註解遺失風險。
- 變更失敗的 `CliRunResult` 仍以 `{success:true, data:{success:false,…}}` 回 renderer → UI 須檢查 `data.success`。

## 新增一條 codex 指令(步驟)

1. `Commands.<x>()` builder + 對應驗證器。
2. `isWhitelisted` 加位置式 pattern(含精確長度)。
3. 公開 `run<X>()` wrapper(try builder → `runWith`)。
4. 測試:happy-path 建構 + whitelist 拒絕 + 注入/leading-dash 拒絕。
5. 若需新 IPC,於 `codexPluginsHandler` + `IPC_CHANNELS` + preload + `electron.ts` 對應(見 `ipc-handlers.md`)。

## 已知限制

- 表格解析依賴 codex 輸出格式;codex 若加 `--json` 應改用。
- `codex plugin add` 可能需互動授權(manifest `authentication: ON_INSTALL`)→ 走 runner + 60s timeout;UI 於失敗時提示「在終端機執行 `codex plugin add <id>`」。
- 不直讀 `~/.codex/.tmp/...` 內部 clone 佈局。
