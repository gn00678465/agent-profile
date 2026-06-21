# Implement — Codex Marketplace/Plugins tab

> 驗證指令(每階段跑):`bun run lint` · `bunx vitest run <相關檔>` · 收尾 `bun run test` + `bash scripts/check-architecture.sh`。
> 注意:`bun run typecheck` 只檢查 vite.config(已知缺口);renderer/main 型別用 `bunx tsc -p tsconfig.app.json --noEmit` / `tsconfig.electron.json` 並 grep 自己改的檔確認乾淨。
> Trellis 腳本走 `py -3 .\.trellis\scripts\…`(PowerShell),git-bash 的 `python3` 是 Store stub。

## Phase 1 — runner + parsers（最先,純後端、可單測)
- [ ] **擷取真實 fixture**:`codex plugin list` 與 `codex plugin marketplace list` 的真實 stdout(已有 `ponytail` + `openai-curated`)存成測試 fixture（字串常數或 `__fixtures__/`）。
- [ ] `src/main/ipc/handlers/codexCliRunner.ts`:binary 偵測(`where codex`)、spawn/timeout 骨架、8 條 whitelist + 驗證器、公開 run* 函式、`NOT_FOUND_MSG_CODEX`。
- [ ] parser:`parseCodexPluginList` / `parseCodexMarketplaceList`(可放 codexCliRunner 或獨立 `codexPluginsParse.ts`)。
- [ ] 測試:
  - runner:非白名單 args、注入(`;`/`|`/`..`/path-sep)、不合法 source/plugin-id/ref 全被拒;happy-path 建構正確 args。
  - parser:對真實 fixture 解出正確 marketplaces/plugins(含 not-installed、空 version、含空白 path)。
- **Gate 1**:lint 綠 + 上述單測綠 + runner/parser 檔 tsc 乾淨。

## Phase 2 — IPC / handler
- [ ] `shared/types.ts`:`CodexMarketplace` / `CodexPlugin` 型別;`IPC_CHANNELS` 加 2 讀 + 5 變更 channel（保持唯一性測試綠）。
- [ ] `codexPluginsHandler.ts`:讀×2(合併 `marketplace list` + config.toml smol-toml;parse `plugin list`)+ 變更×5(經 codexCliRunner);全回 envelope。
- [ ] 註冊 handler(main `index.ts`)+ preload `electronAPI.config.*` + `renderer/lib/electron.ts` 型別。
- [ ] 測試:handler 讀(mock fs/runner,驗合併規則:builtin vs user)、變更(mock runner,驗 args 透傳 + envelope)、codex 未安裝路徑。
- **Gate 2**:lint + 新 handler 測試綠 + 型別跨層乾淨(app + electron tsc grep)。

## Phase 3 — UI
- [ ] `CodexPluginsView`(2 tabs,visited-lazy);`CodexMarketplacesTab`(兩區 + add/remove/upgrade)、`CodexPluginsTab`(分組 + status 篩選 + install/remove + 失敗指令提示)。複用 `shared/Extension*`。
- [ ] `App.tsx`:`AGENT_TABS.codex` 加 `plugins` 分頁 + render 分支。
- [ ] 測試:兩分頁 component(mock IPC)— 列出/篩選/呼叫變更 IPC/錯誤顯示;codex 未安裝提示。
- **Gate 3**:lint + component 測試綠。

## Phase 4 — 驗證 + spec + 收尾
- [ ] 對 live codex 實機 smoke:dev 跑 app,Marketplaces 新增/移除一個來源、Plugins 列表正確顯示 `ponytail@ponytail` not-installed(用既有 fixture 對齊真實)。
- [ ] 全量驗證閘:`bun run test`(baseline 不退,只剩既知 Windows `skillsHandler` flake)+ `bun run lint` + `bash scripts/check-architecture.sh` + `bun run build`(確認 main/preload 打包)。
- [ ] spec:新增 `.trellis/spec/backend/codex-cli-runner.md`(第二安全邊界:binary 偵測、whitelist、驗證、與 cliRunner 關係)。
- [ ] commit-message skill 分原子 commit(建議:Phase1 runner/parser → Phase2 IPC → Phase3 UI,或一個 `feat(codex)` 視 diff 大小)。

## Review gates（人為確認點）
- Gate 1 後:確認 whitelist 涵蓋且夠嚴(安全邊界)。
- Gate 3 後:dev 實機看 UI 真的能 add/remove/list(避免「沒實跑就出 bug」)。

## Rollback points
- 每 Phase 為獨立可回溯單位;UI 未完可先合 runner+handler(無 UI 進入點 = 無使用者影響)。
- 整體回退:移除 `plugins` 分頁項 + render 分支 + handler 註冊。

## Out of scope（本任務不做）
- plugin enable/disable(需寫 config.toml,延後 + Taplo)。
- 直讀 `~/.codex/.tmp/...` manifest。
- auth 欄位偵測分流(install 一律走 runner + 失敗給指令)。
