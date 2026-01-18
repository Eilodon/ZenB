/**
 * Adaptive Quality System for ZenB Orb
 * Runtime performance monitoring and quality adjustment
 *
 * Features:
 * - FPS monitoring with rolling average
 * - Automatic quality tier adjustment
 * - Device capability detection
 * - Battery state awareness
 * - Reduced motion preference detection
 */

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';

// ============================================================================
// TYPES
// ============================================================================

export interface QualityConfig {
    dpr: number;
    segments: number;
    octaves: number;
    halo: boolean;
    ring: boolean;
    postProcessing: boolean;
    bloomIntensity: number;
    shadowQuality: 'none' | 'low' | 'high';
}

export type QualityTier = 'minimal' | 'low' | 'medium' | 'high' | 'ultra';

export interface PerformanceMetrics {
    fps: number;
    frameTime: number;
    gpuTier: number;
    memoryUsage: number;
    isUnderBudget: boolean;
    headroom: number;
}

export interface DeviceCapabilities {
    cores: number;
    devicePixelRatio: number;
    isMobile: boolean;
    isLowEndDevice: boolean;
    hasWebGL2: boolean;
    maxTextureSize: number;
    gpuVendor: string;
    gpuRenderer: string;
    estimatedGPUTier: 0 | 1 | 2 | 3;
}

// ============================================================================
// QUALITY TIER CONFIGURATIONS
// ============================================================================

export const QUALITY_CONFIGS: Record<QualityTier, QualityConfig> = {
    minimal: {
        dpr: 1.0,
        segments: 18,
        octaves: 2,
        halo: false,
        ring: false,
        postProcessing: false,
        bloomIntensity: 0,
        shadowQuality: 'none',
    },
    low: {
        dpr: 1.0,
        segments: 24,
        octaves: 2,
        halo: false,
        ring: false,
        postProcessing: false,
        bloomIntensity: 0,
        shadowQuality: 'none',
    },
    medium: {
        dpr: 1.5,
        segments: 40,
        octaves: 3,
        halo: true,
        ring: false,
        postProcessing: true,
        bloomIntensity: 0.5,
        shadowQuality: 'low',
    },
    high: {
        dpr: 2.0,
        segments: 56,
        octaves: 4,
        halo: true,
        ring: true,
        postProcessing: true,
        bloomIntensity: 0.8,
        shadowQuality: 'high',
    },
    ultra: {
        dpr: 2.0,
        segments: 72,
        octaves: 5,
        halo: true,
        ring: true,
        postProcessing: true,
        bloomIntensity: 1.0,
        shadowQuality: 'high',
    },
};

const TIER_ORDER: QualityTier[] = ['minimal', 'low', 'medium', 'high', 'ultra'];

// ============================================================================
// DEVICE DETECTION
// ============================================================================

export function detectDeviceCapabilities(): DeviceCapabilities {
    const cores = navigator.hardwareConcurrency || 4;
    const dpr = Math.min(window.devicePixelRatio || 1, 3);

    // Mobile detection
    const isMobile = /iPhone|iPad|iPod|Android|webOS|BlackBerry|IEMobile|Opera Mini/i.test(
        navigator.userAgent
    );

    // WebGL detection
    const canvas = document.createElement('canvas');
    const gl = canvas.getContext('webgl2') || canvas.getContext('webgl');
    const hasWebGL2 = !!canvas.getContext('webgl2');

    let maxTextureSize = 4096;
    let gpuVendor = 'unknown';
    let gpuRenderer = 'unknown';

    if (gl) {
        maxTextureSize = gl.getParameter(gl.MAX_TEXTURE_SIZE);

        const debugInfo = gl.getExtension('WEBGL_debug_renderer_info');
        if (debugInfo) {
            gpuVendor = gl.getParameter(debugInfo.UNMASKED_VENDOR_WEBGL) || 'unknown';
            gpuRenderer = gl.getParameter(debugInfo.UNMASKED_RENDERER_WEBGL) || 'unknown';
        }
    }

    // Estimate GPU tier based on renderer string
    const estimatedGPUTier = estimateGPUTier(gpuRenderer, gpuVendor);

    // Low-end device heuristics
    const isLowEndDevice =
        cores < 4 ||
        (isMobile && cores < 6) ||
        estimatedGPUTier <= 1 ||
        maxTextureSize < 4096 ||
        !hasWebGL2;

    return {
        cores,
        devicePixelRatio: dpr,
        isMobile,
        isLowEndDevice,
        hasWebGL2,
        maxTextureSize,
        gpuVendor,
        gpuRenderer,
        estimatedGPUTier,
    };
}

function estimateGPUTier(renderer: string, _vendor: string): 0 | 1 | 2 | 3 {
    const r = renderer.toLowerCase();

    // Tier 3: High-end
    if (
        r.includes('rtx') ||
        r.includes('radeon rx 6') ||
        r.includes('radeon rx 7') ||
        r.includes('m1 pro') ||
        r.includes('m1 max') ||
        r.includes('m2') ||
        r.includes('m3') ||
        r.includes('m4') ||
        r.includes('geforce gtx 10') ||
        r.includes('geforce gtx 16') ||
        r.includes('geforce gtx 20') ||
        r.includes('geforce gtx 30') ||
        r.includes('geforce gtx 40')
    ) {
        return 3;
    }

    // Tier 2: Mid-range
    if (
        r.includes('m1') ||
        r.includes('a14') ||
        r.includes('a15') ||
        r.includes('a16') ||
        r.includes('a17') ||
        r.includes('geforce gtx 9') ||
        r.includes('radeon rx 5') ||
        r.includes('iris') ||
        r.includes('uhd graphics 6') ||
        r.includes('uhd graphics 7')
    ) {
        return 2;
    }

    // Tier 1: Low-end
    if (
        r.includes('intel hd') ||
        r.includes('uhd graphics 4') ||
        r.includes('uhd graphics 5') ||
        r.includes('adreno 5') ||
        r.includes('adreno 6') ||
        r.includes('mali-g')
    ) {
        return 1;
    }

    // Tier 0: Very low-end or unknown
    return 0;
}

// ============================================================================
// INITIAL QUALITY SELECTION
// ============================================================================

export function selectInitialQuality(
    capabilities: DeviceCapabilities,
    userPreference?: QualityTier | 'auto'
): QualityTier {
    // User explicit preference
    if (userPreference && userPreference !== 'auto') {
        return userPreference;
    }

    // Auto-selection based on device
    if (capabilities.isLowEndDevice) {
        return capabilities.estimatedGPUTier === 0 ? 'minimal' : 'low';
    }

    if (capabilities.isMobile) {
        return capabilities.estimatedGPUTier >= 2 ? 'medium' : 'low';
    }

    // Desktop
    switch (capabilities.estimatedGPUTier) {
        case 3:
            return 'high'; // Start at high, can go to ultra if FPS is good
        case 2:
            return 'medium';
        case 1:
            return 'low';
        default:
            return 'low';
    }
}

// ============================================================================
// FPS MONITORING HOOK
// ============================================================================

export function useFPSMonitor(targetFPS: number = 60, sampleCount: number = 30) {
    const frameTimesRef = useRef<number[]>([]);
    const lastTimeRef = useRef<number>(performance.now());
    const fpsRef = useRef<number>(60);

    const updateFrame = useCallback(() => {
        const now = performance.now();
        const delta = now - lastTimeRef.current;
        lastTimeRef.current = now;

        frameTimesRef.current.push(delta);
        if (frameTimesRef.current.length > sampleCount) {
            frameTimesRef.current.shift();
        }

        // Calculate rolling average
        const avgFrameTime =
            frameTimesRef.current.reduce((a, b) => a + b, 0) / frameTimesRef.current.length;
        fpsRef.current = 1000 / avgFrameTime;

        return {
            fps: fpsRef.current,
            frameTime: avgFrameTime,
            isUnderBudget: avgFrameTime < 1000 / targetFPS,
            headroom: 1000 / targetFPS - avgFrameTime,
        };
    }, [targetFPS, sampleCount]);

    return { updateFrame, fpsRef, frameTimesRef };
}

// ============================================================================
// ADAPTIVE QUALITY HOOK
// ============================================================================

interface UseAdaptiveQualityOptions {
    targetFPS?: number;
    inclineThreshold?: number; // FPS above this allows quality increase
    declineThreshold?: number; // FPS below this triggers quality decrease
    stabilityWindow?: number; // Frames to wait before adjusting
    maxFlipFlops?: number; // Maximum quality oscillations allowed
    enabled?: boolean;
}

export function useAdaptiveQuality(
    initialQuality: QualityTier | 'auto' = 'auto',
    options: UseAdaptiveQualityOptions = {}
) {
    const {
        targetFPS = 60,
        inclineThreshold = 55, // 55+ fps = can increase quality
        declineThreshold = 45, // Below 45 fps = must decrease quality
        stabilityWindow = 60, // Wait 60 frames (1 second at 60fps)
        maxFlipFlops = 3,
        enabled = true,
    } = options;

    // Device capabilities (computed once)
    const capabilities = useMemo(() => detectDeviceCapabilities(), []);

    // Current quality tier
    const [tier, setTier] = useState<QualityTier>(() =>
        selectInitialQuality(capabilities, initialQuality === 'auto' ? 'auto' : initialQuality)
    );

    // Quality config derived from tier
    const config = useMemo(() => QUALITY_CONFIGS[tier], [tier]);

    // FPS monitoring
    const { updateFrame, fpsRef } = useFPSMonitor(targetFPS);

    // Stability tracking
    const stableFramesRef = useRef(0);
    const flipFlopCountRef = useRef(0);
    const lastDirectionRef = useRef<'up' | 'down' | null>(null);

    // Quality adjustment logic
    const adjustQuality = useCallback(
        (direction: 'up' | 'down') => {
            if (!enabled) return;

            // Check flip-flop protection
            if (lastDirectionRef.current && lastDirectionRef.current !== direction) {
                flipFlopCountRef.current++;
                if (flipFlopCountRef.current >= maxFlipFlops) {
                    console.log('[AdaptiveQuality] Flip-flop limit reached, stabilizing');
                    return;
                }
            }
            lastDirectionRef.current = direction;

            setTier((current) => {
                const currentIndex = TIER_ORDER.indexOf(current);

                if (direction === 'up') {
                    const nextIndex = Math.min(currentIndex + 1, TIER_ORDER.length - 1);
                    const nextTier = TIER_ORDER[nextIndex];
                    console.log(`[AdaptiveQuality] Increasing quality: ${current} → ${nextTier}`);
                    return nextTier;
                } else {
                    const nextIndex = Math.max(currentIndex - 1, 0);
                    const nextTier = TIER_ORDER[nextIndex];
                    console.log(`[AdaptiveQuality] Decreasing quality: ${current} → ${nextTier}`);
                    return nextTier;
                }
            });

            stableFramesRef.current = 0;
        },
        [enabled, maxFlipFlops]
    );

    // Frame update (call this in useFrame)
    const onFrame = useCallback(() => {
        if (!enabled) return;

        const { fps } = updateFrame();

        // Check thresholds
        if (fps >= inclineThreshold) {
            stableFramesRef.current++;
            if (stableFramesRef.current >= stabilityWindow) {
                adjustQuality('up');
            }
        } else if (fps < declineThreshold) {
            // Immediate decrease for performance issues
            adjustQuality('down');
        } else {
            // In acceptable range, reset stability counter
            stableFramesRef.current = Math.max(0, stableFramesRef.current - 1);
        }
    }, [enabled, updateFrame, inclineThreshold, declineThreshold, stabilityWindow, adjustQuality]);

    // Reset flip-flop counter periodically
    useEffect(() => {
        const interval = setInterval(() => {
            flipFlopCountRef.current = Math.max(0, flipFlopCountRef.current - 1);
        }, 10000); // Reduce flip-flop count every 10 seconds

        return () => clearInterval(interval);
    }, []);

    return {
        tier,
        config,
        capabilities,
        onFrame,
        setTier, // Manual override
        getCurrentFPS: () => fpsRef.current,
    };
}

// ============================================================================
// REDUCED MOTION HOOK
// ============================================================================

export function useReducedMotion(): boolean {
    const [prefersReducedMotion, setPrefersReducedMotion] = useState(false);

    useEffect(() => {
        const mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
        setPrefersReducedMotion(mediaQuery.matches);

        const handler = (e: MediaQueryListEvent) => {
            setPrefersReducedMotion(e.matches);
        };

        mediaQuery.addEventListener('change', handler);
        return () => mediaQuery.removeEventListener('change', handler);
    }, []);

    return prefersReducedMotion;
}

// ============================================================================
// BATTERY STATUS HOOK
// ============================================================================

interface BatteryStatus {
    isCharging: boolean;
    level: number;
    isLowPower: boolean;
}

export function useBatteryStatus(): BatteryStatus | null {
    const [status, setStatus] = useState<BatteryStatus | null>(null);

    useEffect(() => {
        // Battery API is not available in all browsers
        if (!('getBattery' in navigator)) {
            return;
        }

        (navigator as any).getBattery().then((battery: any) => {
            const updateStatus = () => {
                setStatus({
                    isCharging: battery.charging,
                    level: battery.level,
                    isLowPower: !battery.charging && battery.level < 0.2,
                });
            };

            updateStatus();
            battery.addEventListener('chargingchange', updateStatus);
            battery.addEventListener('levelchange', updateStatus);

            return () => {
                battery.removeEventListener('chargingchange', updateStatus);
                battery.removeEventListener('levelchange', updateStatus);
            };
        });
    }, []);

    return status;
}

// ============================================================================
// COMBINED QUALITY MANAGER HOOK
// ============================================================================

export function useQualityManager(
    userQualityPreference: QualityTier | 'auto' = 'auto',
    userReducedMotion: boolean = false
) {
    const systemReducedMotion = useReducedMotion();
    const batteryStatus = useBatteryStatus();

    const { tier, capabilities, onFrame, setTier, getCurrentFPS } = useAdaptiveQuality(
        userQualityPreference,
        {
            // Reduce thresholds if on low battery
            declineThreshold: batteryStatus?.isLowPower ? 50 : 45,
            enabled: userQualityPreference === 'auto',
        }
    );

    // Effective reduced motion (user preference OR system preference)
    const effectiveReducedMotion = userReducedMotion || systemReducedMotion;

    // Force low quality if reduced motion is enabled
    const effectiveTier: QualityTier = effectiveReducedMotion ? 'low' : tier;

    // Force lower quality on low battery
    const finalTier: QualityTier =
        batteryStatus?.isLowPower && TIER_ORDER.indexOf(effectiveTier) > 1
            ? 'low'
            : effectiveTier;

    const finalConfig: QualityConfig = {
        ...QUALITY_CONFIGS[finalTier],
        // Disable post-processing if reduced motion
        postProcessing: effectiveReducedMotion
            ? false
            : QUALITY_CONFIGS[finalTier].postProcessing,
    };

    return {
        tier: finalTier,
        config: finalConfig,
        capabilities,
        reducedMotion: effectiveReducedMotion,
        isLowPower: batteryStatus?.isLowPower ?? false,
        onFrame,
        setTier,
        getCurrentFPS,
    };
}
