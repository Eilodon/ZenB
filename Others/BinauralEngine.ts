/**
 * [P2.2 UPGRADE] Binaural Beats Engine
 *
 * Neural frequency entrainment using binaural beat technology.
 * Creates two slightly different frequencies in left/right channels.
 * The brain perceives the difference as a rhythmic "beat" that can
 * induce specific brain wave states.
 *
 * Brain Wave Bands:
 * - Delta (1-4 Hz): Deep sleep, healing, regeneration
 * - Theta (4-8 Hz): Meditation, creativity, deep relaxation
 * - Alpha (8-13 Hz): Relaxed focus, calm awareness
 * - Beta (13-30 Hz): Active thinking, concentration
 *
 * Scientific basis:
 * - Oster, G. (1973). "Auditory beats in the brain"
 * - Le Scouarnec et al. (2001). EEG effects of binaural beats
 * 
 * Migrated from ZenOne-main (web) to ZenOne-App (React Native)
 * NOTE: Audio backend abstracted - requires IAudioBackend implementation
 */

export type BrainWaveState = 'delta' | 'theta' | 'alpha' | 'beta';

export interface BinauralConfig {
    baseFreq: number;      // Carrier frequency (Hz)
    beatFreq: number;      // Binaural beat frequency (Hz)
    description: string;
    benefits: string[];
}

export const BINAURAL_CONFIGS: Record<BrainWaveState, BinauralConfig> = {
    delta: {
        baseFreq: 200,
        beatFreq: 2.5,
        description: 'Deep Sleep & Healing',
        benefits: ['Deep restorative sleep', 'Physical healing', 'Pain relief', 'Immune boost']
    },
    theta: {
        baseFreq: 200,
        beatFreq: 6.0,
        description: 'Meditation & Creativity',
        benefits: ['Deep meditation', 'Creative insights', 'Emotional healing', 'Vivid imagery']
    },
    alpha: {
        baseFreq: 200,
        beatFreq: 10.0,
        description: 'Relaxed Focus',
        benefits: ['Calm awareness', 'Stress reduction', 'Peak performance', 'Learning enhancement']
    },
    beta: {
        baseFreq: 220,
        beatFreq: 18.0,
        description: 'Active Thinking',
        benefits: ['Mental clarity', 'Problem solving', 'Concentration', 'Energy boost']
    }
};

/**
 * Audio backend interface for platform-specific implementation
 * Implement with expo-av or react-native-audio-api for React Native
 */
export interface IAudioBackend {
    createOscillator(frequency: number): IOscillator;
    createGain(initialValue: number): IGainNode;
    createMerger(): IMerger;
    start(): Promise<void>;
}

export interface IOscillator {
    setFrequency(frequency: number, rampTime?: number): void;
    start(): void;
    stop(): void;
    connect(node: IGainNode | IMerger, channel?: number): void;
    dispose(): void;
}

export interface IGainNode {
    setGain(value: number, rampTime?: number): void;
    connect(node: IMerger | IGainNode, inputChannel?: number, outputChannel?: number): void;
    dispose(): void;
}

export interface IMerger {
    connect(node: IGainNode): void;
    dispose(): void;
}

/**
 * Mock audio backend for development/testing
 * Replace with real implementation using expo-av
 */
export class MockAudioBackend implements IAudioBackend {
    async start(): Promise<void> {
        console.log('[MockAudio] Audio context started');
    }

    createOscillator(frequency: number): IOscillator {
        return {
            setFrequency: (freq, _rampTime) => console.log(`[MockOsc] freq=${freq}`),
            start: () => console.log('[MockOsc] started'),
            stop: () => console.log('[MockOsc] stopped'),
            connect: () => { },
            dispose: () => { }
        };
    }

    createGain(_initialValue: number): IGainNode {
        return {
            setGain: (_value, _rampTime) => { },
            connect: () => { },
            dispose: () => { }
        };
    }

    createMerger(): IMerger {
        return {
            connect: () => { },
            dispose: () => { }
        };
    }
}

export class BinauralEngine {
    private leftOsc: IOscillator | null = null;
    private rightOsc: IOscillator | null = null;
    private leftGain: IGainNode | null = null;
    private rightGain: IGainNode | null = null;
    private merger: IMerger | null = null;
    private masterVolume: IGainNode | null = null;

    private currentState: BrainWaveState = 'theta';
    private isActive = false;
    private backend: IAudioBackend;

    constructor(backend?: IAudioBackend) {
        this.backend = backend ?? new MockAudioBackend();
    }

    /**
     * Initialize binaural beat oscillators
     */
    initialize(): void {
        if (this.isActive) return;

        const config = BINAURAL_CONFIGS[this.currentState];

        // Create stereo oscillators
        this.leftOsc = this.backend.createOscillator(config.baseFreq);
        this.rightOsc = this.backend.createOscillator(config.baseFreq + config.beatFreq);

        // Individual channel gains (very low - binaural should be subtle)
        this.leftGain = this.backend.createGain(0.08);
        this.rightGain = this.backend.createGain(0.08);

        // Master volume control
        this.masterVolume = this.backend.createGain(0);  // Start muted, fade in

        // Merge into stereo
        this.merger = this.backend.createMerger();

        // Connect signal chain
        this.leftOsc.connect(this.leftGain);
        this.rightOsc.connect(this.rightGain);

        this.leftGain.connect(this.merger, 0, 0);
        this.rightGain.connect(this.merger, 0, 1);

        this.merger.connect(this.masterVolume);

        console.log('🧠 Binaural Engine initialized');
    }

    /**
     * Start binaural beats with specific brain wave state
     */
    async start(state: BrainWaveState = 'theta', fadeInTime = 3.0): Promise<void> {
        if (!this.leftOsc || !this.rightOsc || !this.masterVolume) {
            this.initialize();
        }

        await this.backend.start();

        const config = BINAURAL_CONFIGS[state];

        // Set frequencies
        this.leftOsc!.setFrequency(config.baseFreq);
        this.rightOsc!.setFrequency(config.baseFreq + config.beatFreq);

        // Start oscillators
        this.leftOsc!.start();
        this.rightOsc!.start();

        // Fade in master volume
        this.masterVolume!.setGain(1.0, fadeInTime);

        this.currentState = state;
        this.isActive = true;

        console.log(`🧠 Binaural Beats: ${config.description} (${config.beatFreq} Hz)`);
    }

    /**
     * Stop binaural beats
     */
    async stop(fadeOutTime = 2.0): Promise<void> {
        if (!this.isActive || !this.masterVolume) return;

        // Fade out
        this.masterVolume.setGain(0, fadeOutTime);

        // Wait for fade out, then stop oscillators
        await new Promise(resolve => setTimeout(resolve, fadeOutTime * 1000));

        this.leftOsc?.stop();
        this.rightOsc?.stop();

        this.isActive = false;

        console.log('🧠 Binaural Beats stopped');
    }

    /**
     * Change brain wave state (smooth transition)
     */
    setState(newState: BrainWaveState, transitionTime = 4.0): void {
        if (!this.isActive || !this.leftOsc || !this.rightOsc) return;

        const config = BINAURAL_CONFIGS[newState];

        // Smoothly transition frequencies
        this.leftOsc.setFrequency(config.baseFreq, transitionTime);
        this.rightOsc.setFrequency(config.baseFreq + config.beatFreq, transitionTime);

        this.currentState = newState;

        console.log(`🧠 Binaural transition: ${config.description} (${config.beatFreq} Hz)`);
    }

    /**
     * Sync binaural state to breathing phase
     */
    onBreathPhase(phase: 'inhale' | 'exhale' | 'hold', arousalTarget = 0.5): void {
        if (!this.isActive) return;

        // Inhale → slightly increase frequency (alertness)
        if (phase === 'inhale') {
            const state = arousalTarget > 0.5 ? 'alpha' : 'theta';
            this.setState(state, 2.0);
        }

        // Exhale → decrease for relaxation
        if (phase === 'exhale') {
            this.setState('theta', 2.0);
        }

        // Hold → maintain current state or go deeper
        if (phase === 'hold') {
            const state = arousalTarget < 0.3 ? 'delta' : 'theta';
            this.setState(state, 3.0);
        }
    }

    /**
     * Set overall volume (0.0 - 1.0)
     */
    setVolume(volume: number): void {
        if (!this.leftGain || !this.rightGain) return;

        const clampedVolume = Math.max(0, Math.min(1, volume));
        const targetGain = clampedVolume * 0.08; // Max 0.08 for subtlety

        this.leftGain.setGain(targetGain, 0.5);
        this.rightGain.setGain(targetGain, 0.5);
    }

    /**
     * Get current brain wave state
     */
    getCurrentState(): BrainWaveState {
        return this.currentState;
    }

    /**
     * Check if binaural beats are active
     */
    isRunning(): boolean {
        return this.isActive;
    }

    /**
     * Get configuration for a brain wave state
     */
    static getConfig(state: BrainWaveState): BinauralConfig {
        return BINAURAL_CONFIGS[state];
    }

    /**
     * Dispose all resources
     */
    dispose(): void {
        this.stop(0);

        this.leftOsc?.dispose();
        this.rightOsc?.dispose();
        this.leftGain?.dispose();
        this.rightGain?.dispose();
        this.merger?.dispose();
        this.masterVolume?.dispose();

        this.leftOsc = null;
        this.rightOsc = null;
        this.leftGain = null;
        this.rightGain = null;
        this.merger = null;
        this.masterVolume = null;

        console.log('🧠 Binaural Engine disposed');
    }
}

// Singleton instance with mock backend (replace with real audio in production)
export const binauralEngine = new BinauralEngine();
