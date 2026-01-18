/**
 * [P1.2 UPGRADE] Layered Soundscape Engine
 *
 * Multi-layer ambient soundscapes with dynamic mixing based on:
 * - Breathing phase (inhale/exhale emphasis different layers)
 * - AI mood analysis (valence/arousal adjust layer gains)
 * - User preferences (soundscape selection)
 *
 * Architecture:
 * - 4 soundscapes: forest, ocean, rain, fireplace
 * - Each soundscape has 3-4 independent layers
 * - Layers are 60s seamless loops
 * - Real-time gain automation sync'd to breath
 */

import * as Tone from 'tone';
import { SOUNDSCAPE_CONFIGS, SoundscapeLayer, SoundscapeName } from './audioAssets';

export class SoundscapeEngine {
  private currentSoundscape: SoundscapeName = 'none';
  private layers: Map<string, {
    player: Tone.Player;
    gain: Tone.Gain;
    config: SoundscapeLayer;
  }> = new Map();
  private masterGain: Tone.Gain;
  private isLoaded = false;

  constructor() {
    this.masterGain = new Tone.Gain(0.7); // Overall soundscape volume
  }

  /**
   * Connect soundscape engine to audio destination
   */
  connect(destination: Tone.ToneAudioNode) {
    this.masterGain.disconnect();
    this.masterGain.connect(destination);
  }

  /**
   * Load and initialize a soundscape
   */
  async loadSoundscape(name: SoundscapeName): Promise<void> {
    // Clean up previous soundscape
    await this.unload();

    if (name === 'none') {
      this.currentSoundscape = 'none';
      return;
    }

    const config = SOUNDSCAPE_CONFIGS[name];
    if (!config) {
      console.warn(`Unknown soundscape: ${name}`);
      return;
    }

    console.log(`🎵 Loading soundscape: ${name}`);

    // Load all layers
    const loadPromises = config.layers.map(async (layerConfig) => {
      try {
        const player = new Tone.Player({
          url: layerConfig.file,
          loop: true,
          fadeIn: 3.0,
          fadeOut: 3.0
        });

        const gain = new Tone.Gain(layerConfig.baseGain);

        // Connect: Player -> Gain -> Master
        player.connect(gain);
        gain.connect(this.masterGain);

        this.layers.set(layerConfig.name, {
          player,
          gain,
          config: layerConfig
        });

        console.log(`  ✓ Loaded layer: ${layerConfig.name}`);
      } catch (error) {
        console.error(`  ✗ Failed to load layer: ${layerConfig.name}`, error);
      }
    });

    await Promise.all(loadPromises);

    this.currentSoundscape = name;
    this.isLoaded = true;

    console.log(`✅ Soundscape loaded: ${name} (${this.layers.size} layers)`);
  }

  /**
   * Start playback of all layers
   */
  async start(): Promise<void> {
    if (!this.isLoaded || this.currentSoundscape === 'none') return;

    await Tone.start(); // Ensure Tone.js context is started

    this.layers.forEach(({ player }) => {
      if (player.state !== 'started') {
        player.start();
      }
    });

    console.log(`▶️ Soundscape playing: ${this.currentSoundscape}`);
  }

  /**
   * Stop playback
   */
  stop(): void {
    this.layers.forEach(({ player }) => {
      player.stop();
    });

    console.log(`⏸️ Soundscape stopped`);
  }

  /**
   * Unload current soundscape (dispose all resources)
   */
  async unload(): Promise<void> {
    this.stop();

    this.layers.forEach(({ player, gain }) => {
      player.disconnect();
      player.dispose();
      gain.disconnect();
      gain.dispose();
    });

    this.layers.clear();
    this.isLoaded = false;
    this.currentSoundscape = 'none';
  }

  /**
   * Adjust layer gains based on breathing phase
   *
   * @param phase - Current breathing phase
   * @param rampTime - Transition time in seconds (default: 2.0)
   */
  onBreathPhase(phase: 'inhale' | 'exhale' | 'hold', rampTime = 2.0): void {
    if (!this.isLoaded) return;

    this.layers.forEach(({ gain, config }) => {
      let targetGain = config.baseGain;

      if (phase === 'inhale' && config.inhaleGain !== undefined) {
        targetGain = config.inhaleGain;
      } else if (phase === 'exhale' && config.exhaleGain !== undefined) {
        targetGain = config.exhaleGain;
      }

      gain.gain.rampTo(targetGain, rampTime);
    });
  }

  /**
   * Adjust soundscape based on AI mood analysis
   *
   * @param valence - Emotional valence (-1 = negative, +1 = positive)
   * @param arousal - Arousal level (0 = calm, 1 = energized)
   */
  onAiMoodChange(valence: number, arousal: number): void {
    if (!this.isLoaded) return;

    const currentConfig = SOUNDSCAPE_CONFIGS[this.currentSoundscape as Exclude<SoundscapeName, 'none'>];
    if (!currentConfig) return;

    // Example: Positive valence → brighter sounds (birds, seagulls)
    if (this.currentSoundscape === 'forest') {
      const birdsLayer = this.layers.get('birds');
      if (birdsLayer && valence > 0.5) {
        birdsLayer.gain.gain.rampTo(0.5, 4.0);
      }
    }

    if (this.currentSoundscape === 'ocean') {
      const seagullsLayer = this.layers.get('seagulls');
      if (seagullsLayer && valence > 0.5) {
        seagullsLayer.gain.gain.rampTo(0.25, 4.0);
      }
    }

    // Low arousal → gentler, deeper sounds (waves, rain-heavy)
    if (arousal < 0.3) {
      if (this.currentSoundscape === 'ocean') {
        const wavesLayer = this.layers.get('waves');
        if (wavesLayer) wavesLayer.gain.gain.rampTo(0.7, 4.0);
      }

      if (this.currentSoundscape === 'rain') {
        const heavyRain = this.layers.get('rain-heavy');
        if (heavyRain) heavyRain.gain.gain.rampTo(0.4, 4.0);
      }
    }
  }

  /**
   * Set overall soundscape volume (0.0 - 1.0)
   */
  setVolume(volume: number): void {
    this.masterGain.gain.rampTo(volume, 0.5);
  }

  /**
   * Get current soundscape name
   */
  getCurrentSoundscape(): SoundscapeName {
    return this.currentSoundscape;
  }

  /**
   * Check if soundscape is playing
   */
  isPlaying(): boolean {
    if (!this.isLoaded) return false;

    return Array.from(this.layers.values()).some(({ player }) => player.state === 'started');
  }
}

// Singleton instance (export for use in audio.ts)
export const soundscapeEngine = new SoundscapeEngine();
