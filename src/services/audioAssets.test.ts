import { describe, it, expect } from 'vitest';
import { TRANSLATIONS } from '../translations';
import { AUDIO_ASSET_MANIFEST, REAL_ZEN_SAMPLE_URLS, SOUND_PACK_ENGINES, SOUNDSCAPE_CONFIGS } from './audioAssets';

describe('audio asset catalog', () => {
  it('maps every sound pack label to a known engine', () => {
    const packs = Object.keys(SOUND_PACK_ENGINES);
    const enLabels = TRANSLATIONS.en.settings.soundPacks;
    const viLabels = TRANSLATIONS.vi.settings.soundPacks;

    packs.forEach((pack) => {
      expect(enLabels[pack as keyof typeof enLabels]).toBeTruthy();
      expect(viLabels[pack as keyof typeof viLabels]).toBeTruthy();
      expect(SOUND_PACK_ENGINES[pack as keyof typeof SOUND_PACK_ENGINES]).toBeTruthy();
    });
  });

  it('has a 1:1 manifest entry for all real-zen samples and soundscapes', () => {
    const manifestFiles = new Set(AUDIO_ASSET_MANIFEST.map((entry) => entry.file));
    const realZenFiles = [
      ...REAL_ZEN_SAMPLE_URLS.inhale,
      ...REAL_ZEN_SAMPLE_URLS.exhale,
      ...REAL_ZEN_SAMPLE_URLS.hold,
      ...REAL_ZEN_SAMPLE_URLS.finish,
      REAL_ZEN_SAMPLE_URLS.ambience
    ];

    realZenFiles.forEach((file) => {
      expect(manifestFiles.has(file)).toBe(true);
    });

    Object.values(SOUNDSCAPE_CONFIGS).forEach((config) => {
      config.layers.forEach((layer) => {
        expect(manifestFiles.has(layer.file)).toBe(true);
      });
    });
  });

  it('keeps manifest file paths unique', () => {
    const files = AUDIO_ASSET_MANIFEST.map((entry) => entry.file);
    const unique = new Set(files);
    expect(unique.size).toBe(files.length);
  });
});
