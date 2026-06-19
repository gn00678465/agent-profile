# feat-020 Marketplace auto-update Switch write path

> 從遷移前 `feature_list.json` feat-020（status=planned）遷出為現役 Trellis task。依賴 feat-019（已完成，見 archive `06-19-legacy-feat-001-019`）。狀態維持 **planning**，尚未啟動。

## Goal

把 `MarketplacesTab` 的 auto-update Switch 從 read-only（feat-019 落地）升級為可寫。

## Requirements

1. 確認 `claude plugin marketplace` CLI 是否原生支援 auto-update flag 寫入；若無，fallback 直接寫 `~/.claude/plugins/known_marketplaces.json` 的 `autoUpdate` 欄位，並在 Errors tab 顯示 sync 警告。
2. 在 cliRunner L4 白名單加 token pattern `[plugin marketplace set <name> --auto-update <bool>]` 或對應指令。
3. 加 IPC channel `CLAUDE_CLI_MARKETPLACE_SET_AUTO_UPDATE` + handler。
4. preload binding。
5. Switch `onCheckedChange` 串通。
6. test cases（cliRunner + handler + UI）。

## 需求變動 / 約束

- feat-019 sprint contract L4 / DV4 / FC3 都需要 patch（重跑 evaluator）。
- 遵守 cliRunner 規則：擴 L4 白名單 → 加 `Commands.*` builder + `assertSafe*` 校驗 → `runWith(args)` → vitest reject-path case → IPC handler 委派（見 AGENTS.md / `.trellis/spec/backend`）。

## Acceptance Criteria

- [ ] auto-update Switch 可寫，狀態正確持久化
- [ ] cliRunner 白名單 + 校驗 + reject-path test 齊備
- [ ] `bun run typecheck && bun run lint && bun run test && bash scripts/check-architecture.sh` 全綠
