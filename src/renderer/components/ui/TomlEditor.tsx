import CodeMirror from '@uiw/react-codemirror';
import { StreamLanguage } from '@codemirror/language';
import { toml as tomlMode } from '@codemirror/legacy-modes/mode/toml';
import { linter, type Diagnostic } from '@codemirror/lint';
import type { EditorView } from '@codemirror/view';
import { oneDark } from '@codemirror/theme-one-dark';
import { parse as parseToml, TomlError } from 'smol-toml';
import { useTheme } from '@/hooks/useTheme';

const tomlLanguage = StreamLanguage.define(tomlMode);

// Live validation: smol-toml's TomlError carries 1-based line/column, which map
// cleanly onto CodeMirror's 1-based doc.line(). Falls back to char 0 if the
// error lacks a usable position.
function tomlLintSource(view: EditorView): Diagnostic[] {
  const text = view.state.doc.toString();
  if (!text.trim()) return [];
  try {
    parseToml(text);
    return [];
  } catch (err) {
    const doc = view.state.doc;
    let from = 0;
    let to = 1;
    if (err instanceof TomlError && err.line >= 1 && err.line <= doc.lines) {
      const line = doc.line(err.line);
      from = line.from + Math.max(0, Math.min(err.column - 1, line.length));
      to = line.to;
    }
    return [{ from, to, severity: 'error', message: err instanceof Error ? err.message : 'Invalid TOML' }];
  }
}

interface TomlEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  minHeight?: string;
}

export function TomlEditor({ value, onChange, height, minHeight = '400px' }: TomlEditorProps) {
  const { isDark } = useTheme();

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[tomlLanguage, linter(tomlLintSource)]}
      theme={isDark ? oneDark : 'light'}
      height={height}
      minHeight={minHeight}
      className="h-full overflow-hidden text-xs"
      basicSetup={{
        lineNumbers: true,
        foldGutter: true,
        highlightActiveLine: true,
        tabSize: 2,
        indentOnInput: true,
      }}
    />
  );
}
