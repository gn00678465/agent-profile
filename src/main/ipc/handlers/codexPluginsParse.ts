// Pure parsers for `codex plugin marketplace list` / `codex plugin list` stdout.
// Lenient: skip unparseable lines, never throw. Fixture-driven (codex v0.136.0).

import type { CodexPlugin } from '../../../shared/types';

export type { CodexPlugin };

/**
 * Parse `codex plugin marketplace list`:
 *
 *   MARKETPLACE     ROOT
 *   ponytail        C:\Users\...\marketplaces\ponytail
 *   openai-curated  C:\Users\...\plugins
 *
 * Two columns split on runs of 2+ spaces; header row skipped.
 */
export function parseCodexMarketplaceList(stdout: string): { name: string; root: string }[] {
  const out: { name: string; root: string }[] = [];
  const lines = stdout.split(/\r?\n/);
  for (const raw of lines) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    // Skip the header row.
    if (/^MARKETPLACE\s{2,}ROOT\s*$/.test(line)) continue;
    const parts = line.split(/\s{2,}/);
    if (parts.length < 2) continue;
    const name = parts[0].trim();
    const root = parts.slice(1).join('  ').trim();
    if (!name || !root) continue;
    out.push({ name, root });
  }
  return out;
}

interface ColumnSpec {
  key: 'plugin' | 'status' | 'version' | 'path';
  start: number;
}

// Map raw STATUS cell text → typed status. Unknown text → null (skip row).
// Codex's STATUS column carries the install state plus an enable flag, e.g.
// "not installed", "installed", "installed, enabled", "installed, disabled" —
// so match the leading install-state keyword rather than the whole cell.
function normalizeStatus(raw: string): CodexPlugin['status'] | null {
  const s = raw.trim().toLowerCase();
  if (s.startsWith('not installed')) return 'not-installed';
  if (s.startsWith('installed')) return 'installed';
  return null;
}

// Split a plugin id `name@marketplace` into its two halves. Requires exactly one '@'.
function splitPluginId(id: string): { name: string; marketplace: string } | null {
  const parts = id.split('@');
  if (parts.length !== 2) return null;
  const [name, marketplace] = parts;
  if (!name || !marketplace) return null;
  return { name, marketplace };
}

// Build column-start offsets from the header line, then slice each data row by those
// offsets. Column-position parsing is robust to PATH values that contain spaces/commas
// (e.g. `https://...ponytail.git, ref ` + "`main`"), which a naive whitespace split breaks.
function parseTable(header: string, rows: string[]): CodexPlugin[] {
  const cols: ColumnSpec[] = [];
  const find = (label: string): number => header.indexOf(label);
  const pluginAt = find('PLUGIN');
  const statusAt = find('STATUS');
  const versionAt = find('VERSION');
  const pathAt = find('PATH');
  if (pluginAt < 0 || statusAt < 0 || versionAt < 0 || pathAt < 0) return [];
  cols.push({ key: 'plugin', start: pluginAt });
  cols.push({ key: 'status', start: statusAt });
  cols.push({ key: 'version', start: versionAt });
  cols.push({ key: 'path', start: pathAt });

  const out: CodexPlugin[] = [];
  for (const raw of rows) {
    const line = raw.replace(/\s+$/, '');
    if (!line.trim()) continue;
    const cells: Record<ColumnSpec['key'], string> = {
      plugin: '',
      status: '',
      version: '',
      path: '',
    };
    for (let i = 0; i < cols.length; i++) {
      const start = cols[i].start;
      const end = i + 1 < cols.length ? cols[i + 1].start : line.length;
      cells[cols[i].key] = line.slice(start, end).trim();
    }

    const idParts = splitPluginId(cells.plugin);
    if (!idParts) continue;
    const status = normalizeStatus(cells.status);
    if (!status) continue;

    const plugin: CodexPlugin = {
      id: cells.plugin,
      name: idParts.name,
      marketplace: idParts.marketplace,
      status,
    };
    if (cells.version) plugin.version = cells.version;
    if (cells.path) plugin.path = cells.path;
    out.push(plugin);
  }
  return out;
}

/**
 * Parse `codex plugin list` — a sequence of marketplace blocks:
 *
 *   Marketplace `ponytail`
 *   C:\Users\...\marketplace.json
 *
 *   PLUGIN             STATUS         VERSION  PATH
 *   ponytail@ponytail  not installed           https://github.com/.../ponytail.git, ref `main`
 *
 * Each block has a `Marketplace \`<name>\`` header, a manifest path line, then a table
 * (`PLUGIN STATUS VERSION PATH`). PATH may contain spaces — parsed by header column offsets.
 */
export function parseCodexPluginList(stdout: string): CodexPlugin[] {
  const out: CodexPlugin[] = [];
  const lines = stdout.split(/\r?\n/);

  let i = 0;
  while (i < lines.length) {
    const line = lines[i];
    // Find a table header line; everything between it and the next blank/Marketplace header
    // (or EOF) is a data row.
    if (/^\s*PLUGIN\s+STATUS\s+VERSION\s+PATH\s*$/.test(line)) {
      const header = line;
      const rows: string[] = [];
      i++;
      while (i < lines.length) {
        const r = lines[i];
        if (!r.trim()) break; // blank line ends the table
        if (/^Marketplace\s+`/.test(r)) break; // next block header
        rows.push(r);
        i++;
      }
      out.push(...parseTable(header, rows));
      continue;
    }
    i++;
  }
  return out;
}
