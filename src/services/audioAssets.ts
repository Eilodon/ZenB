import type { CueType, SoundPack } from '../types';

export type SoundPackEngine = 'synth' | 'breath' | 'bells' | 'samples' | 'voice-full' | 'voice-12';

export const SOUND_PACK_ENGINES: Record<SoundPack, { engine: SoundPackEngine }> = {
  synth: { engine: 'synth' },
  breath: { engine: 'breath' },
  bells: { engine: 'bells' },
  'real-zen': { engine: 'samples' },
  'voice-full': { engine: 'voice-full' },
  'voice-12': { engine: 'voice-12' }
};

export const SOUND_PACK_LIST = Object.keys(SOUND_PACK_ENGINES) as SoundPack[];

export const REAL_ZEN_SAMPLE_URLS = {
  inhale: ['/audio/ai-generated/inhale-calm-01.mp3', '/audio/ai-generated/inhale-calm-02.mp3', '/audio/ai-generated/inhale-deep-01.mp3'],
  exhale: ['/audio/ai-generated/exhale-calm-01.mp3', '/audio/ai-generated/exhale-deep-01.mp3'],
  hold: ['/audio/ai-generated/hold-silence-01.mp3'],
  finish: ['/audio/ai-generated/bell-ting-01.mp3', '/audio/ai-generated/bowl-strike-01.mp3'],
  ambience: undefined // Ambience generation failed
} as const;

export type SoundscapeName = 'none' | 'forest' | 'ocean' | 'rain' | 'fireplace';

export type SoundscapeLayer = {
  name: string;
  file: string;
  baseGain: number;
  inhaleGain?: number;
  exhaleGain?: number;
};

export type SoundscapeConfig = {
  name: SoundscapeName;
  layers: SoundscapeLayer[];
};

export const SOUNDSCAPE_CONFIGS: Record<Exclude<SoundscapeName, 'none'>, SoundscapeConfig> = {
  forest: {
    name: 'forest',
    layers: [
      { name: 'birds', file: '/audio/soundscapes/forest/birds.mp3', baseGain: 0.3, inhaleGain: 0.45, exhaleGain: 0.15 },
      { name: 'wind', file: '/audio/soundscapes/forest/wind.mp3', baseGain: 0.5, inhaleGain: 0.6, exhaleGain: 0.3 },
      { name: 'creek', file: '/audio/soundscapes/forest/creek.mp3', baseGain: 0.4, inhaleGain: 0.3, exhaleGain: 0.5 },
      { name: 'crickets', file: '/audio/soundscapes/forest/crickets.mp3', baseGain: 0.2, inhaleGain: 0.15, exhaleGain: 0.25 }
    ]
  },
  ocean: {
    name: 'ocean',
    layers: [
      { name: 'waves', file: '/audio/soundscapes/ocean/waves.mp3', baseGain: 0.6, inhaleGain: 0.5, exhaleGain: 0.7 },
      { name: 'seagulls', file: '/audio/soundscapes/ocean/seagulls.mp3', baseGain: 0.15, inhaleGain: 0.25, exhaleGain: 0.1 },
      { name: 'wind', file: '/audio/soundscapes/ocean/wind.mp3', baseGain: 0.35, inhaleGain: 0.45, exhaleGain: 0.25 }
    ]
  },
  rain: {
    name: 'rain',
    layers: [
      { name: 'rain-light', file: '/audio/soundscapes/rain/rain-light.mp3', baseGain: 0.5, inhaleGain: 0.4, exhaleGain: 0.6 },
      { name: 'rain-heavy', file: '/audio/soundscapes/rain/rain-heavy.mp3', baseGain: 0.3, inhaleGain: 0.25, exhaleGain: 0.35 },
      { name: 'thunder', file: '/audio/soundscapes/rain/thunder.mp3', baseGain: 0.15, inhaleGain: 0.1, exhaleGain: 0.2 }
    ]
  },
  fireplace: {
    name: 'fireplace',
    layers: [
      { name: 'crackle', file: '/audio/soundscapes/fireplace/crackle.mp3', baseGain: 0.45, inhaleGain: 0.4, exhaleGain: 0.5 },
      { name: 'ambient', file: '/audio/soundscapes/fireplace/ambient.mp3', baseGain: 0.5, inhaleGain: 0.5, exhaleGain: 0.5 }
    ]
  }
};

export type AudioAssetCategory = 'cue' | 'ambience' | 'soundscape';

export type AudioAssetManifestEntry = {
  id: string;
  file: string;
  category: AudioAssetCategory;
  loop: boolean;
  expectedDurationSec?: number;
  pack?: SoundPack;
  cue?: CueType;
  soundscape?: SoundscapeName;
  layer?: string;
};

const realZenCueEntries: AudioAssetManifestEntry[] = (['inhale', 'exhale', 'hold', 'finish'] as const).flatMap((cue) =>
  REAL_ZEN_SAMPLE_URLS[cue].map((file, idx) => ({
    id: `real-zen:${cue}:${String(idx + 1).padStart(2, '0')}`,
    file,
    category: 'cue',
    loop: false,
    pack: 'real-zen',
    cue
  }))
);

const realZenAmbienceEntry: AudioAssetManifestEntry[] = REAL_ZEN_SAMPLE_URLS.ambience
  ? [{
    id: 'real-zen:ambience:loop',
    file: REAL_ZEN_SAMPLE_URLS.ambience,
    category: 'ambience',
    loop: true,
    expectedDurationSec: 60,
    pack: 'real-zen'
  }]
  : [];

const soundscapeEntries: AudioAssetManifestEntry[] = Object.values(SOUNDSCAPE_CONFIGS).flatMap((config) =>
  config.layers.map((layer) => ({
    id: `soundscape:${config.name}:${layer.name}`,
    file: layer.file,
    category: 'soundscape',
    loop: true,
    expectedDurationSec: 60,
    soundscape: config.name,
    layer: layer.name
  }))
);

export const AUDIO_ASSET_MANIFEST: AudioAssetManifestEntry[] = [
  ...realZenCueEntries,
  ...realZenAmbienceEntry,
  ...soundscapeEntries
];
