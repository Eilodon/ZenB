export type OnlineStatusManagerDeps = {
  window?: Pick<Window, 'addEventListener' | 'removeEventListener'>;
  navigator?: Pick<Navigator, 'onLine'>;
  onChange: (isOnline: boolean) => void;
};

export class OnlineStatusManager {
  private readonly win?: OnlineStatusManagerDeps['window'];
  private readonly nav?: OnlineStatusManagerDeps['navigator'];
  private readonly onChange: OnlineStatusManagerDeps['onChange'];
  private disposed = false;

  private readonly handleOnline = () => this.emit(true);
  private readonly handleOffline = () => this.emit(false);

  constructor(deps: OnlineStatusManagerDeps) {
    this.win = deps.window ?? (typeof window !== 'undefined' ? window : undefined);
    this.nav = deps.navigator ?? (typeof navigator !== 'undefined' ? navigator : undefined);
    this.onChange = deps.onChange;
  }

  public start() {
    if (this.disposed) return;
    this.win?.addEventListener?.('online', this.handleOnline);
    this.win?.addEventListener?.('offline', this.handleOffline);
    this.emit(this.isOnline());
  }

  public isOnline(): boolean {
    return this.nav?.onLine ?? true;
  }

  public dispose() {
    if (this.disposed) return;
    this.disposed = true;
    this.win?.removeEventListener?.('online', this.handleOnline);
    this.win?.removeEventListener?.('offline', this.handleOffline);
  }

  private emit(isOnline: boolean) {
    if (this.disposed) return;
    this.onChange(isOnline);
  }
}

