import { create } from 'zustand';
import { BREATHING_PATTERNS, BreathPattern, BreathPhase, BreathingType, ColorTheme, QualityTier, UserSettings } from './types';

type BreathState = {
  isActive: boolean;
  isPaused: boolean;
  currentPattern: BreathPattern;
  phase: BreathPhase;
  cycleCount: number;
  userSettings: UserSettings;

  startSession: (type: BreathingType) => void;
  stopSession: () => void;
  togglePause: () => void;
  setPhase: (phase: BreathPhase) => void;
  incrementCycle: () => void;

  toggleSound: () => void;
  toggleHaptic: () => void;
  setHapticStrength: (s: UserSettings['hapticStrength']) => void;
  setTheme: (t: ColorTheme) => void;
  setQuality: (q: QualityTier) => void;
  setReduceMotion: (v: boolean) => void;
};

export const useBreathStore = create<BreathState>((set) => ({
  isActive: false,
  isPaused: false,
  currentPattern: BREATHING_PATTERNS['4-7-8'],
  phase: 'inhale',
  cycleCount: 0,
  userSettings: {
    soundEnabled: true,
    hapticEnabled: true,
    hapticStrength: 'medium',
    theme: 'neutral',
    quality: 'auto',
    reduceMotion: false,
  },

  startSession: (type) =>
    set({
      isActive: true,
      isPaused: false,
      currentPattern: BREATHING_PATTERNS[type],
      phase: 'inhale',
      cycleCount: 0,
    }),

  stopSession: () => set({ isActive: false, isPaused: false, cycleCount: 0, phase: 'inhale' }),
  
  togglePause: () => set((s) => ({ isPaused: !s.isPaused })),
  
  setPhase: (phase) => set({ phase }),
  
  incrementCycle: () => set((s) => ({ cycleCount: s.cycleCount + 1 })),

  toggleSound: () =>
    set((s) => ({ userSettings: { ...s.userSettings, soundEnabled: !s.userSettings.soundEnabled } })),
  
  toggleHaptic: () =>
    set((s) => ({ userSettings: { ...s.userSettings, hapticEnabled: !s.userSettings.hapticEnabled } })),
  
  setHapticStrength: (hapticStrength) =>
    set((s) => ({ userSettings: { ...s.userSettings, hapticStrength } })),
  
  setTheme: (theme) => set((s) => ({ userSettings: { ...s.userSettings, theme } })),
  
  setQuality: (quality) => set((s) => ({ userSettings: { ...s.userSettings, quality } })),
  
  setReduceMotion: (reduceMotion) =>
    set((s) => ({ userSettings: { ...s.userSettings, reduceMotion } })),
}));