// @vitest-environment jsdom

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GeminiSessionsView } from '../GeminiSessionsView';

// Mock electron
vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn((fn) => fn()),
  electronAPI: vi.fn(() => ({
    config: {
      getGeminiSessions: vi.fn(),
      getGeminiSessionMessages: vi.fn(),
      deleteSession: vi.fn(),
    },
    app: {
      openExternal: vi.fn(),
    },
  })),
}));

import { callElectron, electronAPI } from '@/lib/electron';

// Mock sonner
vi.mock('sonner', () => ({
  toast: { success: vi.fn(), error: vi.fn() },
}));

// Mock window.confirm
global.confirm = vi.fn(() => true);

const mockSession = {
  id: 'sess1',
  sessionId: 'sess1',
  name: 'Jan 6, 2:11 PM',
  path: '/fake/path.json',
  type: 'hash' as const,
  agentType: 'gemini' as const,
  projectHash: 'abc123def456',
  startTime: '2026-01-06T14:11:00.829Z',
  lastUpdated: '2026-01-06T14:11:21.791Z',
  messageCount: 2,
  lastModified: Date.now(),
};

function setupMockApi(options?: {
  sessions?: typeof mockSession[];
  messages?: {
    id: string;
    type: 'user' | 'gemini' | 'info';
    content: string;
    timestamp: string;
    thoughts?: Array<{ subject: string; description: string }>;
    tokens?: { input: number; output: number; total: number };
  }[];
  neverLoad?: boolean;
}) {
  const sessions = options?.sessions ?? [mockSession];
  const messages = options?.messages ?? [];

  const api = {
    config: {
      getGeminiSessions: options?.neverLoad
        ? vi.fn().mockImplementation(() => new Promise(() => {}))
        : vi.fn().mockResolvedValue(sessions),
      getGeminiSessionMessages: vi.fn().mockResolvedValue(messages),
      deleteSession: vi.fn().mockResolvedValue(undefined),
    },
    app: { openExternal: vi.fn() },
  };

  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('GeminiSessionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    vi.mocked(callElectron).mockImplementation((fn) => fn());
    vi.mocked(electronAPI).mockReturnValue({
      config: {
        getGeminiSessions: vi.fn().mockResolvedValue([mockSession]),
        getGeminiSessionMessages: vi.fn().mockResolvedValue([]),
        deleteSession: vi.fn().mockResolvedValue(undefined),
      },
      app: { openExternal: vi.fn() },
    } as any);
  });

  it('shows loading state initially', () => {
    setupMockApi({ neverLoad: true });
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    expect(screen.getByText('Loading sessions...')).toBeTruthy();
  });

  it('renders session list after load', async () => {
    setupMockApi();
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    expect(screen.getByText('Jan 6, 2:11 PM')).toBeTruthy();
  });

  it('shows session count in toolbar', async () => {
    setupMockApi();
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());
    expect(screen.getByText(/Sessions \(1\)/)).toBeTruthy();
  });

  it('filters sessions by search text', async () => {
    const session2 = {
      ...mockSession,
      id: 'sess2',
      sessionId: 'sess2',
      name: 'Feb 5, 3:00 PM',
      projectHash: 'xyz987abc',
    };
    setupMockApi({ sessions: [mockSession, session2] });
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    const searchInput = screen.getByPlaceholderText('Search sessions...');
    fireEvent.change(searchInput, { target: { value: 'Jan 6' } });

    expect(screen.getByText('Jan 6, 2:11 PM')).toBeTruthy();
    expect(screen.queryByText('Feb 5, 3:00 PM')).toBeNull();
  });

  it('clicking session shows detail panel', async () => {
    setupMockApi();
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    fireEvent.click(screen.getByText('Jan 6, 2:11 PM'));
    await waitFor(() => expect(screen.getByText('Session Detail')).toBeTruthy());
  });

  it('detail panel shows session metadata', async () => {
    setupMockApi();
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    fireEvent.click(screen.getByText('Jan 6, 2:11 PM'));
    await waitFor(() => {
      // Session ID in detail panel
      expect(screen.getByText('sess1')).toBeTruthy();
      // Project hash appears (in list subtext and/or detail panel)
      expect(screen.getAllByText(/abc123de/).length).toBeGreaterThan(0);
    });
  });

  it('detail panel loads and shows messages', async () => {
    const messages = [
      { id: 'msg1', type: 'user' as const, content: 'Hello Gemini', timestamp: '2026-01-06T14:11:00Z' },
      { id: 'msg2', type: 'gemini' as const, content: 'Hello! How can I help?', timestamp: '2026-01-06T14:11:01Z' },
    ];
    setupMockApi({ messages });
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    fireEvent.click(screen.getByText('Jan 6, 2:11 PM'));
    await waitFor(() => {
      expect(screen.getByText('Hello Gemini')).toBeTruthy();
      expect(screen.getByText('Hello! How can I help?')).toBeTruthy();
    });
  });

  it('shows info messages centered/italic', async () => {
    const messages = [
      { id: 'msg1', type: 'info' as const, content: 'Session started', timestamp: '2026-01-06T14:11:00Z' },
    ];
    setupMockApi({ messages });
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    fireEvent.click(screen.getByText('Jan 6, 2:11 PM'));
    await waitFor(() => {
      const infoEl = screen.getByText('Session started');
      expect(infoEl.className).toContain('italic');
    });
  });

  it('shows Gemini message with thoughts toggle', async () => {
    const messages = [
      {
        id: 'msg1',
        type: 'gemini' as const,
        content: 'Here is my answer',
        timestamp: '2026-01-06T14:11:01Z',
        thoughts: [
          { subject: 'Thinking', description: 'Let me consider this carefully.' },
        ],
      },
    ];
    setupMockApi({ messages });
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    fireEvent.click(screen.getByText('Jan 6, 2:11 PM'));
    await waitFor(() => expect(screen.getByText('Here is my answer')).toBeTruthy());

    // Thoughts toggle should be visible but collapsed
    const thoughtsBtn = screen.getByText(/🧠 1 thought/);
    expect(thoughtsBtn).toBeTruthy();
    expect(screen.queryByText('Thinking')).toBeNull();

    // Expand thoughts
    fireEvent.click(thoughtsBtn);
    await waitFor(() => {
      expect(screen.getByText('Thinking')).toBeTruthy();
      expect(screen.getByText('Let me consider this carefully.')).toBeTruthy();
    });
  });

  it('delete button triggers confirm and delete flow', async () => {
    setupMockApi();
    render(<GeminiSessionsView configDir="/home/user/.gemini" agentColor="#4285f4" />);
    await waitFor(() => expect(screen.queryByText('Loading sessions...')).toBeNull());

    const deleteButtons = screen.getAllByRole('button');
    const trashButtons = deleteButtons.filter((btn) => btn.querySelector('svg'));
    await act(async () => {
      fireEvent.click(trashButtons[trashButtons.length - 1]);
    });

    expect(global.confirm).toHaveBeenCalled();
  });
});
