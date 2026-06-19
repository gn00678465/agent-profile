import type { McpServer, AgentType } from '@shared/types';

type ParsedMcpServer =
  | { ok: true;  name: string; server: McpServer; error: null }
  | { ok: false; name?: never; server?: never;    error: string };

export type { ParsedMcpServer };

export function parseMcpCommand(input: string, agentType: AgentType): ParsedMcpServer {
  const expectedPrefix = agentType === 'claude-code' ? 'claude mcp add' : 'gemini mcp add';

  const trimmed = input.trim();
  if (!trimmed.startsWith(expectedPrefix)) {
    return { ok: false, error: `Command must start with "${expectedPrefix}"` };
  }

  const rest = trimmed.slice(expectedPrefix.length).trim();
  const tokens = tokenize(rest);

  let transport: McpServer['type'] = 'stdio';
  const env: Record<string, string> = {};
  const headers: Record<string, string> = {};
  let trust = false;
  const positionals: string[] = [];
  let dashDashArgs: string[] | null = null;

  let i = 0;
  while (i < tokens.length) {
    const tok = tokens[i];

    if (tok === '--') {
      dashDashArgs = tokens.slice(i + 1);
      break;
    }

    if (tok === '--transport' || tok === '-t') {
      const validTransports = ['stdio', 'sse', 'http', 'local', 'remote'] as const;
      const rawTransport = tokens[++i] ?? 'stdio';
      if (!validTransports.includes(rawTransport as McpServer['type'])) {
        return { ok: false, error: `Unknown transport "${rawTransport}". Valid values: ${validTransports.join(', ')}` };
      }
      transport = rawTransport as McpServer['type'];
    } else if (tok === '--env' || tok === '-e') {
      const val = tokens[++i] ?? '';
      const eqIdx = val.indexOf('=');
      if (eqIdx === -1) {
        return { ok: false, error: `--env value must be in KEY=VALUE format, got: "${val}"` };
      }
      env[val.slice(0, eqIdx)] = val.slice(eqIdx + 1);
    } else if (tok === '--header' || tok === '-H') {
      const val = tokens[++i] ?? '';
      const colonIdx = val.indexOf(':');
      if (colonIdx === -1) {
        return { ok: false, error: `--header value must be in "Name: Value" format, got: "${val}"` };
      }
      headers[val.slice(0, colonIdx).trim()] = val.slice(colonIdx + 1).trim();
    } else if (tok === '--scope') {
      i++; // consume value token (user/local/project) — discard both flag and value
    } else if (tok === '--trust') {
      trust = true;
    } else if (!tok.startsWith('-')) {
      positionals.push(tok);
    }

    i++;
  }

  const name = positionals[0];
  if (!name) {
    return { ok: false, error: 'Missing server name' };
  }

  const server: McpServer = { type: transport };

  if (transport === 'http' || transport === 'sse') {
    const url = positionals[1];
    if (!url) {
      return { ok: false, error: `Transport "${transport}" requires a URL as the next argument after the server name` };
    }
    server.url = url;
  } else {
    if (agentType === 'claude-code') {
      if (!dashDashArgs || dashDashArgs.length === 0) {
        return { ok: false, error: 'stdio transport requires a command after "--" (e.g., -- npx -y package)' };
      }
      server.command = dashDashArgs[0];
      if (dashDashArgs.length > 1) server.args = dashDashArgs.slice(1);
    } else {
      const cmd = positionals[1];
      if (!cmd) {
        return { ok: false, error: 'stdio transport requires a command as the second argument (e.g., gemini mcp add name /path/to/server)' };
      }
      server.command = cmd;
      if (positionals.length > 2) server.args = positionals.slice(2);
    }
  }

  if (Object.keys(env).length > 0) server.env = env;
  if (Object.keys(headers).length > 0) server.headers = headers;
  if (trust) server.trust = true;

  return { ok: true, name, server, error: null };
}

function tokenize(input: string): string[] {
  const tokens: string[] = [];
  let current = '';
  let inQuote = false;
  let quoteChar = '';

  for (const ch of input) {
    if (inQuote) {
      if (ch === quoteChar) { inQuote = false; }
      else { current += ch; }
    } else if (ch === '"' || ch === "'") {
      inQuote = true;
      quoteChar = ch;
    } else if (ch === ' ' || ch === '\t') {
      if (current) { tokens.push(current); current = ''; }
    } else {
      current += ch;
    }
  }
  if (current) tokens.push(current);
  return tokens;
}
