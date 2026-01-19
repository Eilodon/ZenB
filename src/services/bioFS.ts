import { openDB, DBSchema, IDBPDatabase } from 'idb';
import { KernelEvent } from '../types';
import { SecureBioFS } from './SecureBioFS';

interface ZenBFileSystem extends DBSchema {
  'event-log': {
    key: [number, number]; // [timestamp, seq]
    value: KernelEvent & { seq: number };
    indexes: { 'timestamp': number, 'type': string };
  };
  'meta': {
    key: string;
    value: any;
  };
}

type BioFSHealth = { ok: boolean; supported: boolean; lastError?: string };

type BioFSBackend = {
  getMeta<T = any>(k: string): Promise<T | undefined>;
  setMeta(k: string, v: any): Promise<void>;
  writeEvent(event: KernelEvent): Promise<void>;
  getSessionLog(start: number, end: number): Promise<KernelEvent[]>;
  garbageCollect?(retentionMs?: number): Promise<void>;
};

class PlainBioFileSystem implements BioFSBackend {
  private dbPromise: Promise<IDBPDatabase<ZenBFileSystem>>;
  private isSupported: boolean;
  private health: BioFSHealth = { ok: true, supported: true as boolean, lastError: undefined };
  private listeners = new Set<(h: BioFSHealth) => void>();

  constructor() {
    this.isSupported = typeof window !== 'undefined' && 'indexedDB' in window;

    if (this.isSupported) {
      this.dbPromise = openDB<ZenBFileSystem>('zenb-bio-os', 2, {
        upgrade(db: IDBPDatabase<ZenBFileSystem>, oldVersion: number) {
          if (oldVersion < 1) {
            const eventStore = db.createObjectStore('event-log', { keyPath: ['timestamp', 'seq'] });
            eventStore.createIndex('timestamp', 'timestamp');
            eventStore.createIndex('type', 'type');
            db.createObjectStore('meta');
          } else if (!db.objectStoreNames.contains('meta')) {
            db.createObjectStore('meta');
          }
        },
      }).catch((e: unknown) => {
        this.setHealth({ ok: false, lastError: String(e) });
        throw e;
      });
    } else {
      this.health.supported = false;
      this.dbPromise = Promise.resolve(null as any);
    }
  }

  public subscribeHealth(fn: (h: BioFSHealth) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  public getHealth() { return this.health; }

  private setHealth(p: Partial<typeof this.health>) { Object.assign(this.health, p); this.listeners.forEach(l => l(this.health)); }

  public async getMeta<T = any>(k: string): Promise<T | undefined> {
    if (!this.isSupported) return undefined;
    try { const db = await this.dbPromise; return await db.get('meta', k); }
    catch (e: any) { this.setHealth({ ok: false, lastError: String(e) }); return undefined; }
  }

  public async setMeta(k: string, v: any) {
    if (!this.isSupported) return;
    try { const db = await this.dbPromise; await db.put('meta', v, k); }
    catch (e: any) { this.setHealth({ ok: false, lastError: String(e) }); }
  }

  public async writeEvent(event: KernelEvent): Promise<void> {
    if (!this.isSupported) return;
    try {
      const db = await this.dbPromise;
      const seq = (await this.getMeta<number>('eventSeq')) ?? 0;
      await db.put('event-log', { ...event, seq });
      await this.setMeta('eventSeq', seq + 1);
    } catch (err: any) {
      this.setHealth({ ok: false, lastError: String(err) });
    }
  }

  public async getSessionLog(start: number, end: number): Promise<KernelEvent[]> {
    if (!this.isSupported) return [];
    try {
      const db = await this.dbPromise;
      const range = IDBKeyRange.bound([start, 0], [end, Infinity]);
      const results = await db.getAll('event-log', range);
      return results.sort((a: KernelEvent & { seq: number }, b: KernelEvent & { seq: number }) => a.timestamp - b.timestamp || a.seq - b.seq);
    } catch (err: any) {
      this.setHealth({ ok: false, lastError: String(err) });
      return [];
    }
  }

  public async garbageCollect(retentionMs: number = 7 * 24 * 60 * 60 * 1000): Promise<void> {
    if (!this.isSupported) return;
    const cutoff = Date.now() - retentionMs;
    try {
      const db = await this.dbPromise;
      const range = IDBKeyRange.upperBound([cutoff, Infinity]);
      const tx = db.transaction('event-log', 'readwrite');
      const store = tx.objectStore('event-log');

      let cursor = await store.openCursor(range);
      while (cursor) {
        await cursor.delete();
        cursor = await cursor.continue();
      }
      await tx.done;
    } catch (err: any) {
      this.setHealth({ ok: false, lastError: String(err) });
    }
  }
}

class SecureBioFSAdapter implements BioFSBackend {
  private fs: SecureBioFS = new SecureBioFS();
  private activePassphrase: string | null = null;

  async init(passphrase: string): Promise<void> {
    if (this.activePassphrase === passphrase) return;
    this.fs = new SecureBioFS();
    await this.fs.init(passphrase);
    this.activePassphrase = passphrase;
  }

  async getMeta<T = any>(k: string): Promise<T | undefined> {
    return this.fs.getMeta<T>(k);
  }

  async setMeta(k: string, v: any): Promise<void> {
    await this.fs.setMeta(k, v);
  }

  async writeEvent(event: KernelEvent): Promise<void> {
    await this.fs.writeEvent(event);
  }

  async getSessionLog(start: number, end: number): Promise<KernelEvent[]> {
    return this.fs.queryEvents(start, end);
  }

  async garbageCollect(): Promise<void> {
    // SecureBioFS rotates internally during init; no-op here.
  }
}

class BioFSRouter implements BioFSBackend {
  private plain = new PlainBioFileSystem();
  private secure = new SecureBioFSAdapter();
  private backend: BioFSBackend | null = null;
  private listeners = new Set<(h: BioFSHealth) => void>();
  private health: BioFSHealth = {
    ok: true,
    supported: typeof window !== 'undefined' && 'indexedDB' in window,
    lastError: undefined
  };

  constructor() {
    this.plain.subscribeHealth((h) => this.setHealth(h));
  }

  public subscribeHealth(fn: (h: BioFSHealth) => void) { this.listeners.add(fn); return () => this.listeners.delete(fn); }

  public getHealth() { return this.backend === this.plain ? this.plain.getHealth() : this.health; }

  private setHealth(p: Partial<BioFSHealth>) {
    Object.assign(this.health, p);
    this.listeners.forEach(l => l(this.health));
  }

  private async ensureBackend(): Promise<BioFSBackend> {
    if (!this.health.supported) {
      this.backend = this.plain;
      return this.backend;
    }

    const passphrase = typeof sessionStorage !== 'undefined'
      ? sessionStorage.getItem('zenb_passphrase')
      : null;

    if (passphrase) {
      try {
        await this.secure.init(passphrase);
        this.backend = this.secure;
        return this.backend;
      } catch (e: any) {
        this.setHealth({ ok: false, lastError: String(e) });
      }
    }

    this.backend = this.plain;
    return this.backend;
  }

  public async getMeta<T = any>(k: string): Promise<T | undefined> {
    const backend = await this.ensureBackend();
    return backend.getMeta<T>(k);
  }

  public async setMeta(k: string, v: any): Promise<void> {
    const backend = await this.ensureBackend();
    return backend.setMeta(k, v);
  }

  public async writeEvent(event: KernelEvent): Promise<void> {
    const backend = await this.ensureBackend();
    return backend.writeEvent(event);
  }

  public async getSessionLog(start: number, end: number): Promise<KernelEvent[]> {
    const backend = await this.ensureBackend();
    return backend.getSessionLog(start, end);
  }

  public async garbageCollect(retentionMs?: number): Promise<void> {
    const backend = await this.ensureBackend();
    if (backend.garbageCollect) {
      return backend.garbageCollect(retentionMs);
    }
  }
}

export const bioFS = new BioFSRouter();
