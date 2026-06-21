import { useState } from 'react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import { MarketplacesTab } from './CodexPlugins/MarketplacesTab';
import { PluginsTab } from './CodexPlugins/PluginsTab';

interface CodexPluginsProps {
  configDir: string;
  accentColor: string;
}

type TabValue = 'marketplaces' | 'plugins';

export function CodexPluginsView({ configDir, accentColor }: CodexPluginsProps) {
  const [tab, setTab] = useState<TabValue>('marketplaces');
  const [visited, setVisited] = useState<Set<TabValue>>(() => new Set<TabValue>(['marketplaces']));

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
          <TabsTrigger value="marketplaces">Marketplaces</TabsTrigger>
          <TabsTrigger value="plugins">Plugins</TabsTrigger>
        </TabsList>

        <TabsContent value="marketplaces" className="flex-1 mt-0 overflow-hidden">
          {visited.has('marketplaces') && <MarketplacesTab configDir={configDir} accentColor={accentColor} />}
        </TabsContent>
        <TabsContent value="plugins" className="flex-1 mt-0 overflow-hidden">
          {visited.has('plugins') && <PluginsTab accentColor={accentColor} />}
        </TabsContent>
      </Tabs>
    </div>
  );
}
