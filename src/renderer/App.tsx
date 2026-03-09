import { useState, useEffect, useCallback } from 'react';
import { Toaster, toast } from 'sonner';
import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/layout/Sidebar';
import { ClaudeSettingsView } from './components/agents/ClaudeSettings';
import { GeminiSettingsView } from './components/agents/GeminiSettings';
import { CopilotSettingsView } from './components/agents/CopilotSettings';
import { ClaudePluginsView } from './components/agents/ClaudePlugins';
import { GeminiExtensionsView } from './components/agents/GeminiExtensions';
import { McpEditor } from './components/editors/McpEditor';
import { JsonFileEditor } from './components/editors/JsonFileEditor';
import { SkillsEditor } from './components/editors/SkillsEditor';
import { MarkdownEditor } from './components/editors/MarkdownEditor';
import { SessionsView } from './components/editors/SessionsView';
import { ClaudeSessionsView } from './components/editors/ClaudeSessionsView';
import { RulesEditor } from './components/editors/RulesEditor';
import { SubagentsEditor } from './components/editors/SubagentsEditor';
import { CopilotSessionsView } from './components/editors/CopilotSessionsView';
import { ScrollArea } from './components/ui/scroll-area';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { electronAPI, callElectron } from './lib/electron';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import type { AgentProfile } from '@shared/types';

// ─── Agent theming ────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, { primary: string; subtle: string }> = {
  'claude-code': { primary: '#d97706', subtle: 'rgba(217,119,6,0.08)' },
  copilot:       { primary: '#2eb88a', subtle: 'rgba(46,184,138,0.08)' },
  gemini:        { primary: '#7c6ef5', subtle: 'rgba(124,110,245,0.08)' },
  shared:        { primary: '#6b7280', subtle: 'rgba(107,114,128,0.08)' },
};

const AGENT_GLYPHS: Record<string, string> = {
  'claude-code': '◉',
  copilot:       '▶',
  gemini:        '◆',
  shared:        '◈',
};

function agentColor(type: string) {
  return AGENT_COLORS[type] ?? AGENT_COLORS.shared;
}

// ─── Tab configuration per agent ─────────────────────────────────────────────

const AGENT_TABS: Record<string, Array<{ id: string; label: string }>> = {
  'claude-code': [
    { id: 'settings',  label: 'Settings' },
    { id: 'claude-md', label: 'CLAUDE.md' },
    { id: 'sessions',  label: 'Sessions' },
    { id: 'skills',    label: 'Skills' },
    { id: 'plugins',   label: 'Plugins' },
    { id: 'mcp',       label: 'MCP Servers' },
    { id: 'rules',     label: 'Rules' },
  ],
  copilot: [
    { id: 'settings',              label: 'Settings' },
    { id: 'copilot-instructions',  label: 'Instructions' },
    { id: 'subagents',             label: 'Subagents' },
    { id: 'sessions',              label: 'Sessions' },
    { id: 'skills',                label: 'Skills' },
    { id: 'mcp',                   label: 'MCP Servers' },
  ],
  gemini: [
    { id: 'settings',   label: 'Settings' },
    { id: 'gemini-md',  label: 'GEMINI.md' },
    { id: 'sessions',   label: 'Sessions' },
    { id: 'skills',     label: 'Skills' },
    { id: 'extensions', label: 'Extensions' },
    { id: 'mcp',        label: 'MCP Servers' },
  ],
  shared: [
    { id: 'skills', label: 'Shared Skills' },
  ],
};

// ─── Save state ───────────────────────────────────────────────────────────────

export interface SaveState {
  isDirty: boolean;
  isSaving: boolean;
  lastSaved?: Date;
}

// ─── Gemini MCP redirect ──────────────────────────────────────────────────────

function GeminiMcpView({ onNavigate }: { onNavigate: () => void }) {
  return (
    <ScrollArea className="flex-1">
      <div className="flex flex-col gap-6 p-6">
        <div>
          <h2 className="text-sm font-semibold">MCP Servers (via Extensions)</h2>
          <p className="text-xs text-muted-foreground">
            Gemini MCP servers are configured inside extension manifests.
          </p>
        </div>
        <div className="rounded-md border border-amber-500/30 bg-amber-500/10 px-4 py-3 text-sm text-amber-400">
          MCP servers for Gemini are defined inside{' '}
          <code className="font-mono text-xs">gemini-extension.json</code> files in each extension folder.
          Use the Extensions tab to view and manage them.
        </div>
        <button
          onClick={onNavigate}
          className="flex items-center gap-2 rounded-md border border-border px-4 py-3 text-sm transition-colors hover:bg-accent text-left w-fit"
        >
          Go to Extensions →
        </button>
      </div>
    </ScrollArea>
  );
}

// ─── Content view router ──────────────────────────────────────────────────────

interface ContentViewProps {
  agent: AgentProfile;
  activeTab: string;
  onTabChange: (tab: string) => void;
}

function ContentView({ agent, activeTab, onTabChange }: ContentViewProps) {
  const { type, configDir, name } = agent;
  const color = agentColor(type);
  const tabs = AGENT_TABS[type] ?? [];

  function renderTabContent(tabId: string) {
    if (type === 'claude-code') {
      if (tabId === 'settings')  return <ClaudeSettingsView configDir={configDir} />;
      if (tabId === 'plugins')   return <ClaudePluginsView configDir={configDir} accentColor={color.primary} />;
      if (tabId === 'skills')    return <SkillsEditor configDir={configDir} agentName={name} agentType={type} />;
      if (tabId === 'mcp')       return <McpEditor configDir={configDir} />;
      if (tabId === 'claude-md') return (
        <MarkdownEditor filePath={`${configDir}/CLAUDE.md`} title="CLAUDE.md" description="Global instructions for Claude Code" />
      );
      if (tabId === 'sessions') return <ClaudeSessionsView configDir={configDir} agentColor={color.primary} />;
      if (tabId === 'rules')    return <RulesEditor configDir={configDir} accentColor={color.primary} />;
    }
    if (type === 'copilot') {
      if (tabId === 'settings') return <CopilotSettingsView configDir={configDir} />;
      if (tabId === 'copilot-instructions') return (
        <MarkdownEditor
          filePath={`${configDir}/copilot-instructions.md`}
          title="copilot-instructions.md"
          description="Custom instructions for GitHub Copilot"
          autoCreate
        />
      );
      if (tabId === 'subagents') return <SubagentsEditor configDir={configDir} accentColor={color.primary} />;
      if (tabId === 'sessions') return <CopilotSessionsView configDir={configDir} agentColor={color.primary} />;
      if (tabId === 'skills') return <SkillsEditor configDir={configDir} agentName={name} agentType={type} />;
      if (tabId === 'mcp') return (
        <JsonFileEditor
          filePath={`${configDir}/mcp-config.json`}
          title="MCP Servers"
          description={`${configDir}/mcp-config.json`}
        />
      );
    }
    if (type === 'gemini') {
      if (tabId === 'settings')   return <GeminiSettingsView configDir={configDir} />;
      if (tabId === 'sessions')   return <SessionsView configDir={configDir} agentType="gemini" agentColor={color.primary} />;
      if (tabId === 'extensions') return <GeminiExtensionsView configDir={configDir} accentColor={color.primary} />;
      if (tabId === 'skills')     return <SkillsEditor configDir={configDir} agentName={name} agentType={type} />;
      if (tabId === 'mcp')        return <GeminiMcpView onNavigate={() => onTabChange('extensions')} />;
      if (tabId === 'gemini-md')  return (
        <MarkdownEditor filePath={`${configDir}/GEMINI.md`} title="GEMINI.md" description="Global instructions for Gemini CLI" />
      );
    }
    if (type === 'shared') {
      if (tabId === 'skills') return <SkillsEditor configDir={configDir} agentName="Shared" agentType="shared" />;
    }
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">View not available</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Agent header band */}
      <div
        className="flex shrink-0 items-center gap-3 border-b px-4 py-3"
        style={{ background: color.subtle, borderColor: `${color.primary}40` }}
      >
        <span className="text-xl" style={{ color: color.primary }}>{AGENT_GLYPHS[type] ?? '◈'}</span>
        <div>
          <div className="font-mono text-sm font-semibold tracking-widest uppercase" style={{ color: color.primary }}>
            {name}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{configDir}</div>
        </div>
      </div>

      {/* Section tabs */}
      <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-1 flex-col overflow-hidden">
        <div className="shrink-0 border-b border-border" style={{ background: 'var(--bg-base)' }}>
          <TabsList className="h-auto w-full justify-start rounded-none bg-transparent p-0">
            {tabs.map((tab) => {
              const isActive = activeTab === tab.id;
              return (
                <TabsTrigger
                  key={tab.id}
                  value={tab.id}
                  className="rounded-none border-b-2 px-4 py-2.5 text-xs font-medium transition-colors data-[state=active]:bg-transparent data-[state=active]:shadow-none"
                  style={isActive
                    ? { color: color.primary, borderColor: color.primary } as React.CSSProperties
                    : { color: 'var(--text-secondary)', borderColor: 'transparent' } as React.CSSProperties
                  }
                >
                  {tab.label}
                </TabsTrigger>
              );
            })}
          </TabsList>
        </div>

        {tabs.map((tab) => (
          <TabsContent
            key={tab.id}
            value={tab.id}
            className="mt-0 overflow-hidden data-[state=active]:flex data-[state=active]:flex-col"
            style={{ flex: activeTab === tab.id ? 1 : undefined }}
          >
            {renderTabContent(tab.id)}
          </TabsContent>
        ))}
      </Tabs>
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────────────

export default function App() {
  const { agents, loading, error } = useAgents();
  useTheme();
  const [activeAgentId, setActiveAgentId] = useState('claude-code');
  const [activeTab, setActiveTab] = useState('settings');
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);
  const [saveState, setSaveState] = useState<SaveState>({ isDirty: false, isSaving: false });
  const [activeModel, setActiveModel] = useState<string | null>(null);

  const activeAgent = agents.find((a) => a.id === activeAgentId) ?? null;
  const color = activeAgent ? agentColor(activeAgent.type) : agentColor('shared');

  const selectAgent = useCallback((id: string) => {
    setActiveAgentId(id);
    const agent = agents.find((a) => a.id === id);
    if (agent) {
      const tabs = AGENT_TABS[agent.type] ?? [];
      setActiveTab(tabs[0]?.id ?? 'settings');
    }
    setSaveState({ isDirty: false, isSaving: false });
  }, [agents]);

  // Load active model for status bar
  useEffect(() => {
    if (!activeAgent) { setActiveModel(null); return; }
    if (activeAgent.type === 'claude-code') {
      void callElectron(() => electronAPI().config.getClaudeSettings(activeAgent.configDir))
        .then((cfg) => setActiveModel(cfg.data?.model ?? null))
        .catch(() => setActiveModel(null));
    } else if (activeAgent.type === 'copilot') {
      void callElectron(() => electronAPI().config.getCopilotConfig(activeAgent.configDir))
        .then((cfg) => setActiveModel(cfg.data?.model ?? null))
        .catch(() => setActiveModel(null));
    } else {
      setActiveModel(null);
    }
  }, [activeAgentId, activeAgent]);

  // Keyboard shortcuts
  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const ctrl = e.ctrlKey || e.metaKey;
      if (ctrl && e.key === 's') { e.preventDefault(); window.dispatchEvent(new CustomEvent('app:save')); }
      if (ctrl && e.key === '1') { e.preventDefault(); const a = agents.find((x) => x.type === 'gemini'); if (a) selectAgent(a.id); }
      if (ctrl && e.key === '2') { e.preventDefault(); const a = agents.find((x) => x.type === 'copilot'); if (a) selectAgent(a.id); }
      if (ctrl && e.key === '3') { e.preventDefault(); const a = agents.find((x) => x.type === 'claude-code'); if (a) selectAgent(a.id); }
      if (ctrl && e.key === 'Tab') {
        e.preventDefault();
        if (agents.length > 1) {
          const idx = agents.findIndex((a) => a.id === activeAgentId);
          const next = agents[(idx + 1) % agents.length];
          if (next) selectAgent(next.id);
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [agents, activeAgentId, selectAgent]);

  return (
    <>
      <Toaster
        position="bottom-right"
        toastOptions={{
          style: { background: 'var(--bg-raised)', border: '1px solid var(--border-subtle)', color: 'var(--text-primary)' },
        }}
      />

      <div className="flex h-full flex-col overflow-hidden" style={{ background: 'var(--bg-base)' }}>
        {/* Title bar */}
        <div
          className="titlebar-drag flex h-10 shrink-0 items-center justify-between border-b px-4"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2">
            <button
              onClick={() => setSidebarCollapsed((v) => !v)}
              className="titlebar-nodrag rounded p-1 text-muted-foreground transition-colors hover:bg-accent hover:text-foreground"
              title={sidebarCollapsed ? 'Expand sidebar' : 'Collapse sidebar'}
            >
              {sidebarCollapsed ? <PanelLeft className="h-4 w-4" /> : <PanelLeftClose className="h-4 w-4" />}
            </button>
            <span className="text-base" style={{ color: color.primary }}>◈</span>
            <span className="font-mono text-xs tracking-widest uppercase" style={{ color: 'var(--text-secondary)' }}>
              Agent Profile Manager
            </span>
          </div>
          <div className="titlebar-nodrag" />
        </div>

        {/* Body */}
        <div className="flex flex-1 overflow-hidden">
          <Sidebar
            agents={agents}
            activeAgentId={activeAgentId}
            collapsed={sidebarCollapsed}
            onAgentSelect={selectAgent}
            accentColor={color.primary}
          />

          <div className="flex flex-1 flex-col overflow-hidden">
            {loading ? (
              <div className="flex h-full items-center justify-center text-muted-foreground">Loading agents...</div>
            ) : error ? (
              <div className="flex h-full items-center justify-center text-sm text-destructive">{error}</div>
            ) : activeAgent ? (
              <ContentView
                key={activeAgent.id}
                agent={activeAgent}
                activeTab={activeTab}
                onTabChange={setActiveTab}
              />
            ) : (
              <div className="flex h-full items-center justify-center text-muted-foreground text-sm">
                Select an agent from the sidebar
              </div>
            )}
          </div>
        </div>

        {/* Status bar */}
        <div
          className="flex h-7 shrink-0 items-center justify-between border-t px-4"
          style={{ background: 'var(--bg-base)', borderColor: 'var(--border-subtle)' }}
        >
          <div className="flex items-center gap-2 font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {activeAgent && (
              <>
                <span style={{ color: color.primary }}>{AGENT_GLYPHS[activeAgent.type]}</span>
                <span>{activeAgent.name}</span>
                <span>·</span>
                <span>{activeAgent.configDir}</span>
              </>
            )}
          </div>

          <div className="flex items-center gap-2 text-[11px]">
            {saveState.isSaving && (
              <span className="flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
                <span className="inline-block h-1.5 w-1.5 animate-pulse rounded-full bg-current" />
                Saving...
              </span>
            )}
            {!saveState.isSaving && saveState.isDirty && (
              <span className="flex items-center gap-1.5" style={{ color: '#f59e0b' }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                Unsaved changes
              </span>
            )}
            {!saveState.isSaving && !saveState.isDirty && saveState.lastSaved && (
              <span className="flex items-center gap-1.5" style={{ color: '#22c55e' }}>
                <span className="inline-block h-1.5 w-1.5 rounded-full bg-current" />
                Saved
              </span>
            )}
          </div>

          <div className="font-mono text-[11px]" style={{ color: 'var(--text-muted)' }}>
            {activeModel ?? ''}
          </div>
        </div>
      </div>
    </>
  );
}
