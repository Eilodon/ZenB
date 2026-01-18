/**
 * Voice Guidance Service - TTS for breathing instructions
 * 
 * Modes:
 * - 'voice': Full voice guidance ("Inhale", "Exhale")
 * - 'counting': Simple counting ("One", "Two")
 * - 'off': No voice
 */

import * as Speech from 'expo-speech';
import { Language, TRANSLATIONS } from '../i18n/translations';
import { logger } from '../utils/logger';

export type VoiceMode = 'voice' | 'counting' | 'off';

// Phase to TTS text mapping
type BreathPhase = 'Inhale' | 'HoldIn' | 'Exhale' | 'HoldOut';

interface VoiceOptions {
    language: Language;
    mode: VoiceMode;
    rate?: number;
    pitch?: number;
    volume?: number;
}

const DEFAULT_OPTIONS: VoiceOptions = {
    language: 'en',
    mode: 'voice',
    rate: 0.85,
    pitch: 1.0,
    volume: 0.8,
};

class VoiceGuidanceService {
    private options: VoiceOptions = DEFAULT_OPTIONS;
    private lastPhase: BreathPhase | null = null;
    private cycleCount = 0;

    /**
     * Configure voice guidance options
     */
    configure(options: Partial<VoiceOptions>) {
        this.options = { ...this.options, ...options };
    }

    /**
     * Get available voices for a language
     */
    async getVoices(language: Language): Promise<Speech.Voice[]> {
        const voices = await Speech.getAvailableVoicesAsync();
        const langCode = language === 'vi' ? 'vi' : 'en';
        return voices.filter(v => v.language.startsWith(langCode));
    }

    /**
     * Speak guidance for a breath phase
     */
    async speakPhase(phase: BreathPhase) {
        if (this.options.mode === 'off') return;

        // Prevent duplicate calls for same phase
        if (this.lastPhase === phase) return;
        this.lastPhase = phase;

        // Stop any ongoing speech
        Speech.stop();

        let text: string;

        if (this.options.mode === 'counting') {
            // Simple counting mode
            if (phase === 'Inhale') {
                text = this.options.language === 'vi' ? 'Một' : 'One';
            } else if (phase === 'Exhale') {
                text = this.options.language === 'vi' ? 'Hai' : 'Two';
                this.cycleCount++;
            } else {
                return; // Don't speak holds in counting mode
            }
        } else {
            // Full voice mode
            const t = TRANSLATIONS[this.options.language].phases;
            switch (phase) {
                case 'Inhale':
                    text = t.inhale;
                    break;
                case 'Exhale':
                    text = t.exhale;
                    break;
                case 'HoldIn':
                case 'HoldOut':
                    text = t.hold;
                    break;
                default:
                    return;
            }
        }

        try {
            await Speech.speak(text, {
                language: this.options.language === 'vi' ? 'vi-VN' : 'en-US',
                rate: this.options.rate,
                pitch: this.options.pitch,
                volume: this.options.volume,
            });
        } catch (error) {
            logger.warn('Voice guidance error:', error);
        }
    }

    /**
     * Reset state for new session
     */
    reset() {
        this.lastPhase = null;
        this.cycleCount = 0;
        Speech.stop();
    }

    /**
     * Stop any ongoing speech
     */
    stop() {
        Speech.stop();
    }

    /**
     * Check if TTS is available
     */
    async isAvailable(): Promise<boolean> {
        const voices = await Speech.getAvailableVoicesAsync();
        return voices.length > 0;
    }
}

export const voiceGuidance = new VoiceGuidanceService();
export default voiceGuidance;
