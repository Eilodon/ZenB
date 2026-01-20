
import { create } from 'zustand';
import { persist } from 'zustand/middleware';
import { UserSettings, SessionHistoryItem, ColorTheme, QualityTier, Language, SoundPack, BreathingType, BeliefState } from '../types';

// NOTE: We need a way to access Kernel from store actions, but Zustand is outside React context.
// In a pure architecture, the Store would dispatch to Kernel. 
// For this pragmatic implementation, we'll assume the Kernel singleton updates the store via listeners, 
// OR the UI calls store actions which then interact with kernel via the provider hooks in components.
// Safety registry operations are handled by the kernel bridge and storage services.

type SettingsState = {
  userSettings: UserSettings;
  history: SessionHistoryItem[];
  hasSeenOnboarding: boolean;

  // Actions
  toggleSound: () => void;
  toggleHaptic: () => void;
  setHapticStrength: (s: UserSettings['hapticStrength']) => void;
  setTheme: (t: ColorTheme) => void;
  setQuality: (q: QualityTier) => void;
  setReduceMotion: (v: boolean) => void;
  toggleTimer: () => void;
  setLanguage: (l: Language) => void;
  setSoundPack: (p: SoundPack) => void;
  completeOnboarding: () => void;
  clearHistory: () => void;
  resetSafetyLock: (patternId: BreathingType) => void;
  setLastUsedPattern: (p: BreathingType) => void;
  toggleCameraVitals: () => void;
  toggleKernelMonitor: () => void;
  toggleAiCoach: () => void; // v6.0
  toggleCoaching: () => void; // v6.1 In-session coaching
  setPassphrase: (passphrase: string) => Promise<void>; // P1 Security Fix
  clearPassphrase: () => void; // P1 Security Fix

  // Logic
  registerSessionComplete: (durationSec: number, patternId: BreathingType, cycles: number, finalBelief: BeliefState) => void;
};

const getTodayString = () => {
  const d = new Date();
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

const getYesterdayString = () => {
  const d = new Date();
  d.setDate(d.getDate() - 1);
  return d.getFullYear() + '-' + String(d.getMonth() + 1).padStart(2, '0') + '-' + String(d.getDate()).padStart(2, '0');
};

export const useSettingsStore = create<SettingsState>()(
  persist(
    (set, get) => ({
      userSettings: {
        soundEnabled: true,
        hapticEnabled: true,
        hapticStrength: 'medium',
        theme: 'neutral',
        quality: 'auto',
        reduceMotion: false,
        showTimer: true,
        language: 'en',
        soundPack: 'synth', // CHANGED: Default to 'synth' as samples are missing
        streak: 0,
        lastBreathDate: '',
        lastUsedPattern: '4-7-8',
        cameraVitalsEnabled: true, // CHANGED: Enable by default for Android testing
        showKernelMonitor: false,
        aiCoachEnabled: false, // v6.0 Default
        coachingEnabled: true,  // In-session coaching messages enabled by default
        hasPassphrase: false,  // P1 Security Fix: User passphrase for encryption
        passphraseHash: null,   // SHA-256 hash for verification only (not for encryption)
        safetyRegistry: {} // Initialize empty registry
      },
      history: [],
      hasSeenOnboarding: false,

      toggleSound: () => set((s) => ({ userSettings: { ...s.userSettings, soundEnabled: !s.userSettings.soundEnabled } })),
      toggleHaptic: () => set((s) => ({ userSettings: { ...s.userSettings, hapticEnabled: !s.userSettings.hapticEnabled } })),
      setHapticStrength: (strength) => set((state) => ({ userSettings: { ...state.userSettings, hapticStrength: strength } })),
      setTheme: (t) => set((s) => ({ userSettings: { ...s.userSettings, theme: t } })),
      setQuality: (q) => set((s) => ({ userSettings: { ...s.userSettings, quality: q } })),
      setReduceMotion: (v) => set((s) => ({ userSettings: { ...s.userSettings, reduceMotion: v } })),
      toggleTimer: () => set((s) => ({ userSettings: { ...s.userSettings, showTimer: !s.userSettings.showTimer } })),
      setLanguage: (l) => set((s) => ({ userSettings: { ...s.userSettings, language: l } })),
      setSoundPack: (p) => set((s) => ({ userSettings: { ...s.userSettings, soundPack: p } })),
      completeOnboarding: () => set({ hasSeenOnboarding: true }),
      clearHistory: () => set({ history: [] }),
      setLastUsedPattern: (p) => set((s) => ({ userSettings: { ...s.userSettings, lastUsedPattern: p } })),
      toggleCameraVitals: () => set((s) => ({ userSettings: { ...s.userSettings, cameraVitalsEnabled: !s.userSettings.cameraVitalsEnabled } })),
      toggleKernelMonitor: () => set((s) => ({ userSettings: { ...s.userSettings, showKernelMonitor: !s.userSettings.showKernelMonitor } })),
      toggleAiCoach: () => set((s) => ({ userSettings: { ...s.userSettings, aiCoachEnabled: !s.userSettings.aiCoachEnabled } })),
      toggleCoaching: () => set((s) => ({ userSettings: { ...s.userSettings, coachingEnabled: !s.userSettings.coachingEnabled } })),

      // P1 Security Fix: Passphrase Management
      setPassphrase: async (passphrase: string) => {
        // Hash passphrase for verification (NOT for encryption)
        const encoder = new TextEncoder();
        const data = encoder.encode(passphrase);
        const hashBuffer = await crypto.subtle.digest('SHA-256', data);
        const hashArray = Array.from(new Uint8Array(hashBuffer));
        const hashHex = hashArray.map(b => b.toString(16).padStart(2, '0')).join('');

        set((s) => ({
          userSettings: {
            ...s.userSettings,
            hasPassphrase: true,
            passphraseHash: hashHex
          }
        }));

        // Store passphrase in sessionStorage (cleared on tab close)
        // This is used by SecureBioFS.init()
        sessionStorage.setItem('zenb_passphrase', passphrase);
      },

      resetSafetyLock: (patternId: BreathingType) => {
        set((s) => {
          const registry = { ...s.userSettings.safetyRegistry };
          if (registry[patternId]) {
            // Clear lock and history
            registry[patternId] = {
              ...registry[patternId],
              safety_lock_until: 0,
              cummulative_stress_score: 0, // Optional: reset stress too? Usually yes for a "reset"
              last_incident_timestamp: 0
            };
          } else {
            // Initialize if missing (defensive)
            registry[patternId] = {
              patternId,
              cummulative_stress_score: 0,
              last_incident_timestamp: 0,
              safety_lock_until: 0,
              resonance_history: [],
              resonance_score: 0
            };
          }
          return { userSettings: { ...s.userSettings, safetyRegistry: registry } };
        });
      },

      clearPassphrase: () => {
        set((s) => ({
          userSettings: {
            ...s.userSettings,
            hasPassphrase: false,
            passphraseHash: null
          }
        }));
        sessionStorage.removeItem('zenb_passphrase');
      },

      registerSessionComplete: (durationSec, patternId, cycles, finalBelief) => {
        const state = get();

        // --- HISTORY & STREAK ---
        let newHistory = state.history;
        if (durationSec > 10) {
          const newItem: SessionHistoryItem = {
            id: Date.now().toString() + Math.random().toString().slice(2, 6),
            timestamp: Date.now(),
            durationSec,
            patternId,
            cycles,
            finalBelief: finalBelief
          };
          newHistory = [newItem, ...state.history].slice(0, 100);
        }

        let newStreak = state.userSettings.streak;
        let newLastDate = state.userSettings.lastBreathDate;

        if (durationSec > 30) {
          const today = getTodayString();
          const yesterday = getYesterdayString();

          if (newLastDate === today) {
            // Already breathed today
          } else if (newLastDate === yesterday) {
            newStreak += 1;
            newLastDate = today;
          } else {
            newStreak = 1;
            newLastDate = today;
          }
        }

        set({
          history: newHistory,
          userSettings: {
            ...state.userSettings,
            streak: newStreak,
            lastBreathDate: newLastDate,
            lastUsedPattern: patternId,
          }
        });
      }
    }),
    {
      name: 'zenb-settings-storage',
      partialize: (state) => ({
        userSettings: state.userSettings,
        hasSeenOnboarding: state.hasSeenOnboarding,
        history: state.history
      }),
    }
  ));
