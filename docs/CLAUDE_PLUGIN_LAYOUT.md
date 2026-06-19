# Claude Plugin Layout — `~/.claude/` 真實檔案佈局

> Single source of truth for `feat-019` 實作。對應 IPC handler、UI schema、cliRunner 安全約束都依本檔。

研究來源：
- 實機 `~/.claude/` 樣本（Windows，Claude Code 35-/41-）
- https://code.claude.com/docs/zh-TW/plugins
- https://code.claude.com/docs/zh-TW/discover-plugins

---

## 1. `~/.claude/settings.json` plugin 鍵 schema

`~/.claude/settings.json` 是 user-scope 設定主檔，與 plugin 子系統相關的鍵共兩個：`enabledPlugins`、`extraKnownMarketplaces`。其他鍵（`env`、`permissions`、`model`、`hooks`、`mcpServers` 等）與本任務無關，但同檔讀寫時必須保留不動。

`enabledPlugins` 是 `Record<string, boolean>`，key 命名為 `<plugin-name>@<marketplace-name>`，與 `installed_plugins.json` 的 `plugins` map key 一致。`true` 表啟用、`false` 表停用。**未列在 map 中的外掛預設為 `false`**（CLI 在第一次 `install` 時會主動寫入）。

`extraKnownMarketplaces` 是 `Record<string, { source: ClaudeMarketplaceSource; autoUpdate?: boolean }>`，key 為 marketplace name。此鍵的角色是「待安裝建議」 — CLI 在使用者第一次「信任資料夾」後會把該項從 settings.json 複製到 `~/.claude/plugins/known_marketplaces.json`，並在 `installLocation` 路徑落地。**`extraKnownMarketplaces` 是宣告式的、不會自動 git clone**；必須走使用者明確操作（`/plugin marketplace add` 或信任 prompt）。

實機樣本（節錄）：
```json
{
  "enabledPlugins": {
    "context7@claude-plugins-official": true,
    "github@claude-plugins-official": false,
    "dev-browser@dev-browser-marketplace": true
  },
  "extraKnownMarketplaces": {
    "everything-claude-code": {
      "source": { "source": "github", "repo": "affaan-m/everything-claude-code" },
      "autoUpdate": true
    }
  }
}
```

讀寫權限：UI 純讀 `extraKnownMarketplaces`；`enabledPlugins` 由現有 `setPluginEnabled` IPC 直接寫（DV5），不走 cliRunner。`extraKnownMarketplaces` 不被 UI 寫入，新增市場走 `claude plugin marketplace add` CLI。

---

## 2. `~/.claude/plugins/installed_plugins.json` v2 schema

`installed_plugins.json` 是 plugin 安裝註冊表，由 CLI 寫入。UI 純讀。檔案根節點 `version: 2`；`plugins` 為 `Record<pluginId, install[]>`，pluginId 命名 `<name>@<marketplace>`（與 `enabledPlugins` key 對應）。每個 install 物件代表一個 scope 安裝實例。

install 物件欄位：
- `scope`: `"user" | "project"` — managed scope 在實機未觀察到（透過 enterprise 受管設定）；本任務於 type 上保留 `"managed"` 唯讀。
- `projectPath`: scope=project 時必有，指向 git root；scope=user 時 absent。
- `installPath`: 絕對路徑。Windows 為 `C:\\Users\\...\\plugins\\cache\\<marketplace>\\<name>\\<version>`；symlink 場景出現於 `directory` 來源市場（marketplace.json 的 source.path 直接 symlink）。
- `version`: 字串。實機觀察到 `"unknown"`、`"1.0.0"`、`"2026.04.0"` 等多種格式。
- `installedAt` / `lastUpdated`: ISO 8601 字串（`Z` 結尾 UTC）。
- `gitCommitSha`: 選填；git-source 市場才會有。

實機樣本：
```json
{
  "version": 2,
  "plugins": {
    "context7@claude-plugins-official": [
      {
        "scope": "user",
        "installPath": "C:\\Users\\gn006\\.claude\\plugins\\cache\\claude-plugins-official\\context7\\unknown",
        "version": "unknown",
        "installedAt": "2025-12-27T12:05:57.120Z",
        "lastUpdated": "2026-03-25T12:58:29.437Z"
      }
    ]
  }
}
```

`enabledPlugins` 與 `installed_plugins.json` 兩者透過 pluginId（`<name>@<marketplace>`）對應。一個 pluginId 可有多筆 install（user + project 同時存在），但 enabled 旗標目前以 pluginId 為單位（不分 scope）。

---

## 3. `~/.claude/plugins/known_marketplaces.json` schema

`known_marketplaces.json` 是 CLI 寫入的「已實體化市場」清單。每個 marketplace 物件由 5 種 `source.source` 之一驅動：

| source.source | 必要鍵 | 用途 |
|---|---|---|
| `github` | `repo` (`owner/name`) | GitHub repo clone 至 `installLocation` |
| `git` | `url`, 可選 `ref` / `sha` | 任意 git URL clone |
| `git-subdir` | `url`, `path` (repo 內子目錄), 可選 `ref` / `sha` | git clone 後只暴露 `path/` 子目錄為 marketplace 根 |
| `url` | `url` (zip / tarball) | HTTP 下載解壓至 `installLocation` |
| `directory` | `path`（本機絕對路徑） | 本機目錄直接作為 marketplace 根（symlink 行為） |

每個 marketplace 物件的全欄位：
- `source`: 上表之一。
- `installLocation`: 絕對路徑；`directory` 來源時 = `source.path`，其餘為 `~/.claude/plugins/marketplaces/<name>/`。
- `lastUpdated`: ISO 8601 字串，CLI 每次 `update` 寫入。
- `autoUpdate`: 選填 boolean；**預設 false**；官方市場 `claude-plugins-official` 視為 true（CLI 內建邏輯，不寫入檔案）。

實機樣本（混 github + directory）：
```json
{
  "claude-plugins-official": {
    "source": { "source": "github", "repo": "anthropics/claude-plugins-official" },
    "installLocation": "C:\\Users\\gn006\\.claude\\plugins\\marketplaces\\claude-plugins-official",
    "lastUpdated": "2026-05-03T04:38:56.200Z"
  },
  "harness-marketplace": {
    "source": { "source": "directory", "path": "D:\\Projects\\harness-helper" },
    "installLocation": "D:\\Projects\\harness-helper",
    "lastUpdated": "2026-05-03T06:07:36.788Z",
    "autoUpdate": true
  }
}
```

`autoUpdate` 規則：UI 顯示官方市場永遠 ON 且不可改（內建）；其他市場顯示 file 內值或 `false`，可在 UI 切換（將觸發 CLI 寫回 `known_marketplaces.json`，**本任務 cliRunner 未開放此指令** — 只支援列舉於 L4 的 11 條，autoUpdate 切換留待 FC 階段）。

---

## 4. `~/.claude/plugins/marketplaces/<name>/.claude-plugin/marketplace.json` schema

`marketplace.json` 是 marketplace 內容清單，由 marketplace 維護者撰寫（git repo 的根 `.claude-plugin/marketplace.json` 或 `directory` 來源的同位置檔案）。CLI clone 後直接讀此檔。

頂層欄位：
- `$schema`: 選填 URL（`https://anthropic.com/claude-code/marketplace.schema.json`）。
- `name`: marketplace 的對外名稱（**可與 `known_marketplaces.json` 的 key 不同**，但慣例一致）。
- `description`: 字串。
- `owner`: `{ name, email? }`。
- `plugins`: `Array<MarketplacePluginEntry>`。

`MarketplacePluginEntry` 欄位：
- `name`: plugin 名稱（與 `installed_plugins.json` 的 `<name>@<marketplace>` 前段對應）。
- `description`: 字串。
- `author`: `{ name, email? }` — 選填（部分 plugin 缺）。
- `category`: 字串（`security`、`development`、`design`、`productivity` 等自由分類）。
- `source`: `MarketplacePluginSource`（5 種，與市場 source 同 schema，外加字串短形如 `"./plugins/agent-sdk-dev"` 表示同 repo 內子目錄）。
- `homepage`: 選填 URL。

實機樣本（節錄自 `claude-plugins-official` 市場）：
```json
{
  "name": "claude-plugins-official",
  "owner": { "name": "Anthropic", "email": "support@anthropic.com" },
  "plugins": [
    {
      "name": "42crunch-api-security-testing",
      "description": "...",
      "author": { "name": "42Crunch" },
      "category": "security",
      "source": { "source": "git-subdir", "url": "https://github.com/...", "path": "plugins/api-security-testing", "ref": "v1.0.1" },
      "homepage": "https://42crunch.com"
    }
  ]
}
```

UI 在 Discover tab 讀此檔列舉可安裝外掛；與 `installed_plugins.json` 比對後標記 `installed: boolean`。

---

## 5. `~/.claude/plugins/cache/<marketplace>/<plugin>/<version>/` 佈局

`cache/` 是 CLI 真正下載/解壓 plugin 內容的目錄。每個 plugin 一個獨立 `<version>/` 子目錄。**`.claude-plugin/plugin.json` 必有**（CLI 安裝後一定產出）；其他子目錄為**選用**，依 plugin 提供的 components 決定。

必有：
- `.claude-plugin/plugin.json`: `{ name, version?, description?, author?, homepage?, repository?, license? }` — `version` 可缺（短形 plugin），`name` 必有。

選用 components：
- `skills/<skill-name>/SKILL.md` — Claude Code skills（多 skill 並列）。
- `agents/<agent-name>.md` — subagent 定義。
- `hooks/hooks.json` — hook 設定。
- `.mcp.json` — MCP server 設定。
- `.lsp.json` — LSP server 設定（少見；目前只 typescript-lsp / pyright-lsp 類）。
- `monitors/monitors.json` — background monitor 設定。
- `bin/<executable>` — plugin 自帶 binary。
- `settings.json` — plugin scope 預設 settings。

實機樣本：`code-simplifier/1.0.0/` 含 `agents/`、`.claude-plugin/plugin.json`；`ralph-loop/1.0.0/` 含 `LICENSE`、`README.md`、`commands/`、`hooks/`、`scripts/`、`.claude-plugin/plugin.json`。

`claudePluginsHandler.readPluginManifest()` 實作策略：
1. 讀 `<installPath>/.claude-plugin/plugin.json` → 取得 manifest 欄位。
2. 列舉子目錄存在性 → 計算 `components: { skills: count, agents: count, hooks: 0|1, mcp: bool, lsp: bool, monitors: count }`。
3. 缺檔不致命；缺 `.claude-plugin/plugin.json` 時 fallback 為 `{ name: <pluginId>, version: <installed.version> }`。

---

## 6. `~/.claude/plugins/{cache,marketplaces,repos,data,blocklist.json,config.json,install-counts-cache.json}` 路徑用途

| 路徑 | 用途 | 讀寫權 |
|---|---|---|
| `cache/` | 已下載 plugin 內容快取（依 marketplace × plugin × version 分層） | CLI 寫；UI 純讀 |
| `marketplaces/` | 已 clone 的 marketplace repo（含 `.claude-plugin/marketplace.json`） | CLI 寫；UI 純讀 |
| `repos/` | git source 共用 clone 的 raw repo（cache 是從這裡 checkout 出來的子集） | CLI 寫；UI 不讀 |
| `data/` | plugin 執行時的持久化資料（用戶資料、log） | plugin 自寫；UI 不碰 |
| `blocklist.json` | CLI blocked plugin 清單（安全） | CLI 寫；UI 不碰 |
| `config.json` | plugin 子系統內部設定 | CLI 寫；UI 不碰 |
| `install-counts-cache.json` | discover 統計快取 | CLI 寫；UI 可讀但本任務不展示 |
| `installed_plugins.json` | 已安裝清單（§2） | CLI 寫；UI 純讀 |
| `known_marketplaces.json` | 已實體化市場清單（§3） | CLI 寫；UI 純讀 |

本任務 UI 寫入面只有兩個：
1. 透過現有 `setPluginEnabled` IPC 寫 `~/.claude/settings.json` 的 `enabledPlugins`（DV5）。
2. 透過 cliRunner spawn `claude` CLI 間接觸發 CLI 對 `installed_plugins.json` / `known_marketplaces.json` / cache 的寫入。

UI **絕不直接寫** `installed_plugins.json` / `known_marketplaces.json` / `cache/`；所有變動走 CLI（避免與 CLI 寫入競爭、避免破壞 schema invariant）。

---

## 7. 邊界情況清單（IPC handler 必處理）

| 情境 | Handler 行為 | 對應 RC |
|---|---|---|
| `installed_plugins.json` 不存在 | `{ success: true, data: [] }`（缺檔視為空集合，不拋） | RC2 |
| `installed_plugins.json` JSON 損毀（`{not valid json`） | catch `SyntaxError` → `{ success: false, error }`；同時聚合一筆 `ClaudePluginError` 給 Errors tab | RC3 |
| `known_marketplaces.json` 不存在 | `{ success: true, data: [] }` | 同 RC2 模式 |
| `known_marketplaces.json` 與 `extraKnownMarketplaces` 同名衝突（source 不同） | `known_marketplaces.json` 為準；衝突項標 `unsynced` warn | RC6 |
| `marketplace.json` 不存在（`directory` 來源指向不存在路徑） | discovery handler 回 `{ success: true, data: [] }` 並聚合 `ClaudePluginError` | RC1 一族 |
| `installPath` 為 symlink（`directory` 市場常見） | 解析至實體路徑後跑 `assertSafePath`；解析失敗回 `{ success: false, error }` | PE4 |
| `installPath` 不存在（cache 被手動刪） | components 計數 fallback `{ skills:0, agents:0, hooks:0, mcp:false, lsp:false, monitors:0 }`；不算錯 | — |
| `source.source` 值未知（schema 升版） | UI 顯示 `unknown` source pill，不拒絕載入 | — |
| `claude` binary 不在 PATH | cliRunner detect 階段直接 `{ success: false, error: "claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup" }` | RC1 |
| CLI spawn timeout（60s） | SIGTERM → 5s 後 SIGKILL → `{ success: false, error: "claude CLI timeout (60s)", stdout, stderr }` | RC4 |
| Marketplace 名含 `..` / `;` / 空白 | `assertSafeName` throw → cliRunner catch → `{ success: false, error: "invalid marketplace name: ..." }`；CLI 不 spawn | RC5 |
| Git URL 不符 L6 regex | `cliRunner` 在 args 組合階段拒絕 → `{ success: false, error: "invalid git URL" }` | C4 |
| Plugin enable/disable | 走 `setPluginEnabled`（直接寫 settings.json），**不**走 CLI（DV5） | — |
| Managed scope plugin 出現於 Installed | UI 顯示但 toggle / delete disabled（DV1） | — |
| 官方市場 `claude-plugins-official` Remove 按鈕 | 永久 disabled + tooltip（DV2） | — |
