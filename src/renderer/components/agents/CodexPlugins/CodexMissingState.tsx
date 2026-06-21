import { Terminal } from 'lucide-react';
import { callElectron, electronAPI } from '@/lib/electron';

const CODEX_CLI_URL = 'https://developers.openai.com/codex/cli';

export function CodexMissingState() {
  return (
    <div className="flex flex-col items-center gap-3 px-6 py-16 text-center text-muted-foreground">
      <Terminal className="h-10 w-10 opacity-30" />
      <div className="text-sm font-medium" style={{ color: 'var(--text-primary)' }}>
        codex CLI not found
      </div>
      <p className="max-w-sm text-xs">
        Install the Codex CLI to manage marketplaces and plugins.
      </p>
      <button
        type="button"
        onClick={() => { void callElectron(() => electronAPI().app.openExternal(CODEX_CLI_URL)); }}
        className="font-mono text-xs underline underline-offset-2 hover:text-foreground"
      >
        {CODEX_CLI_URL}
      </button>
    </div>
  );
}
