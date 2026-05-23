import { describe, it, expect } from 'vitest';
import { parseUpdateOutput } from '../UpdateRegistryDialog';

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

  it('falls back to "updated" when output is non-empty but no terminal status line is seen', () => {
    const stdout = ['Updating x...', 'Cloning…'].join('\n');
    const r = parseUpdateOutput(stdout);
    // Pending skill but no terminal status — UI treats as updated to surface progress.
    expect(r.status).toBe('updated');
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
