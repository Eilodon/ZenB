export type WakeLockManagerDeps = {
  navigator?: Pick<Navigator, 'wakeLock'>;
  document?: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  onError?: (err: unknown) => void;
};

type SessionFlags = { isActive: boolean; isPaused: boolean };

export class WakeLockManager {
  private readonly nav?: WakeLockManagerDeps['navigator'];
  private readonly doc?: WakeLockManagerDeps['document'];
  private readonly onError: (err: unknown) => void;

  private sentinel: WakeLockSentinel | null = null;
  private requestInFlight: Promise<WakeLockSentinel> | null = null;
  private isActive = false;
  private isPaused = false;
  private disposed = false;

  private readonly handleVisibilityChange = () => {
    void this.sync();
  };

  constructor(deps: WakeLockManagerDeps = {}) {
    this.nav = deps.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    this.doc = deps.document ?? (typeof document !== 'undefined' ? document : undefined);
    this.onError = deps.onError ?? (() => { });
  }

  public start() {
    if (this.disposed) return;
    this.doc?.addEventListener?.('visibilitychange', this.handleVisibilityChange);
    void this.sync();
  }

  public setSessionState(flags: SessionFlags) {
    this.isActive = flags.isActive;
    this.isPaused = flags.isPaused;
    void this.sync();
  }

  public refresh() {
    return this.sync();
  }

  public async dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.doc?.removeEventListener?.('visibilitychange', this.handleVisibilityChange);
    await this.release();
  }

  private shouldHoldLock(): boolean {
    if (!this.doc) return false;
    return this.isActive && !this.isPaused && this.doc.visibilityState === 'visible';
  }

  private async sync() {
    if (this.disposed) return;

    if (!this.shouldHoldLock()) {
      await this.release();
      return;
    }

    await this.acquire();
  }

  private async acquire() {
    if (this.sentinel || this.requestInFlight) return;

    const wakeLock = this.nav?.wakeLock;
    if (!wakeLock || typeof wakeLock.request !== 'function') return;

    this.requestInFlight = wakeLock.request('screen');
    try {
      const sentinel = await this.requestInFlight;

      if (this.disposed) {
        try { await sentinel.release(); } catch { }
        return;
      }

      if (!this.shouldHoldLock()) {
        try { await sentinel.release(); } catch { }
        return;
      }

      this.sentinel = sentinel;
      sentinel.addEventListener?.('release', () => {
        this.sentinel = null;
        if (this.shouldHoldLock()) void this.acquire();
      });
    } catch (err) {
      this.onError(err);
    } finally {
      this.requestInFlight = null;
    }
  }

  private async release() {
    const sentinel = this.sentinel;
    this.sentinel = null;
    if (!sentinel) return;
    try { await sentinel.release(); } catch { }
  }
}
