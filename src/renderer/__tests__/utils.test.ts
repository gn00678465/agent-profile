import { describe, it, expect } from 'vitest';
import { cn } from '../lib/utils';

describe('cn() utility', () => {
  it('returns a single class name unchanged', () => {
    expect(cn('foo')).toBe('foo');
  });

  it('combines multiple class names', () => {
    expect(cn('foo', 'bar')).toBe('foo bar');
  });

  it('handles conditional class names (truthy/falsy)', () => {
    expect(cn('foo', false && 'bar', 'baz')).toBe('foo baz');
    expect(cn('foo', true && 'bar', 'baz')).toBe('foo bar baz');
  });

  it('merges conflicting Tailwind classes (last wins)', () => {
    // tailwind-merge should resolve conflicts
    const result = cn('p-4', 'p-6');
    expect(result).toBe('p-6');
  });

  it('handles undefined and null inputs gracefully', () => {
    expect(cn('foo', undefined, null as any, 'bar')).toBe('foo bar');
  });

  it('handles array inputs', () => {
    expect(cn(['foo', 'bar'], 'baz')).toBe('foo bar baz');
  });

  it('handles empty input', () => {
    expect(cn()).toBe('');
  });

  it('deduplicates conflicting background colors', () => {
    const result = cn('bg-red-500', 'bg-blue-500');
    expect(result).toBe('bg-blue-500');
  });

  it('preserves non-conflicting classes', () => {
    const result = cn('text-sm', 'font-bold', 'text-red-500');
    expect(result).toContain('text-sm');
    expect(result).toContain('font-bold');
    expect(result).toContain('text-red-500');
  });

  it('handles object syntax for conditional classes', () => {
    const result = cn({ 'active': true, 'disabled': false, 'highlight': true });
    expect(result).toContain('active');
    expect(result).not.toContain('disabled');
    expect(result).toContain('highlight');
  });
});
