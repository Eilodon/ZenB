import { useSyncExternalStore } from 'react';
import type { DisplaySnapshot } from '../platform/display';
import { getDisplaySnapshot, subscribeDisplay } from '../platform/display';

export function useDisplay(): DisplaySnapshot {
  return useSyncExternalStore(subscribeDisplay, getDisplaySnapshot, getDisplaySnapshot);
}

export function useDisplayProfile(): DisplaySnapshot['profile'] {
  return useDisplay().profile;
}

export function useIsLandscape(): boolean {
  return useDisplay().orientation === 'landscape';
}

