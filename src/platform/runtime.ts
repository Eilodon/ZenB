export function isBrowserLike(): boolean {
  return typeof window !== 'undefined' && typeof document !== 'undefined';
}

export function isCapacitorRuntime(): boolean {
  const w = globalThis as any;
  return !!w?.Capacitor?.isNativePlatform;
}

export function isTauriRuntime(): boolean {
  const w = globalThis as any;
  return !!w?.__TAURI__?.invoke;
}

export function detectRuntime(): 'web' | 'capacitor' | 'tauri' | 'unknown' {
  if (isCapacitorRuntime()) return 'capacitor';
  if (isTauriRuntime()) return 'tauri';
  if (isBrowserLike()) return 'web';
  return 'unknown';
}

