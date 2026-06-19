import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { InstalledTab } from './ClaudePlugins/InstalledTab';
import { MarketplacesTab } from './ClaudePlugins/MarketplacesTab';
import { DiscoverTab } from './ClaudePlugins/DiscoverTab';
import { ErrorsTab } from './ClaudePlugins/ErrorsTab';

interface ClaudePluginsProps {
  configDir: string;
  accentColor: string;
}

type TabValue = 'installed' | 'marketplaces' | 'discover' | 'errors';

export function ClaudePluginsView({ configDir, accentColor }: ClaudePluginsProps) {
  const [tab, setTab] = useState<TabValue>('installed');
  const [visited, setVisited] = useState<Set<TabValue>>(() => new Set<TabValue>(['installed']));
  const [errorCount, setErrorCount] = useState(0);

  function handleTabChange(v: string) {
    const next = v as TabValue;
    setTab(next);
    setVisited((prev) => {
      if (prev.has(next)) return prev;
      const out = new Set(prev);
      out.add(next);
      return out;
    });
  }

  return (
    <div className="flex h-full flex-col">
      <Tabs value={tab} onValueChange={handleTabChange} className="flex h-full flex-col">
        <TabsList className="px-4">
          <TabsTrigger value="installed">Installed</TabsTrigger>
          <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
          <TabsTrigger value="discover">Discover</TabsTrigger>
          <TabsTrigger value="errors">
            Errors
            {errorCount > 0 && <span className="badge-notion ml-1.5">{errorCount}</span>}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="installed" className="flex-1 mt-0 overflow-hidden">
          {visited.has('installed') && <InstalledTab configDir={configDir} accentColor={accentColor} />}
        </TabsContent>
        <TabsContent value="marketplaces" className="flex-1 mt-0 overflow-hidden">
          {visited.has('marketplaces') && <MarketplacesTab configDir={configDir} />}
        </TabsContent>
        <TabsContent value="discover" className="flex-1 mt-0 overflow-hidden">
          {visited.has('discover') && <DiscoverTab configDir={configDir} />}
        </TabsContent>
        <TabsContent value="errors" className="flex-1 mt-0 overflow-hidden">
          {visited.has('errors') && <ErrorsTab configDir={configDir} onCountChange={setErrorCount} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
