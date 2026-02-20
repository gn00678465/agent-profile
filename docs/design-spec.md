# Agent Profile Manager — Design Specification

**Date:** 2026-02-20
**Author:** Designer Agent
**Purpose:** UI/UX specification for the Electron desktop app managing Gemini, Copilot, and Claude Code agent settings

---

## 1. Design Direction & Aesthetic

### Concept: "Mission Control"

An **industrial-utilitarian** aesthetic inspired by aerospace control panels and professional developer tooling. Not a consumer app — this is a power user's cockpit. Think JetBrains IDEs meets Raycast meets a terminal with personality.

**Tone:** Controlled density. Dark theme as primary. Monospaced accents. Sharp geometric grid. Information-dense but never cluttered. Every element earns its place.

**What makes it unforgettable:** Each AI agent has its own distinct visual identity — a color signature, icon treatment, and subtle texture — so switching between agents feels like switching between instruments in an orchestra. The sidebar glows with the active agent's color. Status indicators pulse. The whole UI shifts personality when you select a different agent.

---

## 2. Color System

### Base Palette (Dark Theme)

```css
:root {
  /* Neutrals */
  --bg-base:        #0d0d0f;   /* deepest background */
  --bg-surface:     #141416;   /* card/panel background */
  --bg-raised:      #1c1c1f;   /* elevated elements */
  --bg-overlay:     #242428;   /* hover states, dropdowns */
  --border-subtle:  #2a2a2e;   /* dividers, borders */
  --border-strong:  #3d3d44;   /* focused borders */

  /* Text */
  --text-primary:   #f0f0f3;   /* main text */
  --text-secondary: #8b8b99;   /* labels, meta */
  --text-muted:     #4a4a56;   /* disabled, placeholder */
  --text-code:      #c5c5d0;   /* monospace content */

  /* Gemini Identity — Electric Indigo */
  --gemini-primary:   #7c6ef5;
  --gemini-accent:    #a99df7;
  --gemini-glow:      rgba(124, 110, 245, 0.15);
  --gemini-subtle:    rgba(124, 110, 245, 0.08);

  /* Copilot Identity — Emerald Teal */
  --copilot-primary:  #2eb88a;
  --copilot-accent:   #4ed4a6;
  --copilot-glow:     rgba(46, 184, 138, 0.15);
  --copilot-subtle:   rgba(46, 184, 138, 0.08);

  /* Claude Identity — Amber Copper */
  --claude-primary:   #d97706;
  --claude-accent:    #f59e0b;
  --claude-glow:      rgba(217, 119, 6, 0.15);
  --claude-subtle:    rgba(217, 119, 6, 0.08);

  /* Shared/System */
  --shared-primary:   #6b7280;
  --shared-accent:    #9ca3af;

  /* Status */
  --status-success:   #22c55e;
  --status-warning:   #f59e0b;
  --status-error:     #ef4444;
  --status-info:      #3b82f6;
}
```

### Light Theme Override (for system preference)

```css
[data-theme="light"] {
  --bg-base:        #f8f8fb;
  --bg-surface:     #ffffff;
  --bg-raised:      #f1f1f5;
  --bg-overlay:     #e8e8ed;
  --border-subtle:  #e2e2e8;
  --border-strong:  #c5c5ce;
  --text-primary:   #0f0f14;
  --text-secondary: #5a5a6b;
  --text-muted:     #9a9aab;
  /* Agent colors remain the same; adjust glows for light bg */
  --gemini-glow:    rgba(124, 110, 245, 0.10);
  --copilot-glow:   rgba(46, 184, 138, 0.10);
  --claude-glow:    rgba(217, 119, 6, 0.10);
}
```

---

## 3. Typography

```css
/* Font Stack */
--font-display:  'DM Mono', 'JetBrains Mono', monospace;   /* headings, agent names */
--font-body:     'Geist', 'Inter', sans-serif;              /* body text, labels */
--font-code:     'JetBrains Mono', 'Fira Code', monospace;  /* config values, paths, JSON */

/* Scale */
--text-xs:    11px;   /* meta, timestamps */
--text-sm:    12px;   /* secondary labels */
--text-base:  13px;   /* body text (dense desktop app scale) */
--text-md:    14px;   /* form labels, nav items */
--text-lg:    16px;   /* section headings */
--text-xl:    20px;   /* page titles */
--text-2xl:   24px;   /* agent name in sidebar */
```

---

## 4. Layout Architecture

### Overall Shell

```
┌─────────────────────────────────────────────────────────────────────┐
│  TITLE BAR (electron drag region)                           [─][□][✕]│
├──────────────────────────────────────────────────────────────────────┤
│  ┌──────────┐  ┌─────────────────────────────────────────────────┐  │
│  │          │  │  CONTENT AREA                                    │  │
│  │ AGENT    │  │                                                  │  │
│  │ SIDEBAR  │  │  ┌──────────────────────────────────────────┐   │  │
│  │  (220px) │  │  │ SECTION TABS (sticky)                    │   │  │
│  │          │  │  └──────────────────────────────────────────┘   │  │
│  │──────────│  │                                                  │  │
│  │ AGENT    │  │  ┌──────────────────────────────────────────┐   │  │
│  │ SELECTOR │  │  │ ACTIVE SECTION CONTENT (scrollable)      │   │  │
│  │ LIST     │  │  │                                          │   │  │
│  │          │  │  │                                          │   │  │
│  │──────────│  │  └──────────────────────────────────────────┘   │  │
│  │ SHARED   │  │                                                  │  │
│  │ SKILLS   │  │                                                  │  │
│  │ (footer) │  │                                                  │  │
│  └──────────┘  └─────────────────────────────────────────────────┘  │
├──────────────────────────────────────────────────────────────────────┤
│  STATUS BAR: last saved • file path • model indicator               │
└─────────────────────────────────────────────────────────────────────┘
```

### Dimensions (Electron desktop)

| Region | Width | Notes |
|--------|-------|-------|
| Sidebar | 220px (fixed) | Collapsible to 56px (icon-only) |
| Content | flex-1 | Min 600px |
| Window min-width | 820px | |
| Window min-height | 560px | |

---

## 5. Component Specifications

### 5.1 Title Bar

```
┌─────────────────────────────────────────────────────────────────────┐
│  ◈ AGENT PROFILE MANAGER          ░░░░░░░░░░░░           [─][□][✕] │
└─────────────────────────────────────────────────────────────────────┘
```

**Specs:**
- Height: 40px
- Background: `var(--bg-base)` with 1px bottom border (`var(--border-subtle)`)
- `-webkit-app-region: drag` on the full bar
- Buttons: `-webkit-app-region: no-drag`
- App icon: geometric diamond `◈` in active agent's primary color
- Font: `var(--font-display)`, `--text-sm`, letter-spacing: 0.08em
- Window controls: custom-drawn circles (macOS style) or system buttons

---

### 5.2 Agent Sidebar

```
┌──────────────────────┐
│  ◈ Agent Profile     │  ← App name (collapsed: ◈)
│  Manager             │
├──────────────────────┤
│  AGENTS              │  ← Section label
│                      │
│ ┌──────────────────┐ │
│ │ ◆  Gemini        │ │  ← Active agent (highlighted)
│ │    CLI · active  │ │
│ └──────────────────┘ │
│                      │
│   ◇  Copilot         │  ← Inactive
│   ◇  Claude Code     │  ← Inactive
│                      │
├──────────────────────┤
│  SHARED              │  ← Section label
│   ◈  ~/.agents/      │
├──────────────────────┤
│  [⚙] Settings  [?]  │  ← App settings, help
└──────────────────────┘
```

**Specs:**
- Width: 220px, dark background `var(--bg-surface)`
- 1px right border: `var(--border-subtle)`
- Active agent item: background `var(--{agent}-subtle)`, left border 2px solid `var(--{agent}-primary)`
- Agent icon: colored diamond/square (each agent has unique glyph treatment)
- Hover state: `var(--bg-raised)` background
- Section labels: `var(--text-muted)`, `--text-xs`, uppercase, letter-spacing: 0.12em
- Collapse toggle: chevron button at bottom, animates sidebar width

**Agent Sidebar Items:**
```tsx
interface AgentSidebarItem {
  id: 'gemini' | 'copilot' | 'claude' | 'shared';
  label: string;          // "Gemini", "Copilot", "Claude Code", "Shared"
  sublabel: string;       // "CLI · ~/.gemini/", "CLI · ~/.copilot/", etc.
  icon: ReactNode;        // SVG glyph — unique per agent
  color: string;          // CSS var reference
  isActive: boolean;
  hasUnsavedChanges: boolean;  // shows dot indicator
}
```

---

### 5.3 Section Tabs

Tabs appear inside the content area, below agent header. Tabs visible depend on agent capabilities.

```
┌──────────┬──────────┬──────────┬──────────┬──────────┬──────────┐
│ Settings │ Sessions │  Skills  │ Plugins  │ Markdown │   MCP    │
└──────────┴──────────┴──────────┴──────────┴──────────┴──────────┘
```

**Availability matrix per agent:**

| Tab | Gemini | Copilot | Claude | Shared |
|-----|--------|---------|--------|--------|
| Settings | YES | YES | YES | — |
| Sessions | YES (`tmp/`) | YES (`session-state/`) | — | — |
| Skills | YES | YES | YES | YES |
| Extensions/Plugins | YES (Extensions) | — | YES (Plugins+Marketplace) | — |
| Markdown | YES (`GEMINI.md`) | — | YES (`CLAUDE.md`) | — |
| MCP Servers | YES (via extensions) | YES (`mcp-config.json`) | YES (via plugins) | — |

**Specs:**
- Tab bar: sticky, `var(--bg-surface)`, 1px bottom border
- Tab items: `var(--font-body)`, `--text-md`, padding: 10px 16px
- Active tab: text color `var(--{agent}-accent)`, bottom border 2px `var(--{agent}-primary)`
- Disabled/unavailable tabs: hidden (not shown as greyed out — cleaner)
- Tab icons: 14px stroke icons, color inherits from tab state

---

### 5.4 Agent Header Band

Appears at the top of the content area, above tabs:

```
┌─────────────────────────────────────────────────────────────────────┐
│  ◆  GEMINI                              ~/.gemini/settings.json     │
│     Google Gemini CLI                   ○ All changes saved         │
└─────────────────────────────────────────────────────────────────────┘
```

**Specs:**
- Height: 64px, background: `var(--{agent}-subtle)` with subtle gradient
- Left: large agent icon (28px) + agent name in `var(--font-display)`, `--text-xl`
- Sub-text: description + config file path in `var(--font-code)`, `--text-xs`
- Right: file path badge + save status indicator
- Bottom: 1px border in `var(--{agent}-primary)` at 30% opacity

---

### 5.5 Settings Tab

All three agents use a **JSON editor** as the sole interface for settings. No form UI — direct JSON editing with inline validation and one-click formatting.

#### Common Layout (Gemini / Copilot / Claude)

```
┌─────────────────────────────────────────────────────────────────────┐
│  {Agent} Settings           [◉ Format] [↺ Refresh] [Save ▶]        │
│  ~/.{agent}/settings.json                                           │
├─────────────────────────────────────────────────────────────────────┤
│ ⚠  settings.json does not exist yet. Changes will create the file.  │  ← amber banner (if file absent)
├─────────────────────────────────────────────────────────────────────┤
│ ✕  {parse error message}                                            │  ← red banner (on invalid JSON)
├─────────────────────────────────────────────────────────────────────┤
│  1  {                                                               │
│  2    "model": "opus",                                              │
│  3    "permissions": {                                              │
│  4      "allow": [                                                  │
│  5        "Bash(*)"                                                 │  ← CodeMirror JSON editor
│  6      ]                                                           │     (fills remaining height)
│  7    },                                                            │
│  8    "env": {                                                      │
│  9      "ANTHROPIC_MODEL": "claude-opus-4-6"                       │
│ 10    }                                                             │
│ 11  }                                                               │
│  ~                                                                  │
│  ~                                                                  │
└─────────────────────────────────────────────────────────────────────┘
```

**Toolbar Actions:**

| Button | Icon | Behaviour |
|--------|------|-----------|
| Format | `Braces` | `JSON.parse` → `JSON.stringify(_, null, 2)` — pretty-prints in-place; shows red banner if JSON is currently invalid |
| Refresh | `RefreshCw` | Reloads file from disk, discards unsaved edits, clears error banners |
| Save | `Save` | Parses JSON; on syntax error shows red banner and aborts; on success writes file via Electron IPC and resets dirty flag |

Save is **disabled** while `isDirty === false` or while a save is in-flight (`Saving...`).

**Inline Validation:**

The editor runs `jsonParseLinter()` (from `@codemirror/lang-json` + `@codemirror/lint`) continuously. Syntax errors appear as **red wavy underlines** directly on the offending token — no separate action required.

**Error Banners** (appear between toolbar and editor, stacked if multiple):
- **Amber** — file does not exist yet; will be created on first save
- **Red** — JSON parse error from Format or Save attempt; cleared on next valid keystroke or successful action
- **Red** — backend load/save error from Electron IPC

**Settings Component Specs:**
- Toolbar: `height: auto`, 1px bottom border `var(--border-border)`, `px-4 py-2`
- Editor: `flex-1 overflow-hidden`, CodeMirror fills 100% height with no internal scrollbar (CodeMirror handles its own overflow)
- Font: `var(--font-code)`, `11px` (CodeMirror `text-xs`)
- Dark theme: `oneDark` from `@codemirror/theme-one-dark`; light theme: CodeMirror default
- Line numbers, code folding, active-line highlight, `tabSize: 2`, `indentOnInput: true`
- `Ctrl+S` / `Cmd+S`: triggers Save (inherited from global keybinding layer)

---

### 5.6 Sessions Tab

```
┌─ SESSIONS (24 sessions) ────────────────────────────── [🗑 Clear All] ─┐
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ [search sessions...]                                            │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
│  ┌─────────────────────────────────────────────────────────────────┐   │
│  │ 📁 auto-caption                              2026-01-15  →      │   │
│  │    ~/.gemini/tmp/auto-caption/                                  │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 📁 handbrake-agent                           2026-01-12  →      │   │
│  │    ~/.gemini/tmp/handbrake-agent/                               │   │
│  ├─────────────────────────────────────────────────────────────────┤   │
│  │ 📁 a3f8d2c1... (unnamed)                     2026-01-10  →      │   │
│  │    ~/.gemini/tmp/a3f8d2c1.../                                   │   │
│  └─────────────────────────────────────────────────────────────────┘   │
│                                                                         │
└─────────────────────────────────────────────────────────────────────────┘
```

**Session Detail Drawer (side panel, 360px):**
```
┌─ SESSION DETAIL ──────────────────────────[✕]─┐
│                                               │
│  handbrake-agent                              │
│  ~/.gemini/tmp/handbrake-agent/               │
│                                               │
│  Created    2026-01-12 09:41                  │
│  Updated    2026-01-12 14:22                  │
│                                               │
│  ┌──────────────────────────────────────┐     │
│  │ chats/          2 files              │     │
│  │ tool-outputs/   8 files              │     │
│  │ logs.json       14 KB                │     │
│  └──────────────────────────────────────┘     │
│                                               │
│  [Open in Explorer]    [Delete Session]       │
│                                               │
└───────────────────────────────────────────────┘
```

**For Copilot sessions** — shows `workspace.yaml` metadata:
- Summary text (truncated to 2 lines)
- cwd path
- Created/updated timestamps
- Checkpoint count

**Specs:**
- Session list: virtualized if >50 sessions (use `@tanstack/react-virtual`)
- Row: 72px height, hover shows delete icon (right side)
- Named sessions: folder icon; hash-named: code icon with truncated hash
- Search: filters by name or path, real-time

---

### 5.7 Skills Tab

```
┌─ SKILLS ────────────────────────────────────────────────────────────┐
│                                                                      │
│  Source     [All Sources ▼]   (All / Agent-specific / Shared)       │
│                                                                      │
│  ┌────────────────────────────────────────────────────────────┐     │
│  │  planning-with-files              v2.3.0     [agent]  →    │     │
│  │  Manus-style file-based planning workflow                  │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │  skill-creator                    v1.0.0     [agent]  →    │     │
│  │  Guide for creating new skills                             │     │
│  ├────────────────────────────────────────────────────────────┤     │
│  │  frontend-design                  v1.0.0     [shared] →    │     │
│  │  Frontend design assistance                                │     │
│  └────────────────────────────────────────────────────────────┘     │
│                                                                      │
│  [+ Add Skill]   [Open Skills Folder]                               │
└──────────────────────────────────────────────────────────────────────┘
```

**Skill Detail Panel (inline expand):**
```
┌─ planning-with-files ─────────────────────────────────────────────┐
│                                                                    │
│  Version: 2.3.0   User-invocable: YES   License: MIT             │
│  Path: ~/.gemini/skills/planning-with-files/                      │
│                                                                    │
│  Description:                                                      │
│  Manus-style file-based planning workflow for complex tasks       │
│                                                                    │
│  Allowed Tools:                                                    │
│  Read  Write  Edit  Bash  Glob  Grep                              │
│                                                                    │
│  Hooks: PreToolUse (Write|Edit|Bash)  PostToolUse (Write|Edit)   │
│                                                                    │
│  Files:                                                           │
│  SKILL.md  scripts/  references/  templates/                      │
│                                                                    │
│  [Edit SKILL.md]   [Open Folder]   [Remove]                      │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Skill Source Badges:**
- `[agent]` — amber, from agent-specific directory
- `[shared]` — grey, from `~/.agents/skills/`
- `[plugin]` — agent-primary color, from plugin cache (Claude only)

---

### 5.8 Extensions/Plugins Tab

#### Gemini — Extensions View

```
┌─ EXTENSIONS ──────────────────────────────────────────────────────┐
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  ✓ context7                   MCP-based    [enabled] →   │     │
│  │    Up-to-date code docs for any prompt                   │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  ✓ code-review                Context      [enabled] →   │     │
│  │    Code review context injector                          │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  ✓ genkit                     Context      [enabled] →   │     │
│  │    Genkit framework context                              │     │
│  ├──────────────────────────────────────────────────────────┤     │
│  │  ✓ ralph                      Context      [enabled] →   │     │
│  │    Ralph assistant context                               │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  [+ Add Extension]   [Open Extensions Folder]                     │
└────────────────────────────────────────────────────────────────────┘
```

**Extension Detail:** Shows `gemini-extension.json` fields, scope overrides (path patterns), MCP server config if present.

#### Claude — Plugins View (more complex)

```
┌─ INSTALLED PLUGINS (11) ─────────────────────── [+ Browse Marketplace] ─┐
│                                                                          │
│  Filter   [All ▼]  (All / User-scope / Project-scope)                   │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  ✓ context7              v8deab8  [user]  [claude-plugins-offic.] │   │
│  │    Up-to-date code docs           [enabled]                 →    │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  ✓ superpowers           v4.0.3   [user]  [superpowers-market.]  │   │
│  │    Power tools for Claude         [enabled]                 →    │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  ✗ github                v8deab8  [user]  [claude-plugins-offic.] │   │
│  │    GitHub integration             [disabled]                →   │   │
│  ├──────────────────────────────────────────────────────────────────┤   │
│  │  ✓ claude-mem            v7.4.1   [proj]  [thedotmack]           │   │
│  │    Memory management              [enabled]                 →    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
└──────────────────────────────────────────────────────────────────────────┘
```

**Plugin Detail Panel:**
```
┌─ context7 ────────────────────────────────────────────────────────┐
│  context7@claude-plugins-official                                 │
│                                                                    │
│  Version:     8deab8460a9d (git sha)                              │
│  Scope:       user                                                │
│  Marketplace: claude-plugins-official                             │
│  Author:      Anthropic (support@anthropic.com)                  │
│                                                                    │
│  Installed:   2026-01-10                                          │
│  Updated:     2026-02-01                                          │
│  Install Path: ~/.claude/plugins/cache/...                        │
│                                                                    │
│  Contains:  ○ Skills  ● MCP Server  ○ Agents                     │
│                                                                    │
│  [Enable/Disable]   [Uninstall]   [Open Cache Folder]            │
└────────────────────────────────────────────────────────────────────┘
```

**Marketplace Browser (modal sheet):**
```
┌─────────────────────────────────────────────────────────────────────┐
│  PLUGIN MARKETPLACE                               [✕ Close]         │
├─────────────────────────────────────────────────────────────────────┤
│  [All Marketplaces ▼]   [search plugins...]                         │
├─────────────────────────────────────────────────────────────────────┤
│  Marketplaces: ● claude-plugins-official  ○ superpowers  ○ ...     │
├─────────────────────────────────────────────────────────────────────┤
│  ┌───────────────┐  ┌───────────────┐  ┌───────────────┐           │
│  │ agent-sdk-dev │  │ clangd-lsp    │  │ code-review   │           │
│  │ Anthropic     │  │ Anthropic     │  │ Anthropic     │           │
│  │               │  │               │  │               │           │
│  │ [Install]     │  │ [Install]     │  │ ✓ Installed   │           │
│  └───────────────┘  └───────────────┘  └───────────────┘           │
└─────────────────────────────────────────────────────────────────────┘
```

---

### 5.9 Markdown Tab

#### Gemini (`GEMINI.md`) and Claude (`CLAUDE.md`)

```
┌─ GLOBAL INSTRUCTIONS (GEMINI.md) ─────────────────────────────────┐
│                                                                    │
│  This file provides global context instructions to Gemini.        │
│  Path: ~/.gemini/GEMINI.md                                        │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │                                                          │     │
│  │  (File is empty — no global instructions configured)    │     │
│  │                                                          │     │
│  │  Click to add instructions...                           │     │
│  │                                                          │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  [Edit in External Editor]   [Save]   [Clear]                     │
└────────────────────────────────────────────────────────────────────┘
```

When file does not exist (Claude `CLAUDE.md`):
```
┌─ GLOBAL INSTRUCTIONS (CLAUDE.md) ─────────────────────────────────┐
│                                                                    │
│  ⚠  CLAUDE.md does not exist yet.                                 │
│     Create it to add global instructions for Claude Code.         │
│                                                                    │
│  [Create CLAUDE.md]                                               │
│                                                                    │
└────────────────────────────────────────────────────────────────────┘
```

**Editor Specs:**
- Monaco Editor or CodeMirror with Markdown syntax highlighting
- Agent color accent for cursor and selection
- Toolbar: Bold, Italic, Code, Heading buttons
- Live preview toggle (split pane)
- Auto-save with 2s debounce (shows "Saving..." indicator)

**Markdown tab unavailable:** Copilot has no COPILOT.md — this tab is hidden for Copilot.

---

### 5.10 MCP Servers Tab

#### Copilot (`mcp-config.json`)

```
┌─ MCP SERVERS ─────────────────────────────────────────── [+ Add Server] ─┐
│                                                                           │
│  ┌───────────────────────────────────────────────────────────────────┐   │
│  │  MCP_DOCKER                          local  tools:*         →     │   │
│  │  docker mcp gateway run                                           │   │
│  ├───────────────────────────────────────────────────────────────────┤   │
│  │  serena                              local  tools:*         →     │   │
│  │  uvx --from git+https://...          serena start-mcp-server      │   │
│  └───────────────────────────────────────────────────────────────────┘   │
│                                                                           │
└───────────────────────────────────────────────────────────────────────────┘
```

**MCP Server Detail / Edit Form:**
```
┌─ Edit: MCP_DOCKER ────────────────────────────────────────────────┐
│                                                                    │
│  Name        [MCP_DOCKER              ]                           │
│  Type        [local ▼]  (local / remote)                         │
│  Command     [docker                  ]                           │
│  Args        [mcp                    ] [gateway        ]         │
│              [run                    ] [+ Add Arg]               │
│  Tools       [* (all) ▼]  or specify: [+ Add Tool]              │
│  Env Vars    (none)  [+ Add]                                     │
│                                                                    │
│  [Cancel]                                         [Save Changes] │
└────────────────────────────────────────────────────────────────────┘
```

#### Gemini MCP (via Extensions)

MCP tab for Gemini shows MCP servers that are defined inside extensions:
```
┌─ MCP SERVERS (via extensions) ────────────────────────────────────┐
│                                                                    │
│  These are configured inside extensions. Edit in Extensions tab.  │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  context7        (from context7 extension)         →     │     │
│  │  npx -y @upstash/context7-mcp                            │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  [Go to Extensions →]                                             │
└────────────────────────────────────────────────────────────────────┘
```

#### Claude MCP (via Plugins)

```
┌─ MCP SERVERS (via plugins) ───────────────────────────────────────┐
│                                                                    │
│  MCP servers are provided by installed plugins.                   │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  context7-mcp      (from context7 plugin)          →     │     │
│  │  npx @upstash/context7-mcp  [enabled]                    │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  [Go to Plugins →]                                                │
└────────────────────────────────────────────────────────────────────┘
```

**Shared Config View:** The MCP tab also shows the combined `mcpServers: {}` block from Gemini's `settings.json` (currently empty, editable as raw JSON).

---

## 6. Shared / Cross-Agent Tab (~/.agents/)

When "Shared (~/.agents/)" is selected in sidebar:

```
┌─ SHARED AGENT RESOURCES ──────────────────────────────────────────┐
│  ◈  ~/.agents/                                                    │
│     Shared skills available to all agents                         │
├───────────────────────────────────────────────────────────────────┤

  [Skills] ← only tab shown for shared

┌─ SHARED SKILLS (5) ───────────────────────────────────────────────┐
│                                                                    │
│  Skills here are loaded by all agents before agent-specific ones. │
│                                                                    │
│  ┌──────────────────────────────────────────────────────────┐     │
│  │  agent-browser           v1.0.0     [shared]        →   │     │
│  │  frontend-design         v1.0.0     [shared]        →   │     │
│  │  commit-message          v1.0.0     [shared]        →   │     │
│  │  find-skills             v1.0.0     [shared]        →   │     │
│  │  github-pr               v1.0.0     [shared]        →   │     │
│  └──────────────────────────────────────────────────────────┘     │
│                                                                    │
│  [+ Add Shared Skill]   [Open ~/.agents/skills/]                 │
└────────────────────────────────────────────────────────────────────┘
```

---

## 7. Status Bar

```
┌─────────────────────────────────────────────────────────────────────┐
│  Gemini · ~/.gemini/settings.json    ●  All changes saved    opus  │
└─────────────────────────────────────────────────────────────────────┘
```

**Specs:**
- Height: 28px
- Background: `var(--bg-base)`, 1px top border `var(--border-subtle)`
- Left: active agent name + file path (in `var(--font-code)`, `--text-xs`)
- Center: save status dot (green = saved, amber = unsaved, pulsing = saving)
- Right: active model indicator

---

## 8. Interaction Patterns

### Save Strategy
- Settings changes are tracked in local state
- "Unsaved" dot shows on sidebar item and save button appears
- `Ctrl+S` / `Cmd+S` triggers save
- Save writes JSON/YAML file to disk via Electron IPC
- Confirm dialog shown for destructive actions (delete session, uninstall plugin)

### Keyboard Navigation
| Shortcut | Action |
|----------|--------|
| `Ctrl+1/2/3` | Switch to Gemini/Copilot/Claude |
| `Ctrl+Tab` | Cycle through agents |
| `Ctrl+S` | Save current agent settings |
| `Ctrl+F` | Focus search (in sessions/skills) |
| `Escape` | Close open panel/detail |
| `Ctrl+,` | Open app settings |

### Error States
- **Invalid JSON (settings editor):** red wavy underline on the offending token via `jsonParseLinter` — continuous, no action required
- **Format / Save with invalid JSON:** red banner between toolbar and editor; cleared on next valid edit
- **File not found:** amber banner between toolbar and editor; file is created on first Save
- **Save failure (IPC / permission):** red banner + Sonner toast (bottom-right, 4 s)
- **Permission error:** modal with details

### Empty States
- Sessions: "No sessions found" with folder icon and path
- Skills: "No skills installed" with add button
- Plugins: "No plugins installed" with marketplace button

---

## 9. Component Library Mapping (shadcn/ui)

| UI Element | Component | Notes |
|------------|-----------|-------|
| Toggle settings | shadcn `Switch` | Colored per agent |
| Dropdowns | shadcn `Select` | |
| Text inputs | shadcn `Input` | |
| Action buttons | shadcn `Button` (variant: outline, ghost, destructive) | |
| Tab navigation | shadcn `Tabs`, `TabsList`, `TabsTrigger` | |
| Confirm dialogs | shadcn `AlertDialog` | |
| Detail panels | shadcn `Sheet` (side panel) | |
| Toast notifications | `Sonner` | |
| Tooltips | shadcn `Tooltip` | |
| Badges | shadcn `Badge` | Scope/source indicators |
| Command palette | shadcn `Command` | Search across all agents |
| Popover menus | shadcn `Popover` | Context menus |
| Modal marketplace | shadcn `Dialog` | Full-screen sheet |
| **JSON settings editor** | **`JsonEditor` — `@uiw/react-codemirror`** | **Settings tab for all agents; JSON syntax highlighting, inline linting (`jsonParseLinter`), Format + Refresh + Save toolbar, light/dark via `useTheme`** |
| Markdown editor | CodeMirror (Markdown mode) | GEMINI.md / CLAUDE.md tab |
| Scrollable lists | Custom + `@tanstack/react-virtual` | For large session lists |
| Separator | shadcn `Separator` | Section dividers |
| Skeleton | shadcn `Skeleton` | Loading states |

---

## 10. Component Hierarchy

```
App
├── TitleBar
│   ├── AppIcon
│   ├── AppName
│   └── WindowControls
├── MainLayout
│   ├── AgentSidebar
│   │   ├── AgentSidebarHeader
│   │   ├── AgentList
│   │   │   └── AgentSidebarItem (×4: Gemini, Copilot, Claude, Shared)
│   │   ├── SharedSection
│   │   │   └── AgentSidebarItem (Shared)
│   │   └── SidebarFooter (AppSettings, Help)
│   └── ContentArea
│       ├── AgentHeader
│       │   ├── AgentIcon
│       │   ├── AgentTitle
│       │   └── SaveStatus
│       ├── SectionTabs
│       │   └── TabTrigger (×up to 6 per agent)
│       └── TabContent (active tab)
│           ├── SettingsTab  (JSON editor — all agents)
│           │   ├── SettingsToolbar (Format | Refresh | Save)
│           │   ├── ErrorBanner (amber: file absent | red: JSON error | red: IPC error)
│           │   └── JsonEditor (@uiw/react-codemirror, jsonParseLinter, oneDark/light)
│           ├── SessionsTab
│           │   ├── SessionSearch
│           │   ├── SessionList
│           │   │   └── SessionListItem
│           │   └── SessionDetailPanel (Sheet)
│           ├── SkillsTab
│           │   ├── SkillSourceFilter
│           │   ├── SkillList
│           │   │   └── SkillListItem (expandable)
│           │   └── SkillDetailPanel (inline expand)
│           ├── ExtensionsPluginsTab
│           │   ├── PluginList
│           │   │   └── PluginListItem
│           │   ├── PluginDetailPanel
│           │   └── MarketplaceModal (Dialog)
│           ├── MarkdownTab
│           │   ├── MarkdownEditor (Monaco/CodeMirror)
│           │   └── MarkdownPreview
│           └── McpServersTab
│               ├── McpServerList
│               │   └── McpServerItem
│               └── McpServerEditForm
└── StatusBar
    ├── ActiveAgentPath
    ├── SaveIndicator
    └── ModelIndicator
```

---

## 11. Animation & Motion

- **Sidebar agent switch:** 200ms ease-out fade + left-border color transition
- **Tab change:** 150ms fade between tab panels
- **Detail panel open:** Sheet slides in 250ms from right (or expand inline)
- **Toggle switches:** 150ms transition (shadcn default)
- **Status indicator:** Pulse keyframe on "saving..." state
- **Unsaved dot:** Subtle scale bounce when change is made
- **Toast:** Slide in from bottom-right, auto-dismiss with progress bar

---

## 12. Agent Visual Identity Summary

| Agent | Primary Color | Icon Glyph | Theme Signature |
|-------|--------------|------------|----------------|
| Gemini | `#7c6ef5` (Indigo) | ◆ filled diamond | Starfield/cosmic feel |
| Copilot | `#2eb88a` (Teal) | ▶ filled chevron | Sharp, code-editor feel |
| Claude | `#d97706` (Amber) | ◉ circled dot | Warm, editorial feel |
| Shared | `#6b7280` (Gray) | ◈ outlined diamond | Neutral, system feel |

Each agent's active tab bar, section headers, toggle colors, and sidebar highlight all shift to use that agent's primary color. This creates a cohesive, identity-driven experience where the entire UI "belongs" to the selected agent.

---

## 13. File Paths Reference

| Agent | Settings File | Sessions | Skills | Extensions/Plugins |
|-------|--------------|---------|--------|-------------------|
| Gemini | `~/.gemini/settings.json` | `~/.gemini/tmp/` | `~/.gemini/skills/` | `~/.gemini/extensions/` |
| Copilot | `~/.copilot/config.json` | `~/.copilot/session-state/` | `~/.copilot/skills/` | — |
| Claude | `~/.claude/settings.json` | `~/.claude/history.jsonl` | `~/.claude/skills/` | `~/.claude/plugins/` |
| Shared | — | — | `~/.agents/skills/` | — |

MCP config: Copilot → `~/.copilot/mcp-config.json`; Gemini → inside extension JSONs; Claude → inside plugin cache `.mcp.json`

---

*End of Design Specification*
