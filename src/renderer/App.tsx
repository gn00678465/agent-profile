import { useState, useEffect, useCallback } from 'react';
import { Toaster } from 'sonner';
import { useAgents } from './hooks/useAgents';
import { useTheme } from './hooks/useTheme';
import { Sidebar } from './components/layout/Sidebar';
import { ClaudePluginsView } from './components/agents/ClaudePlugins';
import { GeminiExtensionsView } from './components/agents/GeminiExtensions';
import { McpCommandEditor } from './components/editors/McpCommandEditor';
import { JsonFileEditor } from './components/editors/JsonFileEditor';
import { TomlFileEditor } from './components/editors/TomlFileEditor';
import { SkillsEditor } from './components/editors/SkillsEditor';
import { SharedSkillsPage } from './components/shared-skills/SharedSkillsPage';
import { MarkdownEditor } from './components/editors/MarkdownEditor';
import { GeminiSessionsView } from './components/editors/GeminiSessionsView';
import { ClaudeSessionsView } from './components/editors/ClaudeSessionsView';
import { RulesEditor } from './components/editors/RulesEditor';
import { SubagentsEditor } from './components/editors/SubagentsEditor';
import { CopilotSessionsView } from './components/editors/CopilotSessionsView';
import { Tabs, TabsList, TabsTrigger, TabsContent } from './components/ui/tabs';
import { electronAPI, callElectron } from './lib/electron';
import { PanelLeftClose, PanelLeft } from 'lucide-react';
import type { AgentProfile } from '@shared/types';

// ─── Agent theming ────────────────────────────────────────────────────────────

const AGENT_COLORS: Record<string, { primary: string; subtle: string }> = {
  'claude-code': { primary: '#d97706', subtle: 'rgba(217,119,6,0.08)' },
  copilot:       { primary: '#2eb88a', subtle: 'rgba(46,184,138,0.08)' },
  gemini:        { primary: '#7c6ef5', subtle: 'rgba(124,110,245,0.08)' },
  codex:         { primary: '#3941ff', subtle: 'rgba(57,65,255,0.08)' },
  shared:        { primary: '#6b7280', subtle: 'rgba(107,114,128,0.08)' },
};

const AGENT_GLYPHS: Record<string, string> = {
  'claude-code': '◉',
  copilot:       '▶',
  gemini:        '◆',
  codex:         '✦',
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
  codex: [
    { id: 'settings',  label: 'Settings' },
    { id: 'agents-md', label: 'AGENTS.md' },
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

// ─── Content view router ──────────────────────────────────────────────────────

interface ContentViewProps {
  agent: AgentProfile;
  activeTab: string;
  onTabChange: (tab: string) => void;
  onSelectAgentType?: (type: AgentProfile['type']) => void;
}

function ContentView({ agent, activeTab, onTabChange, onSelectAgentType }: ContentViewProps) {
  const { type, configDir, name } = agent;
  const color = agentColor(type);
  const tabs = AGENT_TABS[type] ?? [];

  function renderTabContent(tabId: string) {
    if (type === 'claude-code') {
      if (tabId === 'settings')  return <JsonFileEditor filePath={`${configDir}/settings.json`} title="Claude Code Settings" description={`${configDir}/settings.json`} />;
      if (tabId === 'plugins')   return <ClaudePluginsView configDir={configDir} accentColor={color.primary} />;
      if (tabId === 'skills')    return <SkillsEditor configDir={configDir} agentName={name} agentType={type} />;
      if (tabId === 'mcp') return <McpCommandEditor configDir={configDir} agentType="claude-code" />;
      if (tabId === 'claude-md') return (
        <MarkdownEditor filePath={`${configDir}/CLAUDE.md`} title="CLAUDE.md" description="Global instructions for Claude Code" />
      );
      if (tabId === 'sessions') return <ClaudeSessionsView configDir={configDir} agentColor={color.primary} />;
      if (tabId === 'rules')    return <RulesEditor configDir={configDir} accentColor={color.primary} />;
    }
    if (type === 'copilot') {
      if (tabId === 'settings') return <JsonFileEditor filePath={`${configDir}/config.json`} title="GitHub Copilot Settings" description={`${configDir}/config.json`} />;
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
      if (tabId === 'settings')   return <JsonFileEditor filePath={`${configDir}/settings.json`} title="Gemini CLI Settings" description={`${configDir}/settings.json`} />;
      if (tabId === 'sessions')   return <GeminiSessionsView configDir={configDir} agentColor={color.primary} />;
      if (tabId === 'extensions') return <GeminiExtensionsView configDir={configDir} accentColor={color.primary} />;
      if (tabId === 'skills')     return <SkillsEditor configDir={configDir} agentName={name} agentType={type} />;
      if (tabId === 'mcp')        return <McpCommandEditor configDir={configDir} agentType="gemini" />;
      if (tabId === 'gemini-md')  return (
        <MarkdownEditor filePath={`${configDir}/GEMINI.md`} title="GEMINI.md" description="Global instructions for Gemini CLI" />
      );
    }
    if (type === 'codex') {
      if (tabId === 'settings') return (
        <TomlFileEditor
          filePath={`${configDir}/config.toml`}
          title="config.toml"
          description="OpenAI Codex configuration (TOML)"
        />
      );
      if (tabId === 'agents-md') return (
        <MarkdownEditor filePath={`${configDir}/AGENTS.md`} title="AGENTS.md" description="Global instructions for OpenAI Codex" />
      );
    }
    if (type === 'shared') {
      if (tabId === 'skills') return <SharedSkillsPage configDir={configDir} onSelectAgentType={onSelectAgentType} />;
    }
    return <div className="flex h-full items-center justify-center text-muted-foreground text-sm">View not available</div>;
  }

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Agent header band */}
      <div
        className="flex shrink-0 items-center gap-3 border-b-whisper px-4 py-3"
        style={{ background: color.subtle }}
      >
        <span className="text-xl" style={{ color: color.primary }}>{AGENT_GLYPHS[type] ?? '◈'}</span>
        <div>
          <div className="font-mono text-sm font-semibold tracking-widest uppercase" style={{ color: color.primary }}>
            {name}
          </div>
          <div className="font-mono text-xs text-muted-foreground">{configDir}</div>
        </div>
      </div>

      {/* Section tabs (skipped for single-tab agents like shared) */}
      {tabs.length <= 1 ? (
        <div className="flex flex-1 flex-col overflow-hidden">
          {renderTabContent(tabs[0]?.id ?? activeTab)}
        </div>
      ) : (
        <Tabs value={activeTab} onValueChange={onTabChange} className="flex flex-1 flex-col overflow-hidden">
          <div className="shrink-0 border-b-whisper" style={{ background: 'var(--bg-base)' }}>
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
      )}
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
    // eslint-disable-next-line react/set-state-in-effect -- early return reset when no agent active
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
      // eslint-disable-next-line react/set-state-in-effect -- else branch for agents without model config
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
          className="titlebar-drag flex h-10 shrink-0 items-center justify-between border-b-whisper px-4"
          style={{ background: 'var(--bg-base)' }}
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
                onSelectAgentType={(type) => {
                  const target = agents.find((a) => a.type === type);
                  if (target) selectAgent(target.id);
                }}
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
          className="flex h-7 shrink-0 items-center justify-between border-t-[1px] border-t-[var(--border-subtle)] px-4"
          style={{ background: 'var(--bg-base)' }}
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

          <div className="flex items-center gap-2">
            {saveState.isSaving && (
              <span className="badge-notion">Saving...</span>
            )}
            {!saveState.isSaving && saveState.isDirty && (
              <span className="badge-notion">Unsaved</span>
            )}
            {!saveState.isSaving && !saveState.isDirty && saveState.lastSaved && (
              <span className="badge-notion">Saved</span>
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
