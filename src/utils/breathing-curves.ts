/**
 * Breathing Animation Curves & Utilities
 * Professional-grade easing functions for organic motion
 *
 * Based on animation principles:
 * - Anticipation (preparation before action)
 * - Follow-through (continuation after action)
 * - Squash & Stretch (volume conservation)
 * - Slow In / Slow Out (acceleration/deceleration)
 */

import { BreathPhase } from '../types';

// ============================================================================
// EASING FUNCTIONS
// ============================================================================

/**
 * Standard easing functions
 */
export const Easing = {
    // Linear (no easing)
    linear: (t: number): number => t,

    // Quadratic
    easeInQuad: (t: number): number => t * t,
    easeOutQuad: (t: number): number => t * (2 - t),
    easeInOutQuad: (t: number): number =>
        t < 0.5 ? 2 * t * t : -1 + (4 - 2 * t) * t,

    // Cubic
    easeInCubic: (t: number): number => t * t * t,
    easeOutCubic: (t: number): number => {
        const t1 = t - 1;
        return t1 * t1 * t1 + 1;
    },
    easeInOutCubic: (t: number): number =>
        t < 0.5 ? 4 * t * t * t : (t - 1) * (2 * t - 2) * (2 * t - 2) + 1,

    // Quartic
    easeInQuart: (t: number): number => t * t * t * t,
    easeOutQuart: (t: number): number => {
        const t1 = t - 1;
        return 1 - t1 * t1 * t1 * t1;
    },
    easeInOutQuart: (t: number): number => {
        const t1 = t - 1;
        return t < 0.5 ? 8 * t * t * t * t : 1 - 8 * t1 * t1 * t1 * t1;
    },

    // Sine (very smooth)
    easeInSine: (t: number): number => 1 - Math.cos((t * Math.PI) / 2),
    easeOutSine: (t: number): number => Math.sin((t * Math.PI) / 2),
    easeInOutSine: (t: number): number => -(Math.cos(Math.PI * t) - 1) / 2,

    // Exponential
    easeInExpo: (t: number): number => (t === 0 ? 0 : Math.pow(2, 10 * t - 10)),
    easeOutExpo: (t: number): number => (t === 1 ? 1 : 1 - Math.pow(2, -10 * t)),
    easeInOutExpo: (t: number): number => {
        if (t === 0) return 0;
        if (t === 1) return 1;
        return t < 0.5
            ? Math.pow(2, 20 * t - 10) / 2
            : (2 - Math.pow(2, -20 * t + 10)) / 2;
    },

    // Back (overshoot)
    easeInBack: (t: number): number => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return c3 * t * t * t - c1 * t * t;
    },
    easeOutBack: (t: number): number => {
        const c1 = 1.70158;
        const c3 = c1 + 1;
        return 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2);
    },
    easeInOutBack: (t: number): number => {
        const c1 = 1.70158;
        const c2 = c1 * 1.525;
        return t < 0.5
            ? (Math.pow(2 * t, 2) * ((c2 + 1) * 2 * t - c2)) / 2
            : (Math.pow(2 * t - 2, 2) * ((c2 + 1) * (t * 2 - 2) + c2) + 2) / 2;
    },

    // Elastic (spring-like)
    easeOutElastic: (t: number): number => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
            ? 0
            : t === 1
                ? 1
                : Math.pow(2, -10 * t) * Math.sin((t * 10 - 0.75) * c4) + 1;
    },
    easeInElastic: (t: number): number => {
        const c4 = (2 * Math.PI) / 3;
        return t === 0
            ? 0
            : t === 1
                ? 1
                : -Math.pow(2, 10 * t - 10) * Math.sin((t * 10 - 10.75) * c4);
    },

    // Bounce
    easeOutBounce: (t: number): number => {
        const n1 = 7.5625;
        const d1 = 2.75;

        if (t < 1 / d1) {
            return n1 * t * t;
        } else if (t < 2 / d1) {
            return n1 * (t -= 1.5 / d1) * t + 0.75;
        } else if (t < 2.5 / d1) {
            return n1 * (t -= 2.25 / d1) * t + 0.9375;
        } else {
            return n1 * (t -= 2.625 / d1) * t + 0.984375;
        }
    },
};

// ============================================================================
// BREATHING-SPECIFIC CURVES
// ============================================================================

/**
 * Custom breathing curves based on real respiratory patterns
 * Inhale is typically faster than exhale (ratio ~1:1.5 to 1:2)
 */
export const BreathCurves = {
    /**
     * Inhale curve: Slow start, accelerating expansion
     * Mimics natural lung filling pattern
     */
    inhale: (t: number): number => {
        // Quadratic ease-in with slight S-curve
        const base = t * t;
        const smoothing = Math.sin(t * Math.PI * 0.5) * 0.1;
        return Math.min(1, base + smoothing);
    },

    /**
     * Exhale curve: Fast initial release, slowing deceleration
     * Mimics natural lung emptying
     */
    exhale: (t: number): number => {
        // Quadratic ease-out with gentle landing
        const base = 1 - (1 - t) * (1 - t);
        const smoothing = (1 - Math.cos(t * Math.PI)) * 0.05;
        return Math.min(1, base + smoothing);
    },

    /**
     * Hold phase: Subtle micro-oscillations for "alive" feel
     * Prevents static appearance during holds
     */
    hold: (t: number, frequency: number = 2): number => {
        // Small sine wave oscillation
        const amplitude = 0.02;
        return Math.sin(t * Math.PI * frequency) * amplitude;
    },

    /**
     * Anticipation: Small reverse movement before main action
     * Used at start of inhale
     */
    anticipation: (t: number, amount: number = 0.03): number => {
        if (t < 0.1) {
            // Small squash at start
            return -amount * Math.sin(t * Math.PI * 5);
        }
        return 0;
    },

    /**
     * Follow-through: Overshoot and settle
     * Used at end of inhale/exhale
     */
    followThrough: (t: number, overshoot: number = 0.08): number => {
        if (t > 0.85) {
            const localT = (t - 0.85) / 0.15;
            return overshoot * Math.sin(localT * Math.PI) * (1 - localT);
        }
        return 0;
    },
};

// ============================================================================
// SCALE CALCULATIONS
// ============================================================================

export interface ScaleConfig {
    baseScale: number;
    maxScale: number;
    minScale: number;
    anticipationAmount: number;
    overshootAmount: number;
    holdOscillation: number;
}

const DEFAULT_SCALE_CONFIG: ScaleConfig = {
    baseScale: 1.0,
    maxScale: 1.12,
    minScale: 0.97,
    anticipationAmount: 0.03,
    overshootAmount: 0.08,
    holdOscillation: 0.015,
};

/**
 * Calculate breath scale with all animation principles applied
 */
export function calculateBreathScale(
    phase: BreathPhase,
    progress: number,
    config: Partial<ScaleConfig> = {}
): number {
    const cfg = { ...DEFAULT_SCALE_CONFIG, ...config };
    const { baseScale, maxScale, anticipationAmount, holdOscillation } = cfg;

    let scale = baseScale;

    switch (phase) {
        case 'inhale': {
            // Phase: Rest → Full expansion
            if (progress < 0.12) {
                const anticipation = BreathCurves.anticipation(progress, anticipationAmount);
                scale = baseScale + anticipation;
            } else {
                // Main expansion with overshoot at end
                const mainProgress = (progress - 0.12) / 0.88;
                const expansion = (maxScale - baseScale) * Easing.easeOutBack(mainProgress);
                scale = baseScale + expansion;
            }
            break;
        }

        case 'holdIn': {
            // Phase: Full expansion held (with micro-oscillation)
            const oscillation = BreathCurves.hold(progress, 3) * holdOscillation;
            scale = maxScale + oscillation;
            break;
        }

        case 'exhale': {
            // Phase: Full → Rest (controlled deflation)
            const easedProgress = BreathCurves.exhale(progress);

            // Smooth deflation with slight settle
            const deflation = (maxScale - baseScale) * (1 - easedProgress);
            const settle = progress > 0.9 ? Math.sin((progress - 0.9) * Math.PI * 5) * 0.01 : 0;
            scale = baseScale + deflation + settle;
            break;
        }

        case 'holdOut': {
            // Phase: Rest position held (subtle life)
            const oscillation = BreathCurves.hold(progress, 2) * holdOscillation * 0.5;
            scale = baseScale + oscillation;
            break;
        }

        default:
            scale = baseScale;
    }

    // Clamp to prevent extreme values
    return Math.max(cfg.minScale, Math.min(cfg.maxScale + cfg.overshootAmount, scale));
}

// ============================================================================
// SECONDARY MOTION (Halo, Ring)
// ============================================================================

/**
 * Calculate delayed/lagging motion for secondary elements
 * Implements follow-through principle
 */
export function calculateSecondaryScale(
    primaryScale: number,
    previousScale: number,
    lagFactor: number = 0.85,
    amplification: number = 1.02
): number {
    // Exponential smoothing with amplification
    const smoothedScale = previousScale + (primaryScale - previousScale) * (1 - lagFactor);
    return smoothedScale * amplification;
}

/**
 * Calculate rotation lag for ring element
 */
export function calculateSecondaryRotation(
    primaryRotation: number,
    previousRotation: number,
    lagFactor: number = 0.9
): number {
    return previousRotation + (primaryRotation - previousRotation) * (1 - lagFactor);
}

// ============================================================================
// MATERIAL PROPERTY ANIMATIONS
// ============================================================================

export interface MaterialProperties {
    roughness: number;
    transmission: number;
    clearcoat: number;
    clearcoatRoughness: number;
    ior: number;
    thickness: number;
    iridescence: number;
}

const MATERIAL_RANGES = {
    roughness: { min: 0.15, max: 0.55 },
    transmission: { min: 0.45, max: 0.95 },
    clearcoat: { min: 0.35, max: 1.0 },
    clearcoatRoughness: { min: 0.08, max: 0.5 },
    ior: { min: 1.2, max: 1.55 },
    thickness: { min: 0.25, max: 0.75 },
    iridescence: { min: 0.0, max: 0.35 },
};

/**
 * Calculate material properties based on breath intensity
 * Higher breath = more glass-like, more refractive
 */
export function calculateMaterialProperties(
    breathIntensity: number,
    aiPulse: number = 0
): MaterialProperties {
    const lerp = (min: number, max: number, t: number) => min + (max - min) * t;

    // AI pulse increases iridescence and transmission
    const aiBoost = aiPulse * 0.3;
    const effectiveBreath = Math.min(1, breathIntensity + aiBoost);

    return {
        roughness: lerp(MATERIAL_RANGES.roughness.max, MATERIAL_RANGES.roughness.min, effectiveBreath),
        transmission: lerp(MATERIAL_RANGES.transmission.min, MATERIAL_RANGES.transmission.max, effectiveBreath),
        clearcoat: lerp(MATERIAL_RANGES.clearcoat.min, MATERIAL_RANGES.clearcoat.max, effectiveBreath),
        clearcoatRoughness: lerp(MATERIAL_RANGES.clearcoatRoughness.max, MATERIAL_RANGES.clearcoatRoughness.min, effectiveBreath),
        ior: lerp(MATERIAL_RANGES.ior.min, MATERIAL_RANGES.ior.max, effectiveBreath),
        thickness: lerp(MATERIAL_RANGES.thickness.min, MATERIAL_RANGES.thickness.max, effectiveBreath),
        iridescence: lerp(MATERIAL_RANGES.iridescence.min, MATERIAL_RANGES.iridescence.max, effectiveBreath + aiPulse * 0.5),
    };
}

// ============================================================================
// AI STATE ANIMATIONS
// ============================================================================

export type AIState = 'disconnected' | 'connecting' | 'connected' | 'thinking' | 'speaking';

export interface AIAnimationValues {
    pulse: number;
    colorIntensity: number;
    distortionStrength: number;
    glowIntensity: number;
}

/**
 * Calculate AI animation values based on state
 */
export function calculateAIAnimation(
    state: AIState,
    time: number,
    audioLevel: number = 0 // 0-1 audio amplitude for speaking state
): AIAnimationValues {
    switch (state) {
        case 'disconnected':
            return {
                pulse: 0,
                colorIntensity: 0,
                distortionStrength: 0,
                glowIntensity: 0,
            };

        case 'connecting':
            // Pulsing animation indicating connection attempt
            return {
                pulse: 0.3 + Math.sin(time * 4) * 0.2,
                colorIntensity: 0.5,
                distortionStrength: 0.05,
                glowIntensity: 0.3,
            };

        case 'connected':
            // Subtle ambient presence
            return {
                pulse: 0.15 + Math.sin(time * 1.5) * 0.05,
                colorIntensity: 0.3,
                distortionStrength: 0,
                glowIntensity: 0.2,
            };

        case 'thinking':
            // Deep, contemplative throb
            return {
                pulse: 0.4 + Math.sin(time * 2.5) * 0.15,
                colorIntensity: 0.6,
                distortionStrength: 0.03,
                glowIntensity: 0.5 + Math.sin(time * 3) * 0.1,
            };

        case 'speaking':
            // Audio-reactive animation
            const basePulse = 0.7;
            const audioReactive = audioLevel * 0.4;
            const flutter = Math.sin(time * 12) * 0.1;

            return {
                pulse: Math.min(1, basePulse + audioReactive + flutter),
                colorIntensity: 0.8 + audioLevel * 0.2,
                distortionStrength: 0.08 + audioLevel * 0.12,
                glowIntensity: 0.7 + audioLevel * 0.3,
            };

        default:
            return {
                pulse: 0,
                colorIntensity: 0,
                distortionStrength: 0,
                glowIntensity: 0,
            };
    }
}

// ============================================================================
// INTERPOLATION UTILITIES
// ============================================================================

/**
 * Smooth interpolation with configurable speed
 * Uses exponential smoothing for natural feel
 */
export function smoothLerp(
    current: number,
    target: number,
    delta: number,
    speed: number = 3.0
): number {
    const factor = 1 - Math.pow(0.001, delta * speed);
    return current + (target - current) * factor;
}

/**
 * Smooth interpolation for THREE.Vector3-like objects
 */
export function smoothLerpVec3(
    current: { x: number; y: number; z: number },
    target: { x: number; y: number; z: number },
    delta: number,
    speed: number = 3.0
): { x: number; y: number; z: number } {
    return {
        x: smoothLerp(current.x, target.x, delta, speed),
        y: smoothLerp(current.y, target.y, delta, speed),
        z: smoothLerp(current.z, target.z, delta, speed),
    };
}

/**
 * Clamp value between min and max
 */
export function clamp(value: number, min: number, max: number): number {
    return Math.max(min, Math.min(max, value));
}

// ============================================================================
// SPRING PHYSICS SIMULATION
// ============================================================================

export interface SpringState {
    position: number;
    velocity: number;
}

export interface SpringConfig {
    mass: number;
    tension: number;
    friction: number;
    precision: number;
}

const DEFAULT_SPRING_CONFIG: SpringConfig = {
    mass: 1.0,
    tension: 180,
    friction: 26,
    precision: 0.001,
};

/**
 * Simple spring physics step
 * Based on damped harmonic oscillator
 */
export function springStep(
    state: SpringState,
    target: number,
    delta: number,
    config: Partial<SpringConfig> = {}
): SpringState {
    const { mass, tension, friction, precision } = { ...DEFAULT_SPRING_CONFIG, ...config };

    const displacement = state.position - target;
    const springForce = -tension * displacement;
    const dampingForce = -friction * state.velocity;
    const acceleration = (springForce + dampingForce) / mass;

    let newVelocity = state.velocity + acceleration * delta;
    let newPosition = state.position + newVelocity * delta;

    // Snap to target if close enough (prevents infinite oscillation)
    if (Math.abs(newPosition - target) < precision && Math.abs(newVelocity) < precision) {
        newPosition = target;
        newVelocity = 0;
    }

    return {
        position: newPosition,
        velocity: newVelocity,
    };
}

// ============================================================================
// EXPORTS
// ============================================================================

export const BreathingUtils = {
    Easing,
    BreathCurves,
    calculateBreathScale,
    calculateSecondaryScale,
    calculateSecondaryRotation,
    calculateMaterialProperties,
    calculateAIAnimation,
    smoothLerp,
    smoothLerpVec3,
    clamp,
    springStep,
};

export default BreathingUtils;
