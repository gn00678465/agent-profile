/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, fireEvent } from '@testing-library/react';
import { ExtensionRow } from '../ExtensionRow';

describe('ExtensionRow', () => {
  const baseProps = {
    name: 'my-plugin',
    enabled: true,
    accentColor: '#00ff00',
    onDelete: vi.fn(),
  };

  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('renders the name', () => {
    render(<ExtensionRow {...baseProps} />);
    expect(screen.getByText('my-plugin')).toBeInTheDocument();
  });

  it('renders subtitle when provided', () => {
    render(<ExtensionRow {...baseProps} subtitle="v1.0.0 · npm" />);
    expect(screen.getByText('v1.0.0 · npm')).toBeInTheDocument();
  });

  it('does not render subtitle element when not provided', () => {
    render(<ExtensionRow {...baseProps} />);
    expect(screen.queryByText('v1.0.0 · npm')).not.toBeInTheDocument();
  });

  it('renders badge when provided', () => {
    render(<ExtensionRow {...baseProps} badge={<span>user</span>} />);
    expect(screen.getByText('user')).toBeInTheDocument();
  });

  it('has no button role when onClick is not provided', () => {
    render(<ExtensionRow {...baseProps} />);
    expect(screen.queryByRole('button', { name: /my-plugin/i })).toBeNull();
  });

  it('has button role when onClick is provided', () => {
    const { container } = render(<ExtensionRow {...baseProps} onClick={vi.fn()} />);
    const outerRow = container.firstChild as HTMLElement;
    expect(outerRow).toHaveAttribute('role', 'button');
    expect(outerRow).toHaveAttribute('tabindex', '0');
  });

  it('calls onClick when row is clicked', () => {
    const onClick = vi.fn();
    render(<ExtensionRow {...baseProps} onClick={onClick} />);
    // Click the row div (find by its text content area)
    fireEvent.click(screen.getByText('my-plugin'));
    expect(onClick).toHaveBeenCalledTimes(1);
  });

  it('applies selected styles when selected=true', () => {
    const { container } = render(<ExtensionRow {...baseProps} onClick={vi.fn()} selected />);
    const row = container.firstChild as HTMLElement;
    expect(row.className).toContain('bg-accent/60');
  });

  it('shows Switch when onToggle is provided', () => {
    render(<ExtensionRow {...baseProps} onToggle={vi.fn()} />);
    expect(screen.getByRole('switch')).toBeInTheDocument();
  });

  it('does not show Switch when onToggle is not provided', () => {
    render(<ExtensionRow {...baseProps} />);
    expect(screen.queryByRole('switch')).toBeNull();
  });

  it('calls onDelete when delete button is clicked', () => {
    const onDelete = vi.fn();
    render(<ExtensionRow {...baseProps} onDelete={onDelete} />);
    fireEvent.click(screen.getByRole('button', { name: /delete/i }));
    expect(onDelete).toHaveBeenCalledTimes(1);
  });
});
