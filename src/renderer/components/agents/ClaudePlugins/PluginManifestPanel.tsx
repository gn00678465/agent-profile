import { useState } from 'react';
import { Switch } from '@/components/ui/switch';
import { RemoveButton } from '@/components/ui/remove-button';
import type { ClaudePlugin } from '@shared/types';

interface PluginManifestPanelProps {
  plugin: ClaudePlugin;
  onToggle: (id: string, enabled: boolean) => void | Promise<void>;
  onDelete: (plugin: ClaudePlugin) => void | Promise<void>;
  accentColor: string;
}

function formatDate(iso?: string): string {
  if (!iso) return '—';
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  return d.toLocaleDateString();
}

function MetaRow({ label, value, mono = false }: { label: string; value: React.ReactNode; mono?: boolean }) {
  return (
    <div className="flex items-start justify-between gap-4 text-xs">
      <span className="text-muted-foreground shrink-0">{label}</span>
      <span className={mono ? 'font-mono text-right break-all' : 'text-right break-all'}>{value}</span>
    </div>
  );
}

export function PluginManifestPanel({ plugin, onToggle, onDelete, accentColor }: PluginManifestPanelProps) {
  const [toggling, setToggling] = useState(false);
  const isManaged = plugin.scope === 'managed';

  async function handleToggle() {
    setToggling(true);
    try {
      await onToggle(plugin.id, !plugin.enabled);
    } finally {
      setToggling(false);
    }
  }

  return (
    <div className="border-l border-whisper bg-card flex flex-col min-w-[320px] max-w-[360px]">
      <div className="border-b-whisper px-4 py-3">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          Plugin Detail
        </span>
      </div>
      <div className="flex flex-col gap-4 p-4 overflow-y-auto">
        <div>
          <div className="font-mono text-sm font-semibold" style={{ color: accentColor }}>
            {plugin.name}
          </div>
          <div className="mt-0.5 font-mono text-xs text-muted-foreground">{plugin.id}</div>
          {plugin.description && (
            <p className="mt-2 text-xs leading-relaxed text-muted-foreground">{plugin.description}</p>
          )}
        </div>

        <div className="flex flex-wrap gap-1.5">
          <span className="badge-notion">scope: {plugin.scope}</span>
          {plugin.category && <span className="badge-notion">{plugin.category}</span>}
          {isManaged && <span className="badge-notion">read-only</span>}
        </div>

        <div className="rounded-card border-whisper bg-card p-3 flex flex-col gap-2">
          <MetaRow label="Version" value={plugin.version} mono />
          <MetaRow label="Marketplace" value={plugin.marketplace} mono />
          {plugin.projectPath && <MetaRow label="Project" value={plugin.projectPath} mono />}
          {plugin.author?.name && (
            <MetaRow
              label="Author"
              value={plugin.author.email ? `${plugin.author.name} <${plugin.author.email}>` : plugin.author.name}
            />
          )}
          {plugin.homepage && <MetaRow label="Homepage" value={plugin.homepage} mono />}
          {plugin.repository && <MetaRow label="Repository" value={plugin.repository} mono />}
          {plugin.license && <MetaRow label="License" value={plugin.license} mono />}
          <MetaRow label="Installed" value={formatDate(plugin.installedAt)} mono />
          <MetaRow label="Updated" value={formatDate(plugin.lastUpdated)} mono />
          {plugin.gitCommitSha && (
            <MetaRow label="Commit" value={plugin.gitCommitSha.slice(0, 8)} mono />
          )}
        </div>

        {plugin.components && (
          <div className="rounded-card border-whisper bg-card p-3 flex flex-col gap-2">
            <div className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Components
            </div>
            <div className="flex flex-wrap gap-1.5">
              {plugin.components.skills > 0 && (
                <span className="badge-notion">{plugin.components.skills} skills</span>
              )}
              {plugin.components.agents > 0 && (
                <span className="badge-notion">{plugin.components.agents} agents</span>
              )}
              {plugin.components.hooks > 0 && <span className="badge-notion">hooks</span>}
              {plugin.components.mcp && <span className="badge-notion">MCP</span>}
              {plugin.components.lsp && <span className="badge-notion">LSP</span>}
              {plugin.components.monitors > 0 && <span className="badge-notion">monitors</span>}
              {!plugin.components.skills &&
                !plugin.components.agents &&
                !plugin.components.hooks &&
                !plugin.components.mcp &&
                !plugin.components.lsp &&
                !plugin.components.monitors && (
                  <span className="text-xs text-muted-foreground">No components</span>
                )}
            </div>
          </div>
        )}

        {plugin.installPath && (
          <div className="flex flex-col gap-1">
            <span className="text-xs text-muted-foreground">Install Path</span>
            <span className="break-all font-mono text-[10px] text-muted-foreground">
              {plugin.installPath}
            </span>
          </div>
        )}

        <div className="flex items-center justify-between rounded-card border-whisper bg-card px-3 py-2">
          <span className="text-sm">Enabled</span>
          <Switch
            checked={plugin.enabled ?? false}
            disabled={toggling || isManaged}
            onCheckedChange={() => { void handleToggle(); }}
          />
        </div>

        <RemoveButton
          variant="panel"
          label="Delete Plugin"
          onClick={() => { void onDelete(plugin); }}
          disabled={isManaged}
        />
      </div>
    </div>
  );
}
