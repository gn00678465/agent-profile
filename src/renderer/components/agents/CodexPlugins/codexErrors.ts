/** True when a rejected read call signals the codex binary is not on PATH. */
export function isCodexMissing(err: unknown): boolean {
  const msg = err instanceof Error ? err.message : String(err ?? '');
  return /codex CLI not found/i.test(msg);
}
