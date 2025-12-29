export type BreathPhase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut';
export type BreathingType = '4-7-8' | 'box' | 'calm';
export type ColorTheme = 'warm' | 'cool' | 'neutral';
export type QualityTier = 'auto' | 'low' | 'medium' | 'high';

export type UserSettings = {
  soundEnabled: boolean;
  hapticEnabled: boolean;
  hapticStrength: 'light' | 'medium' | 'heavy';
  theme: ColorTheme;
  quality: QualityTier;
  reduceMotion: boolean;
};

export type BreathPattern = {
  id: BreathingType;
  label: string;
  timings: Record<BreathPhase, number>; // seconds
  colorTheme: ColorTheme;
  recommendedCycles?: number;
};

export const BREATHING_PATTERNS: Record<string, BreathPattern> = {
  '4-7-8': {
    id: '4-7-8',
    label: 'Relax (4-7-8)',
    timings: { inhale: 4, holdIn: 7, exhale: 8, holdOut: 0 },
    colorTheme: 'warm',
    recommendedCycles: 4,
  },
  box: {
    id: 'box',
    label: 'Focus (Box)',
    timings: { inhale: 4, holdIn: 4, exhale: 4, holdOut: 4 },
    colorTheme: 'neutral',
    recommendedCycles: 6,
  },
  calm: {
    id: 'calm',
    label: 'Calm (4-0-6-0)',
    timings: { inhale: 4, holdIn: 0, exhale: 6, holdOut: 0 },
    colorTheme: 'cool',
    recommendedCycles: 8,
  },
};