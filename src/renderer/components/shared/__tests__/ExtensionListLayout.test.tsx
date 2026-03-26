/**
 * @vitest-environment jsdom
 */
import { describe, it, expect } from 'vitest';
import { render, screen } from '@testing-library/react';
import { ExtensionListLayout } from '../ExtensionListLayout';

describe('ExtensionListLayout', () => {
  it('shows loadingText while loading', () => {
    render(
      <ExtensionListLayout loading isEmpty={false} emptyTitle="Empty">
        <div>content</div>
      </ExtensionListLayout>
    );
    expect(screen.getByText('Loading...')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('accepts a custom loadingText', () => {
    render(
      <ExtensionListLayout loading loadingText="Loading extensions..." isEmpty={false} emptyTitle="Empty">
        <div>content</div>
      </ExtensionListLayout>
    );
    expect(screen.getByText('Loading extensions...')).toBeInTheDocument();
  });

  it('does not render toolbar while loading', () => {
    render(
      <ExtensionListLayout loading isEmpty={false} emptyTitle="Empty" toolbar={<div>toolbar</div>}>
        <div>content</div>
      </ExtensionListLayout>
    );
    expect(screen.queryByText('toolbar')).not.toBeInTheDocument();
  });

  it('shows emptyTitle and emptyDescription when isEmpty', () => {
    render(
      <ExtensionListLayout loading={false} isEmpty emptyTitle="Nothing here" emptyDescription="Try installing something">
        <div>content</div>
      </ExtensionListLayout>
    );
    expect(screen.getByText('Nothing here')).toBeInTheDocument();
    expect(screen.getByText('Try installing something')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders children when not empty and not loading', () => {
    render(
      <ExtensionListLayout loading={false} isEmpty={false} emptyTitle="Empty">
        <div>list content</div>
      </ExtensionListLayout>
    );
    expect(screen.getByText('list content')).toBeInTheDocument();
    expect(screen.queryByText('Empty')).not.toBeInTheDocument();
  });

  it('renders toolbar even when isEmpty (filter bar must remain visible)', () => {
    render(
      <ExtensionListLayout
        loading={false}
        isEmpty
        emptyTitle="No results"
        toolbar={<div>filter toolbar</div>}
      >
        <div>content</div>
      </ExtensionListLayout>
    );
    expect(screen.getByText('filter toolbar')).toBeInTheDocument();
    expect(screen.getByText('No results')).toBeInTheDocument();
    expect(screen.queryByText('content')).not.toBeInTheDocument();
  });

  it('renders custom emptyIcon when provided', () => {
    render(
      <ExtensionListLayout
        loading={false}
        isEmpty
        emptyTitle="Empty"
        emptyIcon={<span data-testid="custom-icon" />}
      >
        <div />
      </ExtensionListLayout>
    );
    expect(screen.getByTestId('custom-icon')).toBeInTheDocument();
  });

  it('renders without error when no toolbar or emptyIcon provided', () => {
    render(
      <ExtensionListLayout loading={false} isEmpty={false} emptyTitle="Empty">
        <div>content</div>
      </ExtensionListLayout>
    );
    expect(screen.getByText('content')).toBeInTheDocument();
  });
});
