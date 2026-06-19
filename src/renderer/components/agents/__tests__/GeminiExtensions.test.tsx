/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent, waitFor, act } from '@testing-library/react';
import { GeminiExtensionsView } from '../GeminiExtensions';

vi.mock('@/lib/electron', () => ({
  callElectron: vi.fn(),
  electronAPI: vi.fn(),
  isElectron: vi.fn(() => true),
}));

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

import { callElectron, electronAPI } from '@/lib/electron';

function setupMockApi() {
  const api = {
    config: {
      getGeminiExtensions: vi.fn(),
      deleteGeminiExtension: vi.fn(),
    },
  };
  vi.mocked(electronAPI).mockReturnValue(api as any);
  return api;
}

describe('GeminiExtensionsView', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('shows loading state while fetching extensions', () => {
    setupMockApi();
    vi.mocked(callElectron).mockImplementation(() => new Promise(() => {}));

    render(<GeminiExtensionsView configDir="/home/user/.gemini" accentColor="#3b82f6" />);
    expect(screen.getByText('Loading extensions...')).toBeTruthy();
  });

  it('renders extensions list after loading', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      extensions: [{ name: 'my-ext', enabled: true, description: 'Test extension' }],
      enablement: {},
    });

    render(<GeminiExtensionsView configDir="/home/user/.gemini" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading extensions...')).toBeNull());
    expect(screen.getByText('my-ext')).toBeTruthy();
    expect(screen.getByText('Test extension')).toBeTruthy();
    expect(screen.getByText('enabled')).toBeTruthy();
  });

  it('shows empty state when no extensions', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      extensions: [],
      enablement: {},
    });

    render(<GeminiExtensionsView configDir="/home/user/.gemini" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading extensions...')).toBeNull());
    expect(screen.getByText('No extensions installed.')).toBeTruthy();
  });

  it('renders delete button on list items', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      extensions: [{ name: 'my-ext', enabled: true }],
      enablement: {},
    });

    render(<GeminiExtensionsView configDir="/home/user/.gemini" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading extensions...')).toBeNull());
    const deleteBtn = screen.getByLabelText('Delete extension');
    expect(deleteBtn).toBeTruthy();
  });

  it('calls deleteGeminiExtension and removes from list on confirm', async () => {
    setupMockApi();
    vi.mocked(callElectron)
      .mockResolvedValueOnce({
        extensions: [{ name: 'my-ext', enabled: true }],
        enablement: {},
      })
      .mockResolvedValueOnce(undefined); // deleteGeminiExtension

    vi.spyOn(window, 'confirm').mockReturnValue(true);

    render(<GeminiExtensionsView configDir="/home/user/.gemini" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading extensions...')).toBeNull());

    const deleteBtn = screen.getByLabelText('Delete extension');
    await act(async () => {
      fireEvent.click(deleteBtn);
    });

    await waitFor(() => {
      expect(screen.queryByText('my-ext')).toBeNull();
    });
    expect(callElectron).toHaveBeenCalledTimes(2);
  });

  it('does not delete when confirm is cancelled', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      extensions: [{ name: 'my-ext', enabled: true }],
      enablement: {},
    });
    vi.spyOn(window, 'confirm').mockReturnValue(false);

    render(<GeminiExtensionsView configDir="/home/user/.gemini" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading extensions...')).toBeNull());

    const deleteBtn = screen.getByLabelText('Delete extension');
    fireEvent.click(deleteBtn);

    // Extension should still be in list
    expect(screen.getByText('my-ext')).toBeTruthy();
    expect(callElectron).toHaveBeenCalledTimes(1); // only the initial load
  });

  it('shows disabled status for disabled extensions', async () => {
    setupMockApi();
    vi.mocked(callElectron).mockResolvedValue({
      extensions: [{ name: 'disabled-ext', enabled: false }],
      enablement: {},
    });

    render(<GeminiExtensionsView configDir="/home/user/.gemini" accentColor="#3b82f6" />);

    await waitFor(() => expect(screen.queryByText('Loading extensions...')).toBeNull());
    expect(screen.getByText('disabled')).toBeTruthy();
  });
});
