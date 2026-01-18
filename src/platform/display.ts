type Orientation = 'portrait' | 'landscape';

export type AspectBucket = 'ultra-tall' | 'tall' | 'classic' | 'square' | 'wide' | 'ultra-wide';
export type SizeBucket = 'xs' | 'sm' | 'md' | 'lg' | 'xl';

export type DisplayProfile = `${Orientation}:${AspectBucket}:${SizeBucket}`;

export type DisplaySnapshot = {
  width: number;
  height: number;
  aspect: number;
  orientation: Orientation;
  aspectBucket: AspectBucket;
  sizeBucket: SizeBucket;
  coarsePointer: boolean;
  reducedMotion: boolean;
  pixelRatio: number;
  profile: DisplayProfile;
  key: string;
};

function clamp(n: number, min: number, max: number): number {
  return Math.max(min, Math.min(max, n));
}

export function classifyAspectBucket(aspect: number): AspectBucket {
  if (aspect < 0.52) return 'ultra-tall';
  if (aspect < 0.62) return 'tall';
  if (aspect < 0.8) return 'classic';
  if (aspect < 1.25) return 'square';
  if (aspect < 1.65) return 'wide';
  return 'ultra-wide';
}

export function classifySizeBucket(width: number, height: number): SizeBucket {
  const minDim = Math.min(width, height);
  if (minDim < 360) return 'xs';
  if (minDim < 430) return 'sm';
  if (minDim < 600) return 'md';
  if (minDim < 900) return 'lg';
  return 'xl';
}

export function createDisplaySnapshot(opts: {
  width: number;
  height: number;
  coarsePointer?: boolean;
  reducedMotion?: boolean;
  pixelRatio?: number;
}): DisplaySnapshot {
  const width = Math.max(1, Math.round(opts.width));
  const height = Math.max(1, Math.round(opts.height));
  const aspect = width / height;
  const orientation: Orientation = width >= height ? 'landscape' : 'portrait';
  const aspectBucket = classifyAspectBucket(aspect);
  const sizeBucket = classifySizeBucket(width, height);
  const coarsePointer = !!opts.coarsePointer;
  const reducedMotion = !!opts.reducedMotion;
  const pixelRatio = typeof opts.pixelRatio === 'number' && Number.isFinite(opts.pixelRatio) ? opts.pixelRatio : 1;
  const profile: DisplayProfile = `${orientation}:${aspectBucket}:${sizeBucket}`;
  const key = `${width}x${height}|${profile}|${coarsePointer ? 1 : 0}|${reducedMotion ? 1 : 0}|${Math.round(pixelRatio * 100)}`;

  return {
    width,
    height,
    aspect,
    orientation,
    aspectBucket,
    sizeBucket,
    coarsePointer,
    reducedMotion,
    pixelRatio,
    profile,
    key
  };
}

function readViewport(): { width: number; height: number } {
  if (typeof window === 'undefined' || typeof document === 'undefined') return { width: 1024, height: 768 };

  const vv = window.visualViewport;
  const vvWidth = vv?.width ?? 0;
  const vvHeight = vv?.height ?? 0;

  if (vvWidth > 0 && vvHeight > 0) return { width: vvWidth, height: vvHeight };

  const w = window.innerWidth || document.documentElement.clientWidth || 1024;
  const h = window.innerHeight || document.documentElement.clientHeight || 768;
  return { width: w, height: h };
}

function readMediaFlags(): { coarsePointer: boolean; reducedMotion: boolean } {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return { coarsePointer: false, reducedMotion: false };
  }

  const coarsePointer = window.matchMedia('(pointer: coarse)').matches;
  const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  return { coarsePointer, reducedMotion };
}

const subscribers = new Set<() => void>();
let cleanupEvents: (() => void) | null = null;
let rafId: number | null = null;

let snapshot: DisplaySnapshot = createDisplaySnapshot({
  width: 1024,
  height: 768,
  coarsePointer: false,
  reducedMotion: false,
  pixelRatio: 1
});

export function getDisplaySnapshot(): DisplaySnapshot {
  if (typeof window === 'undefined') return snapshot;
  return snapshot;
}

function recomputeSnapshot(): DisplaySnapshot {
  const viewport = readViewport();
  const flags = readMediaFlags();
  return createDisplaySnapshot({
    width: viewport.width,
    height: viewport.height,
    coarsePointer: flags.coarsePointer,
    reducedMotion: flags.reducedMotion,
    pixelRatio: typeof window !== 'undefined' ? window.devicePixelRatio : 1
  });
}

function emit(): void {
  subscribers.forEach((cb) => {
    try { cb(); } catch { }
  });
}

function scheduleUpdate(): void {
  if (typeof window === 'undefined') return;
  if (rafId !== null) return;
  rafId = window.requestAnimationFrame(() => {
    rafId = null;
    const next = recomputeSnapshot();
    if (next.key === snapshot.key) return;
    snapshot = next;
    emit();
  });
}

function startListening(): void {
  if (typeof window === 'undefined' || typeof document === 'undefined') return;
  if (cleanupEvents) return;

  const vv = window.visualViewport;
  const mqlCoarse = window.matchMedia ? window.matchMedia('(pointer: coarse)') : null;
  const mqlMotion = window.matchMedia ? window.matchMedia('(prefers-reduced-motion: reduce)') : null;

  const onResize = () => scheduleUpdate();

  window.addEventListener('resize', onResize, { passive: true });
  window.addEventListener('orientationchange', onResize, { passive: true });
  vv?.addEventListener('resize', onResize, { passive: true });
  vv?.addEventListener('scroll', onResize, { passive: true });
  mqlCoarse?.addEventListener?.('change', onResize);
  mqlMotion?.addEventListener?.('change', onResize);

  cleanupEvents = () => {
    window.removeEventListener('resize', onResize);
    window.removeEventListener('orientationchange', onResize);
    vv?.removeEventListener('resize', onResize);
    vv?.removeEventListener('scroll', onResize);
    mqlCoarse?.removeEventListener?.('change', onResize);
    mqlMotion?.removeEventListener?.('change', onResize);
    cleanupEvents = null;
  };
}

function stopListeningIfIdle(): void {
  if (subscribers.size > 0) return;
  cleanupEvents?.();
}

export function subscribeDisplay(cb: () => void): () => void {
  if (typeof window !== 'undefined') {
    if (snapshot.key === '1024x768|landscape:wide:lg|0|0|100') snapshot = recomputeSnapshot();
    startListening();
  }

  subscribers.add(cb);
  return () => {
    subscribers.delete(cb);
    stopListeningIfIdle();
  };
}

export function applyDisplayTokens(next: DisplaySnapshot): void {
  if (typeof document === 'undefined') return;

  const root = document.documentElement;
  root.dataset.displayProfile = next.profile;
  root.dataset.displayOrientation = next.orientation;
  root.dataset.displayAspect = next.aspectBucket;
  root.dataset.displaySize = next.sizeBucket;
  root.dataset.displayPointer = next.coarsePointer ? 'coarse' : 'fine';

  const padXBySize: Record<SizeBucket, number> = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 32,
    xl: 40
  };

  const padYBySize: Record<SizeBucket, number> = {
    xs: 16,
    sm: 20,
    md: 24,
    lg: 28,
    xl: 32
  };

  const baseMaxWidthBySize: Record<SizeBucket, number> = {
    xs: 420,
    sm: 520,
    md: 640,
    lg: 720,
    xl: 960
  };

  let padX = padXBySize[next.sizeBucket];
  let padY = padYBySize[next.sizeBucket];
  let maxWidth = baseMaxWidthBySize[next.sizeBucket];

  if (next.aspectBucket === 'ultra-wide') maxWidth = Math.max(maxWidth, 1080);
  if (next.aspectBucket === 'wide') maxWidth = Math.max(maxWidth, 960);
  if (next.aspectBucket === 'ultra-tall') padY = Math.max(12, padY - 6);

  padX = clamp(padX, 12, 48);
  padY = clamp(padY, 12, 40);
  maxWidth = clamp(maxWidth, 360, 1200);

  root.style.setProperty('--ui-pad-x', `${padX}px`);
  root.style.setProperty('--ui-pad-y', `${padY}px`);
  root.style.setProperty('--ui-max-width', `${maxWidth}px`);
}

export function installDisplaySystem(): () => void {
  const g = globalThis as any;
  if (g.__ZENB_DISPLAY_INSTALLED__) return () => { };
  g.__ZENB_DISPLAY_INSTALLED__ = true;

  const apply = () => applyDisplayTokens(getDisplaySnapshot());
  apply();
  const unsub = subscribeDisplay(apply);
  return () => {
    unsub();
    g.__ZENB_DISPLAY_INSTALLED__ = false;
  };
}
