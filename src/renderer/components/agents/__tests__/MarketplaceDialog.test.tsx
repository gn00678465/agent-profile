/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';

// Radix Dialog uses ResizeObserver; jsdom doesn't ship it.
class ROStub {
  observe(): void { /* noop */ }
  unobserve(): void { /* noop */ }
  disconnect(): void { /* noop */ }
}
(globalThis as any).ResizeObserver = ROStub;

import { MarketplaceDialog } from '../ClaudePlugins/MarketplaceDialog';

describe('MarketplaceDialog', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the form fields when open', async () => {
    render(
      <MarketplaceDialog open={true} onOpenChange={() => {}} onSubmit={() => {}} />
    );
    expect(screen.getByLabelText('Name')).toBeTruthy();
    // GitHub is the default source type → repo input visible
    expect(screen.getByLabelText(/GitHub repo/i)).toBeTruthy();
  });

  it('disables submit until name + valid github repo provided', async () => {
    const user = userEvent.setup();
    const onSubmit = vi.fn();

    render(
      <MarketplaceDialog open={true} onOpenChange={() => {}} onSubmit={onSubmit} />
    );

    const submit = screen.getByRole('button', { name: /^Add$/ });
    expect((submit as HTMLButtonElement).disabled).toBe(true);

    await user.type(screen.getByLabelText('Name'), 'my-mp');
    await user.type(screen.getByLabelText(/GitHub repo/i), 'owner/repo');

    await waitFor(() => {
      expect((submit as HTMLButtonElement).disabled).toBe(false);
    });

    await user.click(submit);
    expect(onSubmit).toHaveBeenCalledWith('my-mp', { source: 'github', repo: 'owner/repo' });
  });

  it('switches dynamic fields when source type changes (github → directory)', async () => {
    const user = userEvent.setup();
    render(
      <MarketplaceDialog open={true} onOpenChange={() => {}} onSubmit={() => {}} />
    );

    expect(screen.getByLabelText(/GitHub repo/i)).toBeTruthy();

    await user.click(screen.getByRole('radio', { name: 'directory' }));

    await waitFor(() => {
      expect(screen.queryByLabelText(/GitHub repo/i)).toBeNull();
      expect(screen.getByLabelText(/Local path/i)).toBeTruthy();
    });
  });
});
