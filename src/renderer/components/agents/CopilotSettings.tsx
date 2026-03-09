import { JsonFileEditor } from '../editors/JsonFileEditor';

interface CopilotSettingsProps {
  configDir: string;
}

export function CopilotSettingsView({ configDir }: CopilotSettingsProps) {
  return (
    <JsonFileEditor
      filePath={`${configDir}/config.json`}
      title="GitHub Copilot Settings"
      description={`${configDir}/config.json`}
    />
  );
}
