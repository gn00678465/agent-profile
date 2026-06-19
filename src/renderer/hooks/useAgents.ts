import { useState, useEffect, useCallback } from 'react';
import type { AgentProfile } from '@shared/types';
import { callElectron, electronAPI } from '../lib/electron';

export interface UseAgentsResult {
  agents: AgentProfile[];
  loading: boolean;
  error: string | null;
  refresh: () => void;
}

export function useAgents(): UseAgentsResult {
  const [agents, setAgents] = useState<AgentProfile[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await callElectron(() => electronAPI().config.getAgents());
      setAgents(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load agents');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return { agents, loading, error, refresh: load };
}
