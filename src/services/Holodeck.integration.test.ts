import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { Holodeck } from './Holodeck';
import { PureZenBKernel } from './RustKernelBridge';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { BREATHING_PATTERNS } from '../types';

const DEFAULT_SETTINGS = {
  soundEnabled: true,
  hapticEnabled: true,
  hapticStrength: 'medium' as const,
  theme: 'neutral' as const,
  quality: 'auto' as const,
  reduceMotion: false,
  showTimer: true,
  language: 'en' as const,
  soundPack: 'synth' as const,
  streak: 0,
  lastSession: null,
  totalMinutes: 0,
  dailyGoal: 15,
  completedSessions: 0,
  lastBreathDate: '',
  lastUsedPattern: '4-7-8' as const,
  safetyRegistry: {},
  cameraVitalsEnabled: false,
  showKernelMonitor: false,
  aiCoachEnabled: false,
  coachingEnabled: false,
};

function resetStores() {
  if (typeof localStorage !== 'undefined') localStorage.clear();

  useSessionStore.setState({
    isActive: false,
    isPaused: false,
    cameraError: null,
    currentPattern: BREATHING_PATTERNS['4-7-8'],
    phase: 'inhale',
    cycleCount: 0,
    sessionStartTime: 0,
    lastSessionStats: null,
  });

  useUIStore.setState({
    isSettingsOpen: false,
    isHistoryOpen: false,
    showSummary: false,
    snackbar: null,
    pendingConfirmation: null,
  });

  useSettingsStore.setState({
    userSettings: { ...DEFAULT_SETTINGS },
    history: [],
    hasSeenOnboarding: false,
  });
}

describe('Holodeck (end-to-end scenarios)', () => {
  beforeEach(() => {
    resetStores();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-01-01T00:00:00.000Z'));

    const base = Date.now();
    vi.spyOn(performance, 'now').mockImplementation(() => Date.now() - base);

    // Minimal DOM/event surface for confirmation flow in node environment.
    const listeners = new Map<string, Set<(e: any) => void>>();
    vi.stubGlobal('window', {
      addEventListener: (type: string, cb: (e: any) => void) => {
        const set = listeners.get(type) ?? new Set();
        set.add(cb);
        listeners.set(type, set);
      },
      removeEventListener: (type: string, cb: (e: any) => void) => {
        listeners.get(type)?.delete(cb);
      },
      dispatchEvent: (evt: any) => {
        listeners.get(evt?.type)?.forEach(cb => cb(evt));
        return true;
      },
    } as any);
  });

  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
    vi.useRealTimers();
  });

  it('runs extended scenarios headlessly', async () => {
    const holodeck = Holodeck.getInstance();

    const sleep = async (ms: number) => {
      vi.advanceTimersByTime(ms);
    };

    const scenarios = [
      'nominal',
      'panic',
      'ai_tune',
      'pause_resume_long',
      'safety_lock_ux',
      'ai_confirm_timeout',
      'wake_lock_visibility',
      'pwa_offline',
    ] as const;

    for (const id of scenarios) {
      resetStores();

      const kernel = new PureZenBKernel();
      holodeck.attach(kernel, { mode: 'headless', sleep, controlHz: 2 });

      await holodeck.runScenario(id);

      const fails = holodeck.getLogs().filter(l => l.type === 'fail');
      if (fails.length) {
        throw new Error(`[Holodeck:${id}] ${fails.map(f => f.msg).join(' | ')}`);
      }
    }

    expect(true).toBe(true);
  }, 20000);
});
