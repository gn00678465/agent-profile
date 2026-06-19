import { useState } from 'react';
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from '@/components/ui/dialog';
import { Button } from '@/components/ui/button';
import { Switch } from '@/components/ui/switch';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import type { ClaudeMarketplaceSource } from '@shared/types';

interface MarketplaceDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSubmit: (name: string, source: ClaudeMarketplaceSource) => void;
  busy?: boolean;
}

type SourceType = 'github' | 'git' | 'url' | 'directory';

const SOURCE_TYPES: SourceType[] = ['github', 'git', 'url', 'directory'];

interface FormState {
  name: string;
  type: SourceType;
  repo: string;
  url: string;
  path: string;
  ref: string;
  autoUpdate: boolean;
}

const INITIAL: FormState = {
  name: '',
  type: 'github',
  repo: '',
  url: '',
  path: '',
  ref: '',
  autoUpdate: false,
};

function isFormValid(s: FormState): boolean {
  if (!s.name.trim()) return false;
  switch (s.type) {
    case 'github':    return /^[\w-]+\/[\w.-]+$/.test(s.repo.trim());
    case 'git':       return s.url.trim().length > 0;
    case 'url':       return s.url.trim().length > 0;
    case 'directory': return s.path.trim().length > 0;
  }
}

function buildSource(s: FormState): ClaudeMarketplaceSource {
  switch (s.type) {
    case 'github': return { source: 'github', repo: s.repo.trim() };
    case 'git':    return { source: 'git', url: s.url.trim(), ref: s.ref.trim() || undefined };
    case 'url':    return { source: 'url', url: s.url.trim() };
    case 'directory': return { source: 'directory', path: s.path.trim() };
  }
}

export function MarketplaceDialog({ open, onOpenChange, onSubmit, busy }: MarketplaceDialogProps) {
  const [form, setForm] = useState<FormState>(INITIAL);

  function update<K extends keyof FormState>(key: K, value: FormState[K]) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!isFormValid(form)) return;
    onSubmit(form.name.trim(), buildSource(form));
  }

  function handleOpenChange(next: boolean) {
    if (!next) setForm(INITIAL);
    onOpenChange(next);
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogContent className="max-w-md">
        <DialogHeader>
          <DialogTitle>Add Marketplace</DialogTitle>
          <DialogDescription>
            Register a new marketplace via Claude CLI.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
          <div className="flex flex-col gap-1.5">
            <Label htmlFor="mp-name">Name</Label>
            <Input
              id="mp-name"
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              placeholder="my-marketplace"
              required
            />
          </div>

          <div className="flex flex-col gap-1.5">
            <Label>Source type</Label>
            <div role="radiogroup" aria-label="Source type" className="flex flex-wrap gap-2">
              {SOURCE_TYPES.map((t) => (
                <button
                  key={t}
                  type="button"
                  role="radio"
                  aria-checked={form.type === t}
                  onClick={() => update('type', t)}
                  className={
                    form.type === t
                      ? 'rounded-md border-whisper bg-accent px-3 py-1 text-xs'
                      : 'rounded-md border-whisper bg-card px-3 py-1 text-xs hover:bg-accent/50'
                  }
                >
                  {t}
                </button>
              ))}
            </div>
          </div>

          {form.type === 'github' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-repo">GitHub repo (owner/name)</Label>
              <Input
                id="mp-repo"
                value={form.repo}
                onChange={(e) => update('repo', e.target.value)}
                placeholder="anthropics/claude-plugins-official"
              />
            </div>
          )}

          {(form.type === 'git' || form.type === 'url') && (
            <>
              <div className="flex flex-col gap-1.5">
                <Label htmlFor="mp-url">URL</Label>
                <Input
                  id="mp-url"
                  value={form.url}
                  onChange={(e) => update('url', e.target.value)}
                  placeholder="https://github.com/owner/repo.git"
                />
              </div>
              {form.type === 'git' && (
                <div className="flex flex-col gap-1.5">
                  <Label htmlFor="mp-ref">Ref (branch / tag)</Label>
                  <Input
                    id="mp-ref"
                    value={form.ref}
                    onChange={(e) => update('ref', e.target.value)}
                    placeholder="main"
                  />
                </div>
              )}
            </>
          )}

          {form.type === 'directory' && (
            <div className="flex flex-col gap-1.5">
              <Label htmlFor="mp-path">Local path</Label>
              <Input
                id="mp-path"
                value={form.path}
                onChange={(e) => update('path', e.target.value)}
                placeholder="D:\\Projects\\my-marketplace"
              />
            </div>
          )}

          <div className="flex items-center justify-between rounded-card border-whisper bg-card px-3 py-2">
            <Label htmlFor="mp-auto" className="text-sm">Auto-update</Label>
            <Switch
              id="mp-auto"
              checked={form.autoUpdate}
              onCheckedChange={(v) => update('autoUpdate', v)}
            />
          </div>

          <DialogFooter>
            <Button type="button" variant="outline" onClick={() => handleOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={!isFormValid(form) || busy}>
              {busy ? 'Adding…' : 'Add'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
