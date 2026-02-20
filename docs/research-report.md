# AI Agent Directory Structures & Config Files - Research Report

**Date:** 2026-02-20
**Author:** Research Agent
**Purpose:** Document AI agent config structures for the UI/UX designer and full-stack engineer

---

## Executive Summary

All four agent directories exist under `C:/Users/gn006/`:
- `~/.gemini/` - Google Gemini CLI
- `~/.copilot/` - GitHub Copilot CLI
- `~/.claude/` - Claude Code CLI
- `~/.agents/` - Shared cross-agent directory

---

## 1. Gemini (`~/.gemini/`)

### Top-Level Directory Structure

```
~/.gemini/
├── antigravity/                  # (undocumented, likely internal)
├── extensions/                   # Plugin/Extension definitions
│   ├── extension-enablement.json # Extension enable/override config
│   ├── code-review/              # Extension folder
│   ├── context7/                 # Extension folder
│   ├── genkit/                   # Extension folder
│   └── ralph/                    # Extension folder
├── GEMINI.md                     # Global markdown instructions (empty/1 line)
├── google_accounts.json          # Linked Google account info
├── history/                      # Conversation history by topic
│   ├── auto-caption/
│   ├── faster-whisper-transwithai-chickenrice/
│   ├── handbrake-agent/
│   └── nfo-editor/
├── installation_id               # Unique install identifier (raw string)
├── oauth_creds.json              # OAuth token/credentials
├── projects.json                 # Project registry
├── settings.json                 # Main settings file
├── settings.json.orig            # Backup of older settings
├── skills/                       # User-installed skills
│   ├── planning-with-files/
│   └── skill-creator/
├── state.json                    # UI state tracking
├── tmp/                          # Session cache (hash-named folders)
│   ├── <sha256-hash>/            # Per-session directory
│   │   ├── chats/                # Chat history files
│   │   ├── logs.json             # Session logs
│   │   └── tool-outputs/         # Tool result cache
│   └── auto-caption/             # Named session
└── trustedFolders.json           # Trusted directory list
```

### Settings (`~/.gemini/settings.json`)

```json
{
  "ide": {
    "hasSeenNudge": true
  },
  "security": {
    "auth": {
      "selectedType": "oauth-personal"
    }
  },
  "general": {
    "previewFeatures": true,
    "vimMode": true,
    "sessionRetention": {
      "enabled": true
    },
    "enablePromptCompletion": true
  },
  "ui": {
    "hideContextSummary": false,
    "showMemoryUsage": true,
    "showModelInfoInChat": true
  },
  "experimental": {
    "skills": true
  },
  "mcpServers": {}
}
```

**Schema Notes:**
- `ide` - IDE integration state tracking
- `security.auth.selectedType` - Auth method: `"oauth-personal"` | `"oauth-workspace"` | `"api-key"`
- `general.previewFeatures` - boolean
- `general.vimMode` - boolean
- `general.sessionRetention.enabled` - boolean
- `general.enablePromptCompletion` - boolean
- `ui.hideContextSummary` - boolean
- `ui.showMemoryUsage` - boolean
- `ui.showModelInfoInChat` - boolean
- `experimental.skills` - boolean (feature flag for skills)
- `mcpServers` - object (empty = no MCP servers configured in settings; see extensions for MCP)

### Extensions/Plugins (`~/.gemini/extensions/`)

#### `extension-enablement.json` Schema
```json
{
  "<extension-name>": {
    "overrides": [
      "/C:/Users/gn006/*"   // glob patterns for project scope
    ]
  }
}
```
Currently enabled extensions with overrides:
- `genkit`, `context7`, `code-review`, `ralph`

#### Extension Folder Structure
Each extension has a `gemini-extension.json` manifest:

**Minimal extension** (code-review):
```json
{
  "name": "code-review",
  "version": "0.1.0",
  "contextFileName": "GEMINI.md"
}
```

**MCP-based extension** (context7):
```json
{
  "name": "context7",
  "description": "Up-to-date code docs for any prompt",
  "version": "1.0.0",
  "mcpServers": {
    "context7": {
      "command": "npx",
      "args": ["-y", "@upstash/context7-mcp", "--api-key", "${CONTEXT7_API_KEY}"]
    }
  }
}
```

Additionally, some extensions include a `server.json` with the MCP Server Registry schema:
```json
{
  "$schema": "https://static.modelcontextprotocol.io/schemas/2025-12-11/server.schema.json",
  "name": "io.github.upstash/context7",
  "title": "Context7",
  "description": "...",
  "repository": { "url": "...", "source": "github" },
  "websiteUrl": "...",
  "icons": [{ "src": "...", "mimeType": "image/png" }],
  "version": "2.0.0",
  "packages": [
    {
      "registryType": "npm",
      "identifier": "@upstash/context7-mcp",
      "version": "2.0.2",
      "transport": { "type": "stdio" },
      "environmentVariables": [
        {
          "name": "CONTEXT7_API_KEY",
          "description": "API key for authentication",
          "isRequired": false,
          "isSecret": true
        }
      ]
    }
  ],
  "remotes": [
    {
      "type": "streamable-http",
      "url": "https://mcp.context7.com/mcp",
      "headers": [...]
    }
  ]
}
```

### Sessions (`~/.gemini/tmp/`)

Session folders are named with SHA256 hashes. Each session folder contains:
```
<sha256-hash>/
├── chats/          # Chat history (empty or markdown files)
├── logs.json       # Session logs
└── tool-outputs/   # Tool result artifacts
```

Some named sessions also exist (e.g., `auto-caption/`, `faster-whisper-transwithai-chickenrice/`, `handbrake-agent/`, `nfo-editor/`) directly under `history/` for named contexts.

### Skills (`~/.gemini/skills/`)

Only 2 installed:
- `planning-with-files/` (v2.3.0) - Manus-style file-based planning
- `skill-creator/` - Guides creating new skills

Skill folder structure:
```
skill-name/
├── SKILL.md         # Required: frontmatter + instructions
├── scripts/         # Executable automation scripts
├── references/      # Reference docs loaded on demand
├── templates/       # File templates
└── examples.md      # Usage examples (optional)
```

SKILL.md frontmatter schema:
```yaml
---
name: skill-name
version: "2.3.0"
description: "What it does and when to use it"
user-invocable: true         # optional
license: "..."               # optional
allowed-tools:               # optional list
  - Read
  - Write
hooks:                       # optional
  PreToolUse:
    - matcher: "Write|Edit|Bash"
      hooks:
        - type: command
          command: "..."
  PostToolUse:
    - matcher: "Write|Edit"
      hooks:
        - type: command
          command: "..."
  Stop:
    - hooks:
        - type: command
          command: "..."
---
```

### Markdown (`~/.gemini/GEMINI.md`)
- File exists but is essentially empty (1 line, no meaningful content)
- Intended to hold global context/instructions for Gemini

### Other Notable Files
- `google_accounts.json`: `{ "active": "email@gmail.com", "old": [] }`
- `state.json`: UI counters `{ "defaultBannerShownCount": {...}, "tipsShown": 10 }`
- `trustedFolders.json`: List of trusted project paths
- `projects.json`: Project registry
- `installation_id`: Raw UUID string

---

## 2. Copilot (`~/.copilot/`)

### Top-Level Directory Structure

```
~/.copilot/
├── command-history-state.json    # CLI command history
├── config.json                   # Main settings file
├── history-session-state/        # (legacy or alternative session storage)
├── ide/                          # IDE integration state
├── instructions/                 # Custom instructions
├── logs/                         # Log files
├── mcp-config.json               # MCP Server configuration
├── pkg/                          # Package cache
├── session-state/                # Session storage (UUID-named folders)
│   └── <uuid>/
│       ├── checkpoints/
│       │   └── index.md
│       ├── events.jsonl          # Event stream log
│       ├── files/                # File snapshots
│       └── workspace.yaml        # Session workspace metadata
└── skills/                       # User-installed skills
    ├── agent-browser/
    ├── commit-message/
    ├── find-skills/
    ├── frontend-design/
    ├── gemini-reviewer/
    ├── github-pr/
    ├── planning-with-files/
    └── skill-creator/
```

### Settings (`~/.copilot/config.json`)

```json
{
  "banner": "never",
  "last_logged_in_user": {
    "host": "https://github.com",
    "login": "gn00678465"
  },
  "logged_in_users": [
    {
      "host": "https://github.com",
      "login": "gn00678465"
    }
  ],
  "model": "claude-sonnet-4.5",
  "render_markdown": true,
  "screen_reader": false,
  "theme": "auto",
  "asked_setup_terminals": [
    "vscode"
  ]
}
```

**Schema Notes:**
- `banner` - Banner display preference: `"never"` | `"always"` | other
- `last_logged_in_user` - Object with `host` (GitHub URL) and `login` (username)
- `logged_in_users` - Array of user objects
- `model` - Active AI model string (e.g., `"claude-sonnet-4.5"`)
- `render_markdown` - boolean
- `screen_reader` - boolean
- `theme` - `"auto"` | `"light"` | `"dark"`
- `asked_setup_terminals` - Array of terminal names that have been prompted

### MCP Servers (`~/.copilot/mcp-config.json`)

```json
{
  "mcpServers": {
    "MCP_DOCKER": {
      "tools": ["*"],
      "type": "local",
      "command": "docker",
      "args": ["mcp", "gateway", "run"]
    },
    "serena": {
      "tools": ["*"],
      "type": "local",
      "command": "uvx",
      "args": [
        "--from",
        "git+https://github.com/oraios/serena",
        "serena",
        "start-mcp-server",
        "--context",
        "ide-assistant",
        "--project",
        "$(pwd)"
      ]
    }
  }
}
```

**MCP Server Entry Schema:**
```typescript
{
  [serverName: string]: {
    tools: string[];           // "*" = all tools, or specific tool names
    type: "local" | "remote";
    command: string;           // executable command
    args: string[];            // command arguments
    env?: Record<string, string>; // optional env vars
  }
}
```

### Sessions (`~/.copilot/session-state/`)

Sessions are UUID-named folders. Each contains:
```
<uuid>/
├── checkpoints/
│   └── index.md       # Checkpoint index markdown
├── events.jsonl       # JSONL event stream
├── files/             # File snapshots directory
└── workspace.yaml     # Session workspace metadata
```

**`workspace.yaml` Schema:**
```yaml
id: <uuid>
cwd: D:\Projects\<project-name>
summary: "<session summary text>"
summary_count: 0
created_at: 2026-02-01T09:39:44.118Z
updated_at: 2026-02-01T10:55:57.513Z
```

Note: Some session directories are files with `.jsonl` extension directly in `session-state/` (not folders).

### Skills (`~/.copilot/skills/`)

8 installed skills:
- `agent-browser/` - Browser automation
- `commit-message/` - Git commit message generation
- `find-skills/` - Skill discovery
- `frontend-design/` - Frontend design assistance
- `gemini-reviewer/` - Gemini-specific review tool
- `github-pr/` - GitHub PR workflows
- `planning-with-files/` - Manus-style planning
- `skill-creator/` - Skill creation guide

Skill folder structure (same convention as Gemini):
```
skill-name/
├── SKILL.md         # Required: frontmatter + instructions
├── references/      # Reference docs
└── templates/       # Templates (optional)
```

---

## 3. Claude (`~/.claude/`)

### Top-Level Directory Structure

```
~/.claude/
├── agents/               # Agent team definitions
├── backups/              # Settings/config backups
├── cache/                # General cache
├── chrome/               # Chrome extension data
├── debug/                # Debug logs
├── downloads/            # Downloaded files
├── file-history/         # File operation history
├── history.jsonl         # Conversation history (JSONL)
├── ide/                  # IDE integration state
├── output-styles/        # Output formatting preferences
├── paste-cache/          # Clipboard paste cache
├── plans/                # Saved plans
├── plugins/              # Plugin management directory
│   ├── blocklist.json            # Blocked plugins list
│   ├── cache/                    # Plugin installation cache
│   │   └── <marketplace>/
│   │       └── <plugin-name>/
│   │           └── <version>/
│   │               ├── .claude-plugin/
│   │               │   └── plugin.json
│   │               ├── .mcp.json          # MCP server config (if applicable)
│   │               ├── agents/            # Agent markdown files
│   │               │   └── <agent-name>.md
│   │               └── skills/            # Skill definitions
│   │                   └── <skill-name>/
│   │                       └── SKILL.md
│   ├── config.json               # Plugin repo config
│   ├── install-counts-cache.json # Install count tracking
│   ├── installed_plugins.json    # Master plugin registry
│   ├── known_marketplaces.json   # Marketplace registry
│   ├── marketplaces/             # Downloaded marketplace indexes
│   │   ├── claude-plugins-official/
│   │   │   ├── external_plugins/
│   │   │   ├── plugins/         # Available plugins list
│   │   │   └── README.md
│   │   ├── dev-browser-marketplace/
│   │   ├── plannotator/
│   │   ├── superpowers-marketplace/
│   │   └── thedotmack/
│   └── repos/                    # Repository clones
├── projects/             # Project-level data
├── session-env/          # Session environment snapshots
├── settings.json         # Main settings file
├── shell-snapshots/      # Shell state snapshots
├── skills/               # User-installed skills
│   ├── agent-browser/
│   ├── commit-message/
│   ├── find-skills/
│   ├── frontend-design/
│   ├── github-pr/
│   ├── planning-with-files/
│   └── skill-creator/
├── stats-cache.json      # Usage statistics cache
├── statsig/              # Feature flag telemetry
├── tasks/                # Task management
├── teams/                # Team configurations
├── telemetry/            # Usage telemetry
└── todos/                # Todo lists
```

**Note:** `~/.claude/CLAUDE.md` does NOT exist (no global markdown instructions configured).
**Note:** `~/.claude/setting.json` (singular) does NOT exist; the correct filename is `settings.json` (plural).

### Settings (`~/.claude/settings.json`)

```json
{
  "env": {
    "CLAUDE_CODE_EXPERIMENTAL_AGENT_TEAMS": "1"
  },
  "permissions": {
    "allow": []
  },
  "enabledPlugins": {
    "context7@claude-plugins-official": true,
    "typescript-lsp@claude-plugins-official": true,
    "superpowers@superpowers-marketplace": true,
    "dev-browser@dev-browser-marketplace": true,
    "frontend-design@claude-plugins-official": true,
    "ralph-wiggum@claude-plugins-official": true,
    "github@claude-plugins-official": false,
    "code-simplifier@claude-plugins-official": true,
    "plannotator@plannotator": true,
    "ralph-loop@claude-plugins-official": true,
    "pyright-lsp@claude-plugins-official": true
  },
  "skipDangerousModePermissionPrompt": true,
  "model": "opus"
}
```

**Schema Notes:**
- `env` - Environment variables to inject: `Record<string, string>`
- `permissions.allow` - Allowed tool/permission rules: `string[]`
- `enabledPlugins` - Map of `"plugin-name@marketplace"` to `boolean`
- `skipDangerousModePermissionPrompt` - boolean
- `model` - Active model: `"opus"` | `"sonnet"` | etc.

### Plugins (`~/.claude/plugins/`)

#### `installed_plugins.json` Schema (version 2)

```typescript
{
  version: 2,
  plugins: {
    [pluginId: string]: Array<{   // pluginId = "name@marketplace"
      scope: "user" | "project";
      projectPath?: string;        // required when scope = "project"
      installPath: string;         // absolute path to cached plugin
      version: string;             // semver or git commit sha
      installedAt: string;         // ISO 8601 datetime
      lastUpdated: string;         // ISO 8601 datetime
      gitCommitSha?: string;       // optional git SHA
    }>
  }
}
```

Currently installed plugins (11 total):
| Plugin ID | Scope | Version |
|-----------|-------|---------|
| `claude-mem@thedotmack` | project | 7.4.1 |
| `context7@claude-plugins-official` | user | 8deab8460a9d |
| `typescript-lsp@claude-plugins-official` | user | 1.0.0 |
| `superpowers@superpowers-marketplace` | user | 4.0.3 |
| `dev-browser@dev-browser-marketplace` | user | unknown |
| `frontend-design@claude-plugins-official` | user | 8deab8460a9d |
| `ralph-wiggum@claude-plugins-official` | user | bf48ae6c75e7 |
| `code-simplifier@claude-plugins-official` | user | 1.0.0 |
| `github@claude-plugins-official` | user | 8deab8460a9d |
| `plannotator@plannotator` | user | 0.6.7 |
| `ralph-loop@claude-plugins-official` | user | 8deab8460a9d |
| `pyright-lsp@claude-plugins-official` | user | 1.0.0 |

#### `known_marketplaces.json` Schema

```typescript
{
  [marketplaceName: string]: {
    source: {
      source: "github";
      repo: string;       // "owner/repo"
    };
    installLocation: string;  // absolute path
    lastUpdated: string;      // ISO 8601 datetime
  }
}
```

Registered marketplaces:
| Marketplace | GitHub Repo |
|-------------|-------------|
| `claude-plugins-official` | `anthropics/claude-plugins-official` |
| `thedotmack` | `thedotmack/claude-mem` |
| `superpowers-marketplace` | `obra/superpowers-marketplace` |
| `dev-browser-marketplace` | `sawyerhood/dev-browser` |
| `plannotator` | `backnotprop/plannotator` |

#### Plugin Cache Structure (`~/.claude/plugins/cache/`)

```
cache/
└── <marketplace>/
    └── <plugin-name>/
        └── <version-or-sha>/
            ├── .claude-plugin/
            │   └── plugin.json      # Plugin manifest
            ├── .mcp.json            # Optional: MCP server config
            ├── .orphaned_at         # Optional: marks orphaned versions
            ├── agents/
            │   └── <agent-name>.md  # Agent-type plugin content
            └── skills/
                └── <skill-name>/
                    └── SKILL.md     # Skill-type plugin content
```

#### `plugin.json` Schema (inside `.claude-plugin/`)

```json
{
  "name": "code-simplifier",
  "version": "1.0.0",
  "description": "Agent that simplifies and refines code...",
  "author": {
    "name": "Anthropic",
    "email": "support@anthropic.com"
  }
}
```

#### Available Plugins in Official Marketplace

The `claude-plugins-official` marketplace contains these plugins:
`agent-sdk-dev`, `clangd-lsp`, `claude-code-setup`, `claude-md-management`, `code-review`, `code-simplifier`, `commit-commands`, `csharp-lsp`, `example-plugin`, `explanatory-output-style`, `feature-dev`, `frontend-design`, `gopls-lsp`, `hookify`, `jdtls-lsp`, `kotlin-lsp`, `learning-output-style`, `lua-lsp`, `php-lsp`, `playground`, `plugin-dev`, `pr-review-toolkit`, `pyright-lsp`, `ralph-loop`, `rust-analyzer-lsp`, `security-guidance`, `skill-creator`, `swift-lsp`, `typescript-lsp`

### Skills (`~/.claude/skills/`)

7 installed skills:
- `agent-browser/` - Browser automation
- `commit-message/` - Commit message generation
- `find-skills/` - Skill discovery
- `frontend-design/` - Frontend design assistance
- `github-pr/` - GitHub PR workflows
- `planning-with-files/` - Manus-style planning
- `skill-creator/` - Skill creation guide

Same SKILL.md format as Gemini/Copilot.

### Markdown (`~/.claude/CLAUDE.md`)
- Does NOT exist

---

## 4. Shared (`~/.agents/`)

### Directory Structure

```
~/.agents/
└── skills/               # Cross-agent shared skills
    ├── agent-browser/
    ├── commit-message/
    ├── find-skills/
    ├── frontend-design/
    └── github-pr/
```

### Skills (`~/.agents/skills/`)

5 shared skills (subset of those in per-agent directories):
- `agent-browser/` - Browser automation
- `commit-message/` - Commit message generation
- `find-skills/` - Skill discovery
- `frontend-design/` - Frontend design assistance
- `github-pr/` - GitHub PR workflows

Skill structure (same format as per-agent skills):
```
skill-name/
├── SKILL.md      # Required
├── references/   # Reference docs
└── templates/    # Templates
```

---

## 5. Skills System - Cross-Agent Overview

### Skill Loading Hierarchy

Skills are loaded from multiple locations in priority order:
1. `~/.agents/skills/` - Shared across all agents
2. `~/<agent>/skills/` - Agent-specific skills
3. Plugin-provided skills (in `~/.claude/plugins/cache/<marketplace>/<plugin>/skills/`)

### Common Skills Present Across Agents

| Skill | Gemini | Copilot | Claude | Shared |
|-------|--------|---------|--------|--------|
| agent-browser | - | YES | YES | YES |
| commit-message | - | YES | YES | YES |
| find-skills | - | YES | YES | YES |
| frontend-design | - | YES | YES | YES |
| github-pr | - | YES | YES | YES |
| planning-with-files | YES | YES | YES | - |
| skill-creator | YES | YES | - | - |
| gemini-reviewer | - | YES | - | - |

### Universal SKILL.md Format

```markdown
---
name: skill-name           # required
version: "1.0.0"           # optional
description: "..."         # required - triggers when to use this skill
user-invocable: true       # optional - can user invoke with /skill-name
license: "..."             # optional
allowed-tools:             # optional - restrict tool access
  - Read
  - Write
hooks:                     # optional - lifecycle hooks
  PreToolUse: [...]
  PostToolUse: [...]
  Stop: [...]
---

# Skill Body (Markdown instructions)
```

---

## 6. Missing / Non-Existent Paths

| Path | Status | Notes |
|------|--------|-------|
| `~/.claude/CLAUDE.md` | NOT FOUND | No global instructions configured |
| `~/.claude/setting.json` (singular) | NOT FOUND | Correct filename is `settings.json` (plural) |
| `~/.gemini/GEMINI.md` | EXISTS but EMPTY | File is 1 line, no content |
| `~/.copilot/history/` | NOT FOUND | No history directory |
| `~/.agents/CLAUDE.md` | NOT FOUND | Not applicable |

---

## 7. Summary of File Schemas

### Settings Files Comparison

| Feature | Gemini `settings.json` | Copilot `config.json` | Claude `settings.json` |
|---------|----------------------|----------------------|----------------------|
| Auth/Login | `security.auth.selectedType` | `last_logged_in_user`, `logged_in_users` | Via env vars |
| Model | not set | `"model": "claude-sonnet-4.5"` | `"model": "opus"` |
| Theme | not set | `"theme": "auto"` | not set |
| UI settings | `ui.*` object | `render_markdown`, `screen_reader` | not set |
| Features/Flags | `experimental.skills` | not set | `env` object |
| Plugins | not set | not set | `enabledPlugins` map |
| MCP Servers | `mcpServers: {}` | separate `mcp-config.json` | Via plugins |
| Permissions | not set | not set | `permissions.allow` |

### Session Storage Comparison

| Feature | Gemini `tmp/` | Copilot `session-state/` |
|---------|--------------|------------------------|
| Naming | SHA256 hash folders | UUID folders |
| Metadata | `logs.json` | `workspace.yaml` |
| Chat data | `chats/` folder | `events.jsonl` |
| Additional | `tool-outputs/` | `checkpoints/`, `files/` |

### Plugin/Extension Comparison

| Feature | Gemini Extensions | Claude Plugins |
|---------|------------------|----------------|
| Install manifest | `gemini-extension.json` | `.claude-plugin/plugin.json` |
| Enable/disable | `extension-enablement.json` | `settings.json` `enabledPlugins` |
| Registry | none (local folders) | `known_marketplaces.json` |
| Install tracking | none | `installed_plugins.json` |
| MCP config | in `gemini-extension.json` | `.mcp.json` in cache |
| Plugin types | MCP + context | Agent, Skill, MCP |
| Scoping | by path overrides | `user` or `project` scope |

---

## 8. Key Design Implications for UI/UX and Engineering

1. **Settings management** - Each agent has a different JSON structure; the UI must normalize these into a common interface

2. **Plugin/Extension system** - Claude has the most sophisticated plugin system with marketplace support, install tracking, and scope (user vs project); Gemini uses simpler local extension folders

3. **Skills are shared** - The `~/.agents/skills/` directory enables cross-agent skill sharing; 5 of 7 skills appear in all agents

4. **Session data** - Both Gemini and Copilot store session data locally in different formats; Claude stores history in `history.jsonl`

5. **MCP Servers** - Copilot uses a dedicated `mcp-config.json`; Gemini embeds MCP config in extension manifests; Claude provides MCP via plugins with `.mcp.json` files

6. **Auth differs** - Gemini uses Google OAuth; Copilot uses GitHub OAuth; Claude uses API keys/environment variables

7. **CLAUDE.md / GEMINI.md** - These are optional global instruction files; GEMINI.md exists but is empty; CLAUDE.md does not exist

8. **Skill format is universal** - The SKILL.md frontmatter+markdown format is identical across Gemini, Copilot, Claude, and the shared `~/.agents/` location
