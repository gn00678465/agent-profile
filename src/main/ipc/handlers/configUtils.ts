import fs from 'fs/promises';
import path from 'path';
import type { IpcResponse, ConfigFile } from '../../../shared/types';

/**
 * Throws if `inputPath` does not resolve to a location within at least one
 * of `allowedRoots`. Prevents path-traversal attacks from renderer-supplied paths.
 */
export function assertSafePath(inputPath: string, ...allowedRoots: string[]): void {
  const resolved = path.resolve(inputPath);
  const safe = allowedRoots.some((root) => {
    const rootResolved = path.resolve(root);
    return resolved === rootResolved || resolved.startsWith(rootResolved + path.sep);
  });
  if (!safe) {
    throw new Error('Access denied: path is outside allowed directories');
  }
}

/**
 * Throws if `name` contains path separators or traversal sequences.
 * Use for renderer-supplied name/id values used as path components.
 */
export function assertSafeName(name: string): void {
  if (!name || /[/\\]/.test(name) || name === '..' || name.includes('..')) {
    throw new Error(`Invalid name: "${name}"`);
  }
}

export function success<T>(data: T): IpcResponse<T> {
  return { success: true, data };
}

export function failure(error: unknown): IpcResponse<never> {
  const message = error instanceof Error ? error.message : String(error);
  return { success: false, error: message };
}

export function formatGeminiSessionName(iso: string): string {
  const d = new Date(iso);
  return d.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' });
}

export async function readJsonFile<T>(filePath: string): Promise<ConfigFile<T>> {
  try {
    const content = await fs.readFile(filePath, 'utf-8');
    const data = JSON.parse(content) as T;
    return { path: filePath, exists: true, data };
  } catch (err) {
    const isNotFound =
      err instanceof Error &&
      'code' in err &&
      (err as NodeJS.ErrnoException).code === 'ENOENT';
    if (isNotFound) {
      return { path: filePath, exists: false, data: null };
    }
    return {
      path: filePath,
      exists: true,
      data: null,
      error: err instanceof Error ? err.message : String(err),
    };
  }
}

export async function writeJsonFile(filePath: string, data: unknown): Promise<void> {
  await fs.mkdir(path.dirname(filePath), { recursive: true });
  await fs.writeFile(filePath, JSON.stringify(data, null, 2), 'utf-8');
}
