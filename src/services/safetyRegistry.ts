import type { BreathingType, SafetyProfile } from '../types';
import { bioFS } from './bioFS';

const SAFETY_REGISTRY_KEY = 'safetyRegistry';

export async function loadSafetyRegistry(): Promise<Record<string, SafetyProfile>> {
  const stored = await bioFS.getMeta<Record<string, SafetyProfile>>(SAFETY_REGISTRY_KEY);
  return stored ?? {};
}

export async function saveSafetyRegistry(registry: Record<string, SafetyProfile>): Promise<void> {
  await bioFS.setMeta(SAFETY_REGISTRY_KEY, registry);
}

export function resetSafetyProfiles(
  registry: Record<string, SafetyProfile>,
  patterns: BreathingType[]
): Record<string, SafetyProfile> {
  const next = { ...registry };
  for (const id of patterns) {
    const existing = next[id];
    if (!existing) continue;
    next[id] = {
      ...existing,
      safety_lock_until: 0,
      cummulative_stress_score: 0
    };
  }
  return next;
}

