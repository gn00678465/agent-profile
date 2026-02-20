/**
 * @vitest-environment node
 */
import { describe, it, expect } from 'vitest';
import { IPC_CHANNELS } from '../../shared/types';

describe('IPC_CHANNELS', () => {
  it('should have unique channel values', () => {
    const values = Object.values(IPC_CHANNELS);
    const uniqueValues = new Set(values);
    expect(uniqueValues.size).toBe(values.length);
  });

  it('should have all required channels', () => {
    expect(IPC_CHANNELS.FILE_READ).toBe('file:read');
    expect(IPC_CHANNELS.FILE_WRITE).toBe('file:write');
    expect(IPC_CHANNELS.CONFIG_GET_AGENTS).toBe('config:get-agents');
    expect(IPC_CHANNELS.CONFIG_GET_CLAUDE_SETTINGS).toBe('config:get-claude-settings');
    expect(IPC_CHANNELS.CONFIG_GET_GEMINI_SETTINGS).toBe('config:get-gemini-settings');
    expect(IPC_CHANNELS.CONFIG_GET_COPILOT_CONFIG).toBe('config:get-copilot-config');
    expect(IPC_CHANNELS.CONFIG_GET_MCP).toBe('config:get-mcp');
    expect(IPC_CHANNELS.CONFIG_GET_SKILLS).toBe('config:get-skills');
  });

  it('should include all four agent types', () => {
    expect(IPC_CHANNELS.CONFIG_GET_CLAUDE_SETTINGS).toBeTruthy();
    expect(IPC_CHANNELS.CONFIG_GET_GEMINI_SETTINGS).toBeTruthy();
    expect(IPC_CHANNELS.CONFIG_GET_COPILOT_CONFIG).toBeTruthy();
    // Shared uses skills channel
    expect(IPC_CHANNELS.CONFIG_GET_SKILLS).toBeTruthy();
  });
});
