import { describe, it, expect } from 'vitest';
import { parseMcpCommand } from '../parseMcpCommand';

describe('parseMcpCommand — claude-code', () => {
  it('parses http transport', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport http notion https://mcp.notion.com/mcp',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('notion');
    expect(r.server).toEqual({ type: 'http', url: 'https://mcp.notion.com/mcp' });
  });

  it('parses stdio transport with -- separator', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport stdio airtable -- npx -y airtable-mcp-server',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('airtable');
    expect(r.server.command).toBe('npx');
    expect(r.server.args).toEqual(['-y', 'airtable-mcp-server']);
    expect(r.server.type).toBe('stdio');
  });

  it('parses --env flags', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport stdio --env API_KEY=abc myserver -- python server.py',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.env).toEqual({ API_KEY: 'abc' });
  });

  it('parses multiple --env flags', () => {
    const r = parseMcpCommand(
      'claude mcp add --env A=1 --env B=2 myserver -- cmd',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.env).toEqual({ A: '1', B: '2' });
  });

  it('parses --header flag', () => {
    const r = parseMcpCommand(
      'claude mcp add --transport http --header "Authorization: Bearer tok" myserver https://x.com',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.headers).toEqual({ Authorization: 'Bearer tok' });
  });

  it('consumes --scope and its value without treating value as server name', () => {
    const r = parseMcpCommand(
      'claude mcp add --scope user --transport http myserver https://example.com',
      'claude-code'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('myserver');
  });

  it('returns error for wrong prefix', () => {
    const r = parseMcpCommand('gemini mcp add foo https://x.com', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/claude mcp add/);
  });

  it('returns error for missing server name', () => {
    const r = parseMcpCommand('claude mcp add --transport http', 'claude-code');
    expect(r.ok).toBe(false);
  });

  it('returns error for http transport without URL', () => {
    const r = parseMcpCommand('claude mcp add --transport http myserver', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/URL/i);
  });

  it('returns error for stdio without command after --', () => {
    const r = parseMcpCommand('claude mcp add --transport stdio myserver', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/command/i);
  });

  it('returns error for malformed --env (no =)', () => {
    const r = parseMcpCommand('claude mcp add --env BADVAL myserver -- cmd', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/KEY=VALUE/i);
  });

  it('returns error for unknown transport', () => {
    const r = parseMcpCommand('claude mcp add --transport foobar myserver -- cmd', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Unknown transport/i);
  });

  it('returns error for malformed --header (no colon)', () => {
    const r = parseMcpCommand('claude mcp add --transport http --header BadValue myserver https://x.com', 'claude-code');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/Name: Value/i);
  });
});

describe('parseMcpCommand — gemini', () => {
  it('parses http transport', () => {
    const r = parseMcpCommand(
      'gemini mcp add --transport http myserver https://example.com/mcp',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.name).toBe('myserver');
    expect(r.server).toEqual({ type: 'http', url: 'https://example.com/mcp' });
  });

  it('parses --trust flag', () => {
    const r = parseMcpCommand(
      'gemini mcp add --trust myserver /path/to/server',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.trust).toBe(true);
    expect(r.server.command).toBe('/path/to/server');
  });

  it('parses -e shorthand for env', () => {
    const r = parseMcpCommand(
      'gemini mcp add -e API_KEY=xyz myserver /path/server',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.env).toEqual({ API_KEY: 'xyz' });
  });

  it('parses --header flag', () => {
    const r = parseMcpCommand(
      'gemini mcp add --transport http -H "X-Key: tok" myserver https://x.com',
      'gemini'
    );
    expect(r.ok).toBe(true);
    if (!r.ok) return;
    expect(r.server.headers).toEqual({ 'X-Key': 'tok' });
  });

  it('returns error for wrong prefix', () => {
    const r = parseMcpCommand('claude mcp add foo https://x.com', 'gemini');
    expect(r.ok).toBe(false);
    if (r.ok) return;
    expect(r.error).toMatch(/gemini mcp add/);
  });
});
