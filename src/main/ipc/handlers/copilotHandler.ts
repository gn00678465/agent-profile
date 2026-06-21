import { IpcMain } from 'electron';
import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import { IPC_CHANNELS } from '../../../shared/types';
import type {
  CopilotConfig,
  SessionEntry,
  ClaudeSessionMessage,
  SubagentFile,
  SubagentOptions,
} from '../../../shared/types';
import { assertSafePath, assertSafeName, success, failure, readJsonFile, writeJsonFile } from './configUtils';

// Subagent files default to Copilot's layout; Codex overrides dir/ext via opts.
function resolveSubagentOpts(opts?: SubagentOptions) {
  return {
    dir: opts?.dir ?? 'subagents',
    ext: opts?.ext ?? '.agent.md',
    template: opts?.template ?? '',
  };
}

// Pull a one-line description for the list view: TOML `description = "..."` or
// Markdown frontmatter `description: ...`. Best-effort — never throws.
function extractSubagentDescription(content: string, ext: string): string | undefined {
  if (!content) return undefined;
  if (ext === '.toml') {
    const m = /^[ \t]*description[ \t]*=[ \t]*"([^"\n]*)"/m.exec(content);
    return m?.[1].trim() || undefined;
  }
  const fm = /^---\n([\s\S]*?)\n---/.exec(content);
  if (fm) {
    const m = /^description:\s*(.+)$/m.exec(fm[1]);
    if (m) return m[1].trim().replace(/^["']|["']$/g, '') || undefined;
  }
  return undefined;
}

export function registerCopilotHandler(ipcMain: IpcMain, _home: string): void {
  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_COPILOT_CONFIG,
    async (_event, configDir: string) => {
      try {
        const configPath = path.join(configDir, 'config.json');
        const result = await readJsonFile<CopilotConfig>(configPath);
        return success(result);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_SAVE_COPILOT_CONFIG,
    async (_event, configDir: string, config: CopilotConfig) => {
      try {
        await writeJsonFile(path.join(configDir, 'config.json'), config);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SESSIONS,
    async (_event, configDir: string, agentType: string) => {
      try {
        const sessions: SessionEntry[] = [];

        if (agentType === 'gemini') {
          // Gemini sessions in ~/.gemini/tmp/ (SHA256 hash folders) + ~/.gemini/history/
          const tmpDir = path.join(configDir, 'tmp');
          const histDir = path.join(configDir, 'history');

          for (const baseDir of [tmpDir, histDir]) {
            let names: string[] = [];
            try { names = await fs.readdir(baseDir); } catch { continue; }
            for (const name of names) {
              const sessionPath = path.join(baseDir, name);
              let stat;
              try { stat = await fs.stat(sessionPath); } catch { continue; }
              if (!stat.isDirectory()) continue;
              const isHash = /^[0-9a-f]{8,}$/i.test(name);
              sessions.push({
                id: name,
                name: isHash ? name.slice(0, 8) + '...' : name,
                path: sessionPath,
                type: isHash ? 'hash' : 'named',
                agentType: 'gemini',
                lastModified: stat.mtimeMs,
              });
            }
          }
        } else if (agentType === 'copilot') {
          // Copilot sessions in ~/.copilot/session-state/ (UUID folders)
          const sessionDir = path.join(configDir, 'session-state');
          let names: string[] = [];
          try { names = await fs.readdir(sessionDir); } catch { /* no sessions */ }

          for (const name of names) {
            const sessionPath = path.join(sessionDir, name);
            let stat;
            try { stat = await fs.stat(sessionPath); } catch { continue; }
            if (!stat.isDirectory()) continue;

            // Try to read workspace.yaml for metadata
            const workspacePath = path.join(sessionPath, 'workspace.yaml');
            let cwd: string | undefined;
            let summary: string | undefined;
            let createdAt: string | undefined;
            let updatedAt: string | undefined;
            let checkpointCount = 0;

            try {
              const yaml = await fs.readFile(workspacePath, 'utf-8');
              const cwdMatch = /^cwd:\s*(.+)$/m.exec(yaml);
              const summaryMatch = /^summary:\s*"(.+)"$/m.exec(yaml);
              const createdMatch = /^created_at:\s*(.+)$/m.exec(yaml);
              const updatedMatch = /^updated_at:\s*(.+)$/m.exec(yaml);
              if (cwdMatch) cwd = cwdMatch[1].trim();
              if (summaryMatch) summary = summaryMatch[1].trim();
              if (createdMatch) createdAt = createdMatch[1].trim();
              if (updatedMatch) updatedAt = updatedMatch[1].trim();

              // Count checkpoints
              const checkpointDir = path.join(sessionPath, 'checkpoints');
              try {
                const checkpoints = await fs.readdir(checkpointDir);
                checkpointCount = checkpoints.length;
              } catch { /* no checkpoints */ }
            } catch { /* no workspace.yaml */ }

            sessions.push({
              id: name,
              name: summary ? summary.slice(0, 40) : name.slice(0, 8) + '...',
              path: sessionPath,
              type: 'hash', // UUIDs treated as hash
              agentType: 'copilot',
              cwd,
              summary,
              createdAt,
              updatedAt,
              checkpointCount,
              lastModified: stat.mtimeMs,
            });
          }

          // Old format: <uuid>.jsonl files directly in session-state/
          for (const name of names) {
            if (!name.endsWith('.jsonl')) continue;
            const sessionPath = path.join(sessionDir, name);
            let fileStat;
            try { fileStat = await fs.stat(sessionPath); } catch { continue; }
            if (!fileStat.isFile()) continue;
            const id = name.slice(0, -'.jsonl'.length);
            sessions.push({
              id,
              name: id.slice(0, 8) + '...',
              path: sessionPath,
              type: 'hash',
              agentType: 'copilot',
              lastModified: fileStat.mtimeMs,
            });
          }
        }

        // Sort by lastModified descending (newest first)
        sessions.sort((a, b) => (b.lastModified ?? 0) - (a.lastModified ?? 0));
        return success(sessions);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_SESSION,
    async (_event, sessionPath: string) => {
      try {
        assertSafePath(sessionPath, os.homedir());
        await fs.rm(sessionPath, { recursive: true, force: true });
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_SUBAGENTS,
    async (_event, configDir: string, opts?: SubagentOptions) => {
      try {
        const { dir, ext } = resolveSubagentOpts(opts);
        const subagentsDir = path.join(configDir, dir);
        let entries: string[];
        try {
          entries = await fs.readdir(subagentsDir);
        } catch {
          return success<SubagentFile[]>([]);
        }

        const subagents: SubagentFile[] = [];
        for (const entry of entries) {
          if (!entry.endsWith(ext)) continue;
          const filePath = path.join(subagentsDir, entry);
          try {
            const stat = await fs.stat(filePath);
            if (!stat.isFile()) continue;
          } catch { continue; }
          const id = entry.slice(0, -ext.length);
          let description: string | undefined;
          try {
            const content = await fs.readFile(filePath, 'utf-8');
            description = extractSubagentDescription(content, ext);
          } catch { /* description stays undefined */ }
          subagents.push({ id, name: id, path: filePath, description });
        }

        return success(subagents);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_CREATE_SUBAGENT,
    async (_event, configDir: string, name: string, opts?: SubagentOptions) => {
      try {
        const { dir, ext, template } = resolveSubagentOpts(opts);
        assertSafeName(name);
        const subagentsDir = path.join(configDir, dir);
        const filePath = path.join(subagentsDir, `${name}${ext}`);
        assertSafePath(filePath, os.homedir());
        await fs.mkdir(subagentsDir, { recursive: true });
        await fs.writeFile(filePath, template, 'utf-8');
        return success(filePath);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_DELETE_SUBAGENT,
    async (_event, configDir: string, name: string, opts?: SubagentOptions) => {
      try {
        const { dir, ext } = resolveSubagentOpts(opts);
        assertSafeName(name);
        const filePath = path.join(configDir, dir, `${name}${ext}`);
        assertSafePath(filePath, os.homedir());
        await fs.unlink(filePath);
        return success(undefined);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_RENAME_SUBAGENT,
    async (_event, configDir: string, oldName: string, newName: string, opts?: SubagentOptions) => {
      try {
        const { dir, ext } = resolveSubagentOpts(opts);
        assertSafeName(oldName);
        assertSafeName(newName);
        const subagentsDir = path.join(configDir, dir);
        const oldPath = path.join(subagentsDir, `${oldName}${ext}`);
        const newPath = path.join(subagentsDir, `${newName}${ext}`);
        assertSafePath(oldPath, os.homedir());
        assertSafePath(newPath, os.homedir());
        await fs.rename(oldPath, newPath);
        return success(newPath);
      } catch (err) {
        return failure(err);
      }
    }
  );

  ipcMain.handle(
    IPC_CHANNELS.CONFIG_GET_COPILOT_SESSION_EVENTS,
    async (_event, sessionPath: string) => {
      try {
        assertSafePath(sessionPath, os.homedir());

        const stat = await fs.stat(sessionPath);
        const eventsPath = stat.isDirectory()
          ? path.join(sessionPath, 'events.jsonl')
          : sessionPath;

        let content: string;
        try {
          content = await fs.readFile(eventsPath, 'utf-8');
        } catch {
          return success<ClaudeSessionMessage[]>([]);
        }

        const messages: ClaudeSessionMessage[] = [];
        for (const line of content.split('\n')) {
          const trimmed = line.trim();
          if (!trimmed) continue;
          try {
            const obj = JSON.parse(trimmed) as Record<string, unknown>;

            // Actual Copilot format: { type: 'user.message'|'assistant.message', data: { content } }
            const type = obj.type as string | undefined;
            if (type === 'user.message' || type === 'assistant.message') {
              const data = obj.data as Record<string, unknown> | undefined;
              const text = (data?.content ?? '') as string;
              if (typeof text !== 'string' || text === '') continue;
              messages.push({ role: type === 'user.message' ? 'user' : 'assistant', text });
              if (messages.length >= 500) break;
              continue;
            }

            // Fallback: legacy format with explicit role field
            const role = obj.role as string | undefined;
            if (role !== 'user' && role !== 'assistant') continue;
            const text = (obj.text ?? obj.content ?? obj.message ?? '') as string;
            if (typeof text !== 'string') continue;
            messages.push({ role, text });
            if (messages.length >= 500) break;
          } catch {
            // skip malformed lines
          }
        }
        return success(messages);
      } catch (err) {
        return failure(err);
      }
    }
  );
}
