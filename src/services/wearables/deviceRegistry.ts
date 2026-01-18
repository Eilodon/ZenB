import { bioFS } from '../bioFS';
import { getLocalStorageJson, setLocalStorageJson } from './storage';

export type WearableTransportKind = 'web' | 'capacitor' | 'tauri' | 'unknown';

export interface WearableDeviceHistoryRecord {
  id: string;
  provider: string;
  name?: string;
  model?: string;
  transport: WearableTransportKind;
  lastConnectedAt: number;
  lastDisconnectedAt?: number;
  lastBatteryLevel?: number;
  lastSeenAt?: number;
}

const BIOFS_KEY = 'wearable_device_history_v1';
const LS_KEY = 'zenb_wearable_device_history_v1';

let cache: WearableDeviceHistoryRecord[] | null = null;
let loading: Promise<WearableDeviceHistoryRecord[]> | null = null;

function normalizeList(list: WearableDeviceHistoryRecord[]): WearableDeviceHistoryRecord[] {
  const byKey = new Map<string, WearableDeviceHistoryRecord>();
  for (const item of list) {
    if (!item?.id || !item?.provider) continue;
    const key = `${item.provider}:${item.id}`;
    const prev = byKey.get(key);
    if (!prev || (item.lastConnectedAt ?? 0) > (prev.lastConnectedAt ?? 0)) {
      byKey.set(key, item);
    }
  }

  return [...byKey.values()].sort((a, b) => (b.lastConnectedAt ?? 0) - (a.lastConnectedAt ?? 0));
}

async function loadOnce(): Promise<WearableDeviceHistoryRecord[]> {
  if (cache) return cache;
  if (loading) return loading;

  loading = (async () => {
    const fromBio = (await bioFS.getMeta<WearableDeviceHistoryRecord[]>(BIOFS_KEY)) ?? undefined;
    const fromLs = getLocalStorageJson<WearableDeviceHistoryRecord[]>(LS_KEY) ?? undefined;

    const merged = normalizeList([...(fromBio ?? []), ...(fromLs ?? [])]);
    cache = merged;

    // Opportunistic backfill: keep both stores aligned.
    await bioFS.setMeta(BIOFS_KEY, merged);
    setLocalStorageJson(LS_KEY, merged);

    return merged;
  })().finally(() => {
    loading = null;
  });

  return loading;
}

async function save(list: WearableDeviceHistoryRecord[]): Promise<void> {
  cache = normalizeList(list);
  await bioFS.setMeta(BIOFS_KEY, cache);
  setLocalStorageJson(LS_KEY, cache);
}

export async function listWearableDeviceHistory(): Promise<WearableDeviceHistoryRecord[]> {
  return loadOnce();
}

export async function upsertWearableDeviceHistory(
  record: WearableDeviceHistoryRecord
): Promise<WearableDeviceHistoryRecord[]> {
  const current = await loadOnce();
  const key = `${record.provider}:${record.id}`;
  const next = current.filter((x) => `${x.provider}:${x.id}` !== key);
  next.unshift({ ...record });
  await save(next);
  return cache ?? next;
}

export async function markWearableDeviceDisconnected(provider: string, id: string): Promise<WearableDeviceHistoryRecord[]> {
  const current = await loadOnce();
  const now = Date.now();
  const next = current.map((x) => {
    if (x.provider === provider && x.id === id) return { ...x, lastDisconnectedAt: now };
    return x;
  });
  await save(next);
  return cache ?? next;
}

export async function forgetWearableDeviceHistory(provider: string, id: string): Promise<WearableDeviceHistoryRecord[]> {
  const current = await loadOnce();
  const next = current.filter((x) => !(x.provider === provider && x.id === id));
  await save(next);
  return cache ?? next;
}

