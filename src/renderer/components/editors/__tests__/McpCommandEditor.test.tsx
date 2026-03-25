/**
 * @vitest-environment jsdom
 */
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import { McpCommandEditor } from '../McpCommandEditor';

function mockGetMcp(servers: Record<string, unknown> = {}) {
  (window.electronAPI.config.getMcp as ReturnType<typeof vi.fn>).mockResolvedValue({
    success: true,
    data: { path: '/mock/.claude.json', exists: true, data: { mcpServers: servers } },
  });
}

function mockSaveMcp() {
  (window.electronAPI.config.saveMcp as ReturnType<typeof vi.fn>).mockResolvedValue({ success: true });
}

beforeEach(() => {
  vi.clearAllMocks();
  mockGetMcp();
  mockSaveMcp();
});

describe('McpCommandEditor', () => {
  it('shows empty state when no servers', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);
    expect(await screen.findByText(/No MCP servers configured/i)).toBeInTheDocument();
  });

  it('shows existing servers', async () => {
    mockGetMcp({ notion: { type: 'http', url: 'https://mcp.notion.com/mcp' } });
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);
    expect(await screen.findByText('notion')).toBeInTheDocument();
  });

  it('adds a server on valid command submit', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    const input = await screen.findByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, {
      target: { value: 'claude mcp add --transport http notion https://mcp.notion.com/mcp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(window.electronAPI.config.saveMcp).toHaveBeenCalledWith(
        '/mock/.claude',
        'claude-code',
        expect.objectContaining({ mcpServers: expect.objectContaining({ notion: expect.any(Object) }) })
      );
    });
  });

  it('shows inline error on invalid command', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    const input = await screen.findByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, { target: { value: 'claude mcp add --transport http' } });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText(/server name|URL/i)).toBeInTheDocument();
    expect(window.electronAPI.config.saveMcp).not.toHaveBeenCalled();
  });

  it('shows error on duplicate server name', async () => {
    mockGetMcp({ notion: { type: 'http', url: 'https://x.com' } });
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    await screen.findByText('notion');

    const input = screen.getByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, {
      target: { value: 'claude mcp add --transport http notion https://mcp.notion.com/mcp' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    expect(await screen.findByText(/already exists/i)).toBeInTheDocument();
  });

  it('deletes a server and saves with it removed', async () => {
    mockGetMcp({ notion: { type: 'http', url: 'https://mcp.notion.com/mcp' } });
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);

    await screen.findByText('notion');
    const deleteBtn = screen.getByRole('button', { name: /delete notion/i });
    fireEvent.click(deleteBtn);

    await waitFor(() => {
      expect(window.electronAPI.config.saveMcp).toHaveBeenCalledWith(
        '/mock/.claude',
        'claude-code',
        { mcpServers: {} }
      );
    });
  });

  it('preserves disabled field on existing servers when adding new server', async () => {
    const servers = {
      notion: { type: 'http', url: 'https://mcp.notion.com/mcp', disabled: true },
    };
    mockGetMcp(servers);
    render(<McpCommandEditor configDir="/mock/.claude" agentType="claude-code" />);
    await screen.findByText('notion');

    const input = screen.getByPlaceholderText(/claude mcp add/i);
    fireEvent.change(input, {
      target: { value: 'claude mcp add --transport http new https://new.example.com' },
    });
    fireEvent.click(screen.getByRole('button', { name: /add/i }));

    await waitFor(() => {
      expect(window.electronAPI.config.saveMcp).toHaveBeenCalledWith(
        '/mock/.claude',
        'claude-code',
        expect.objectContaining({
          mcpServers: expect.objectContaining({
            notion: expect.objectContaining({ disabled: true }),
          }),
        })
      );
    });
  });

  it('renders with gemini agentType and shows correct placeholder', async () => {
    mockGetMcp({});
    render(<McpCommandEditor configDir="/mock/.gemini" agentType="gemini" />);
    expect(await screen.findByPlaceholderText(/gemini mcp add/i)).toBeInTheDocument();
  });
});
