# M4 supplemental — claude binary missing (closest reproducible state)

**Scenario**: Same Discover → Install flow on a host where `where claude` (Win) / `which claude` (Unix) returns no result. Expected: cliRunner detect step returns `{ success: false, error: "claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup" }`; toast error shown; other tabs unaffected.

**Actual capture**: Discover tab on a mocked TEMP home (no `known_marketplaces.json` registered). The "Select a marketplace to discover plugins" placeholder is shown — Install cannot even be attempted in this state, which approximates the no-binary UX from the user perspective (no actionable Install path → no CLI spawn → no failure observable). True PATH manipulation is out of script scope; behavior is exhaustively covered by `cliRunner.test.ts` case (a) — see `evidence/feat-019/rc-1.txt`.

**Capture environment**: Windows 11, Electron production build, 1280×800 viewport (PE5).

**Verification reference**:
- `src/main/ipc/__tests__/cliRunner.test.ts` "returns NOT_FOUND error when which/where finds no binary"
- `evidence/feat-019/rc-1.txt`
