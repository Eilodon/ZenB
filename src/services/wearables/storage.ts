type Json = any;

const cache = new Map<string, string | null>();

function hasLocalStorage(): boolean {
  try {
    return typeof localStorage !== 'undefined';
  } catch {
    return false;
  }
}

export function getLocalStorageItem(key: string): string | null {
  if (!hasLocalStorage()) return null;
  if (!cache.has(key)) {
    try {
      cache.set(key, localStorage.getItem(key));
    } catch {
      cache.set(key, null);
    }
  }
  return cache.get(key) ?? null;
}

export function setLocalStorageItem(key: string, value: string): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.setItem(key, value);
    cache.set(key, value);
  } catch {
    // ignore
  }
}

export function removeLocalStorageItem(key: string): void {
  if (!hasLocalStorage()) return;
  try {
    localStorage.removeItem(key);
  } catch {
    // ignore
  } finally {
    cache.delete(key);
  }
}

export function getLocalStorageJson<T>(key: string): T | undefined {
  const raw = getLocalStorageItem(key);
  if (!raw) return undefined;
  try {
    return JSON.parse(raw) as T;
  } catch {
    return undefined;
  }
}

export function setLocalStorageJson(key: string, value: Json): void {
  setLocalStorageItem(key, JSON.stringify(value));
}

