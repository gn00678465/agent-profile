/**
 * @vitest-environment jsdom
 */
import { describe, it, expect, vi } from 'vitest';
import { render, screen } from '@testing-library/react';
import { CopilotSettingsView } from '../CopilotSettings';

// Mock JsonFileEditor so tests don't need full electron setup
vi.mock('../../editors/JsonFileEditor', () => ({
  JsonFileEditor: ({ filePath, title, description }: { filePath: string; title: string; description?: string }) => (
    <div data-testid="json-file-editor" data-filepath={filePath} data-title={title} data-description={description} />
  ),
}));

describe('CopilotSettingsView', () => {
  it('renders JsonFileEditor with correct filePath', () => {
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    const editor = screen.getByTestId('json-file-editor');
    expect(editor.getAttribute('data-filepath')).toBe('/home/user/.copilot/config.json');
  });

  it('renders JsonFileEditor with correct title', () => {
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    const editor = screen.getByTestId('json-file-editor');
    expect(editor.getAttribute('data-title')).toBe('GitHub Copilot Settings');
  });

  it('renders JsonFileEditor with description containing configDir', () => {
    render(<CopilotSettingsView configDir="/home/user/.copilot" />);
    const editor = screen.getByTestId('json-file-editor');
    expect(editor.getAttribute('data-description')).toContain('/home/user/.copilot');
  });
});
