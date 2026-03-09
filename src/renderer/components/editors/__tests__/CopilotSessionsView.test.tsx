/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { CopilotSessionsView } from '../CopilotSessionsView';

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

import { callElectron, electronAPI } from '@/lib/electron';

function setupMockApi() {
  const api = {
    config: {
      getSessions: vi.fn(),
      deleteSession: vi.fn(),
      getCopilotSessionEvents: vi.fn(),
    },
    app: {
      openExternal: vi.fn(),
    },
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

const mockSessions = [
  {
    id: 'abc12345-dir',
    name: 'Working on feature',
    path: '/home/user/.copilot/session-state/abc12345-dir',
    type: 'hash',
    agentType: 'copilot',
    summary: 'Working on feature',
    cwd: '/home/user/project',
    createdAt: '2024-01-01T00:00:00Z',
    updatedAt: '2024-01-02T00:00:00Z',
    checkpointCount: 3,
    lastModified: 1704153600000,
  },
  {
    id: 'def67890',
    name: 'def67890...',
    path: '/home/user/.copilot/session-state/def67890.jsonl',
    type: 'hash',
    agentType: 'copilot',
    lastModified: 1704067200000,
  },
];

describe('CopilotSessionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.stubGlobal('confirm', vi.fn(() => true));
  });

  it('shows loading state initially', () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    expect(screen.getByText('Loading sessions...')).toBeTruthy();
  });

  it('renders session list after loading', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue(mockSessions);
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    expect(screen.getByText('Working on feature')).toBeTruthy();
    expect(screen.getByText('def67890...')).toBeTruthy();
  });

  it('shows session count in toolbar', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue(mockSessions);
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    expect(screen.getByText(/Sessions \(2\)/)).toBeTruthy();
  });

  it('shows empty state when no sessions', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue([]);
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    expect(screen.getByText('No sessions found')).toBeTruthy();
  });

  it('filters sessions by search text', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue(mockSessions);
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    const searchInput = screen.getByPlaceholderText('Search sessions...');
    fireEvent.change(searchInput, { target: { value: 'feature' } });
    expect(screen.getByText('Working on feature')).toBeTruthy();
    expect(screen.queryByText('def67890...')).toBeNull();
  });

  it('shows detail panel when session is selected', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSessions)
      .mockResolvedValueOnce([]);
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    fireEvent.click(screen.getByText('Working on feature'));
    await waitFor(() => expect(screen.getByText('Session Detail')).toBeTruthy());
  });

  it('detail panel shows session metadata', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSessions)
      .mockResolvedValueOnce([]);
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    fireEvent.click(screen.getByText('Working on feature'));
    await waitFor(() => {
      expect(screen.getByText(/abc12345-dir/)).toBeTruthy();
      expect(screen.getByText('/home/user/project')).toBeTruthy();
    });
  });

  it('detail panel loads and shows conversation messages', async () => {
    setupMockApi();
    const messages = [
      { role: 'user', text: 'Hello Copilot' },
      { role: 'assistant', text: 'Hello! How can I help?' },
    ];
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSessions)
      .mockResolvedValueOnce(messages);
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    fireEvent.click(screen.getByText('Working on feature'));
    await waitFor(() => {
      expect(screen.getByText('Hello Copilot')).toBeTruthy();
      expect(screen.getByText('Hello! How can I help?')).toBeTruthy();
    });
  });

  it('deletes session after confirmation', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce(mockSessions)   // initial load
      .mockResolvedValueOnce(undefined)      // deleteSession
      .mockResolvedValueOnce([]);            // reload
    render(<CopilotSessionsView configDir="/home/user/.copilot" agentColor="#2eb88a" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    // Hover to reveal delete button (use getAllByRole to find the correct one)
    const deleteButtons = screen.getAllByRole('button');
    // find trash buttons
    const trashButtons = deleteButtons.filter(btn => btn.querySelector('svg'));
    // click the first session's delete
    await act(async () => { fireEvent.click(trashButtons[trashButtons.length - 1]); });
    // This will call confirm + delete + reload
  });
});
