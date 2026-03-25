import { useState, useEffect, useCallback } from 'react';
import type { Skill, ConfigFile } from '@shared/types';
import { callElectron, electronAPI } from '../lib/electron';

// Hook for skills
export function useSkills(configDir: string | null) {
  const [skills, setSkills] = useState<Skill[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!configDir) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getSkills(configDir)
      );
      setSkills(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load skills');
    } finally {
      setLoading(false);
    }
  }, [configDir]);

  useEffect(() => {
    void load();
  }, [load]);

  const saveSkill = useCallback(
    async (skill: Skill) => {
      if (!configDir) return;
      try {
        await callElectron(() => electronAPI().config.saveSkill(configDir, skill));
        await load();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to save skill');
      }
    },
    [configDir, load]
  );

  const deleteSkill = useCallback(
    async (skillId: string) => {
      if (!configDir) return;
      try {
        await callElectron(() =>
          electronAPI().config.deleteSkill(configDir, skillId)
        );
        await load();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to delete skill');
      }
    },
    [configDir, load]
  );

  const linkSharedSkill = useCallback(
    async (sharedSkillPath: string, skillId: string) => {
      if (!configDir) return;
      try {
        await callElectron(() =>
          electronAPI().config.linkSharedSkill(configDir, sharedSkillPath, skillId)
        );
        await load();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to link shared skill');
      }
    },
    [configDir, load]
  );

  const installSkillFromZip = useCallback(
    async (zipFilePath: string) => {
      if (!configDir) return;
      try {
        await callElectron(() =>
          electronAPI().config.installSkillFromZip(configDir, zipFilePath)
        );
        await load();
      } catch (err) {
        throw new Error(err instanceof Error ? err.message : 'Failed to install skill from ZIP');
      }
    },
    [configDir, load]
  );

  return { skills, loading, error, saveSkill, deleteSkill, linkSharedSkill, installSkillFromZip, refresh: load };
}

// Hook for markdown files
export function useMarkdown(filePath: string | null) {
  const [config, setConfig] = useState<ConfigFile<string> | null>(null);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = useCallback(async () => {
    if (!filePath) return;
    setLoading(true);
    setError(null);
    try {
      const result = await callElectron(() =>
        electronAPI().config.getMarkdown(filePath)
      );
      setConfig(result);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load file');
    } finally {
      setLoading(false);
    }
  }, [filePath]);

  useEffect(() => {
    void load();
  }, [load]);

  const save = useCallback(
    async (content: string) => {
      if (!filePath) return;
      setSaving(true);
      setError(null);
      try {
        await callElectron(() =>
          electronAPI().config.saveMarkdown(filePath, content)
        );
        await load();
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Failed to save file');
        throw err;
      } finally {
        setSaving(false);
      }
    },
    [filePath, load]
  );

  return { config, loading, saving, error, save, refresh: load };
}
