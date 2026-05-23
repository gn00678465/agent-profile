import { describe, it, expect } from 'vitest';
import { parseUpdateOutput, stripAnsi } from '../UpdateRegistryDialog';

describe('stripAnsi', () => {
  it('removes color SGR codes', () => {
    expect(stripAnsi('\x1B[38;5;145mhello\x1B[0m')).toBe('hello');
  });
  it('removes multiple codes in one string', () => {
    expect(stripAnsi('\x1B[1m\x1B[31mERROR\x1B[0m: \x1B[33mwarn\x1B[0m')).toBe('ERROR: warn');
  });
  it('leaves non-CSI text untouched', () => {
    expect(stripAnsi('plain text')).toBe('plain text');
    expect(stripAnsi('✓ Updated grill-me')).toBe('✓ Updated grill-me');
  });
});

describe('parseUpdateOutput', () => {
  it('returns up-to-date status when "All global skills are up to date" appears', () => {
    const stdout = [
      'Updating grill-me...',
      '',
      '',
      'Checking global skill 1/1: grill-me',
      '✓ All global skills are up to date',
      '',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('up-to-date');
    expect(r.message).toBe('All skills are up to date');
    expect(r.checked).toEqual([{ id: 'grill-me', result: 'up-to-date' }]);
  });

  it('returns updated status when "✓ Updated <name>" appears', () => {
    const stdout = [
      'Updating kami...',
      'Cloning repository...',
      '✓ Updated kami',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('updated');
    expect(r.checked).toEqual([{ id: 'kami', result: 'updated' }]);
  });

  it('returns updated status when "✓ <name> updated" appears', () => {
    const stdout = [
      'Checking skill 1/1: foo',
      '✓ foo updated',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('updated');
    expect(r.checked.find((c) => c.id === 'foo')?.result).toBe('updated');
  });

  it('captures multiple skills checked in sequence', () => {
    const stdout = [
      'Checking global skill 1/3: a',
      'Checking global skill 2/3: b',
      'Checking global skill 3/3: c',
      '✓ All global skills are up to date',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('up-to-date');
    expect(r.checked.map((c) => c.id)).toEqual(['a', 'b', 'c']);
    expect(r.checked.every((c) => c.result === 'up-to-date')).toBe(true);
  });

  it('returns error when "✗" line appears', () => {
    const stdout = [
      'Updating broken-skill...',
      '✗ Failed to clone repository',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('error');
    expect(r.message).toBe('Failed to clone repository');
  });

  it('returns error when "Failed: <reason>" line appears', () => {
    const stdout = [
      'Updating foo...',
      'Failed: network timeout',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('error');
    expect(r.message).toBe('network timeout');
  });

  it('returns partial when there is both an update and an error', () => {
    const stdout = [
      'Updating a...',
      '✓ Updated a',
      'Updating b...',
      '✗ b failed: bad gateway',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('partial');
  });

  it('stays "unknown" when only pending entries exist (no terminal status, no per-skill confirmation)', () => {
    const stdout = ['Updating x...', 'Cloning…'].join('\n');
    const r = parseUpdateOutput(stdout);
    // Previously this fallback flipped to "updated" which produced the
    // misleading "0 skill(s) updated" banner. Stay 'unknown' until at least
    // one entry has a concrete terminal result.
    expect(r.status).toBe('unknown');
    expect(r.checked).toEqual([{ id: 'x', result: 'pending' }]);
  });

  it('returns unknown when stdout is empty', () => {
    const r = parseUpdateOutput('');
    expect(r.status).toBe('unknown');
    expect(r.checked).toEqual([]);
  });

  it('ignores trailing whitespace and blank lines', () => {
    const stdout = '\n\nUpdating grill-me...\n\n  \n✓ All global skills are up to date\n\n';
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('up-to-date');
    expect(r.checked).toEqual([{ id: 'grill-me', result: 'up-to-date' }]);
  });

  it('captures per-skill failure when "Failed to update <name>: <reason>" appears', () => {
    const stdout = [
      'Updating broken...',
      'Failed to update broken: network timeout',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('error');
    const row = r.checked.find((c) => c.id === 'broken');
    expect(row?.result).toBe('failed');
    expect(row?.reason).toBe('network timeout');
  });

  it('captures per-skill failure when "✗ <name> failed: <reason>" appears', () => {
    const stdout = [
      'Updating bad...',
      '✗ bad failed: 404',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('error');
    const row = r.checked.find((c) => c.id === 'bad');
    expect(row?.result).toBe('failed');
    expect(row?.reason).toBe('404');
  });

  it('partial: one updated + one failed → status partial, per-skill rows differ', () => {
    const stdout = [
      'Updating good...',
      '✓ Updated good',
      'Updating bad...',
      'Failed to update bad: connection refused',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('partial');
    expect(r.checked.find((c) => c.id === 'good')?.result).toBe('updated');
    expect(r.checked.find((c) => c.id === 'bad')?.result).toBe('failed');
    expect(r.checked.find((c) => c.id === 'bad')?.reason).toBe('connection refused');
  });

  it('summary line "✓ Updated N skill(s)" bulk-marks pending entries as updated', () => {
    // Scenario: the per-skill success line uses a variant the parser
    // doesn't currently catch, but the summary line at the end is a
    // reliable safety net.
    const stdout = [
      'Updating foo...',
      'Updating bar...',
      // Per-skill success lines deliberately mangled — neither matches the
      // existing per-skill regex.
      'Completed foo',
      'Completed bar',
      '',
      '✓ Updated 2 skill(s)',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('updated');
    expect(r.checked.find((c) => c.id === 'foo')?.result).toBe('updated');
    expect(r.checked.find((c) => c.id === 'bar')?.result).toBe('updated');
    // No fake "2 skill(s)" entry from the summary line
    expect(r.checked.find((c) => c.id === '2 skill(s)')).toBeUndefined();
  });

  it('parses the user-observed multi-skill update output', () => {
    // Real CLI output observed by user
    const stdout = [
      '',
      'Updating microsoft-foundry...',
      '  ✓ Updated microsoft-foundry',
      'Updating skill-writer...',
      '  ✓ Updated skill-writer',
      '',
      '✓ Updated 2 skill(s)',
      '',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('updated');
    // The summary line "✓ Updated 2 skill(s)" must NOT create a fake "2 skill(s)" entry
    expect(r.checked.find((c) => c.id === '2 skill(s)')).toBeUndefined();
    expect(r.checked.map((c) => c.id).sort()).toEqual(['microsoft-foundry', 'skill-writer']);
    expect(r.checked.every((c) => c.result === 'updated')).toBe(true);
  });

  it('strips ANSI escape codes before parsing (CLI uses chalk colors)', () => {
    const stdout = [
      '\x1B[38;5;145mUpdating grill-me...\x1B[0m',
      '\x1B[32m  ✓ Updated grill-me\x1B[0m',
      '\x1B[32m\x1B[1m✓ Updated 1 skill(s)\x1B[0m',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('updated');
    expect(r.checked).toEqual([{ id: 'grill-me', result: 'updated' }]);
  });

  it('handles ANSI-like spinner residue gracefully (no match → ignored)', () => {
    const stdout = [
      '◒ Cloning repository',
      'Updating x...',
      '✓ All global skills are up to date',
    ].join('\n');
    const r = parseUpdateOutput(stdout);
    expect(r.status).toBe('up-to-date');
    expect(r.checked).toEqual([{ id: 'x', result: 'up-to-date' }]);
  });
});
