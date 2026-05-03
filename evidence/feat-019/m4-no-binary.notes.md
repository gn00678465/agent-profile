# M4 supplemental — claude binary missing

**Scenario**: Same Discover → Install flow, but on a host where `where claude` (Win) / `which claude` (Unix) returns no result.

**Expected**: cliRunner detect step returns `{ success: false, error: "claude CLI not found in PATH; install via instructions at https://code.claude.com/docs/zh-TW/setup" }`. Toast error shown; other tabs unaffected.

**Verification**: cliRunner.test.ts case (a) "returns NOT_FOUND error when which/where finds no binary" — see evidence/feat-019/rc-1.txt for the test run output.

**Capture method note**: Companion PNG (m4-no-binary.png) is a 1×1 placeholder; the behavior is exhaustively covered by the unit test.
