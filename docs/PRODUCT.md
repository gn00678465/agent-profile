# Product

## What Is This?

Agent Profile is a desktop application for managing AI coding agent configuration files via a GUI. Users can view and edit settings, sessions, rules, skills, plugins, and MCP servers for multiple agents — without manually editing JSON or Markdown files in a terminal.

Currently supported agents:

| Agent | Config root |
|-------|-------------|
| Claude Code | `~/.claude/` |
| GitHub Copilot CLI | `~/.copilot/` |
| Gemini CLI | `~/.gemini/` |

---

## Core Features

### Settings Editor
Read and write each agent's JSON config file through an in-app JSON editor. Changes are saved immediately on click.

- Claude Code: `~/.claude/settings.json`
- Copilot: `~/.copilot/config.json`
- Gemini: `~/.gemini/settings.json`

### Markdown Editor
Edit instruction files (`CLAUDE.md`, `GEMINI.md`, `copilot-instructions.md`) with a plain-text editor. Unsaved changes are tracked and indicated in the UI.

### Session Viewer
Browse past conversation sessions for each agent:

- **Claude Code** — parses JSONL session files, renders message history
- **Gemini CLI** — reads hash-keyed and named session directories
- **Copilot CLI** — reads workspace YAML session files with checkpoint counts

Sessions can be deleted from within the app.

### Skills Manager
List, install, and delete agent skills (SKILL.md files):

- Browse installed skills with version and user-invocable badge
- Edit skill content in-app
- Install from ZIP archive
- Create symlinks to a shared skills directory

Supports Claude Code, Copilot, Gemini, and a cross-agent Shared skills pool.

### Plugin Manager (Claude Code)
View and manage Claude Code plugins from `~/.claude/plugins/installed_plugins.json`:

- Enable / disable individual plugins with a toggle
- Delete plugins
- Shows scope (user vs project), version, and marketplace

### Extension Manager (Gemini CLI)
Browse `~/.gemini/extensions/` directory:

- Lists installed extensions with description and version
- Deletes extensions

### MCP Server Editor
Edit MCP server configurations for each agent:

- Claude Code: `~/.claude/mcp.json` or `~/.claude.json`
- Copilot: `~/.copilot/mcp-config.json`
- Gemini: `~/.gemini/settings.json` (mcpServers key)

Supports command-string parsing: enter `npx server-package --flag` and the app parses it into `command` + `args` fields automatically.

### Rules Editor (Claude Code)
Manage `~/.claude/rules/**/*.md` files:

- Browse rules by folder
- Create new rules and rule folders
- Rename and delete rules / folders
- Edit rule content in-app

### Subagents Editor (Copilot)
Manage `~/.copilot/subagents/*.agent.md` files:

- List subagents
- Create, rename, delete subagents
- Edit agent definition Markdown in-app

---

## Non-Goals

- No cloud sync or remote configuration
- No AI model invocation (the app manages config, not conversations)
- No support for agents other than Claude Code, Copilot CLI, Gemini CLI

---

## UX Principles

- **Sidebar navigation** — agents shown as a persistent list; switching agent updates tabs
- **Agent theming** — each agent has a distinct accent color propagated to all UI components
- **Dark / light mode** — theme toggle in the sidebar header, preference persisted to localStorage
- **Collapsible sidebar** — saves horizontal space on small screens
