import CodeMirror from '@uiw/react-codemirror';
import { json, jsonParseLinter } from '@codemirror/lang-json';
import { linter } from '@codemirror/lint';
import { oneDark } from '@codemirror/theme-one-dark';
import { useTheme } from '@/hooks/useTheme';

interface JsonEditorProps {
  value: string;
  onChange: (value: string) => void;
  height?: string;
  minHeight?: string;
}

export function JsonEditor({ value, onChange, height, minHeight = '400px' }: JsonEditorProps) {
  const { isDark } = useTheme();

  return (
    <CodeMirror
      value={value}
      onChange={onChange}
      extensions={[json(), linter(jsonParseLinter())]}
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
