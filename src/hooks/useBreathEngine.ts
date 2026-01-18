import React, { useEffect, useRef } from 'react';
import { useSessionStore } from '../stores/sessionStore';
import { useSettingsStore } from '../stores/settingsStore';
import { useUIStore } from '../stores/uiStore';
import { RuntimeState } from '../services/RustKernelBridge';
import { useCameraVitals } from './useCameraVitals';
import { useKernel } from '../kernel/KernelProvider';
import { SafetyConfig } from '../config/SafetyConfig';
import { ZenVitalsSnapshot } from '../vitals/snapshot';

type EngineRefs = {
    progressRef: React.MutableRefObject<number>;
    entropyRef: React.MutableRefObject<number>;
};

/**
 * 🜂 DRIVER (View-Controller Bridge) V5.5 (Quality Gated)
 */
export function useBreathEngine(): EngineRefs {
    const isActive = useSessionStore((s) => s.isActive);
    const isPaused = useSessionStore((s) => s.isPaused);
    const currentPattern = useSessionStore((s) => s.currentPattern);
    const stopSession = useSessionStore((s) => s.stopSession);
    const syncState = useSessionStore((s) => s.syncState);
    const setCameraError = useSessionStore((s) => s.setCameraError);

    const storeUserSettings = useSettingsStore((s) => s.userSettings);

    // Visual Interpolation Refs
    const progressRef = useRef<number>(0);
    const entropyRef = useRef<number>(0);
    const phaseEpochPerfMsRef = useRef<number>(0);
    const phaseDurationSecRef = useRef<number>(1);

    // Inject Kernel
    const kernel = useKernel();

    // --- SENSOR DRIVER: CAMERA VITALS ---
    const { vitals, error: cameraError } = useCameraVitals(isActive && storeUserSettings.cameraVitalsEnabled);
    const vitalsRef = useRef<ZenVitalsSnapshot | null>(null);

    useEffect(() => {
        vitalsRef.current = vitals;
    }, [vitals]);

    useEffect(() => {
        setCameraError(cameraError);
    }, [cameraError, setCameraError]);

    // --- KERNEL CONTROL BUS ---

    // 1. Handle START / STOP
    useEffect(() => {
        if (isActive) {
            kernel.dispatch({ type: 'LOAD_PROTOCOL', patternId: currentPattern.id, timestamp: Date.now() });
            kernel.dispatch({ type: 'START_SESSION', timestamp: Date.now() });
        } else {
            progressRef.current = 0;
            phaseEpochPerfMsRef.current = 0;
            phaseDurationSecRef.current = 1;
            kernel.dispatch({ type: 'HALT', reason: 'cleanup', timestamp: Date.now() });
        }
    }, [isActive, currentPattern.id, kernel]);

    // 2. Handle PAUSE / RESUME
    useEffect(() => {
        if (!isActive) return;
        if (isPaused) {
            kernel.dispatch({ type: 'INTERRUPTION', kind: 'pause', timestamp: Date.now() });
        } else {
            kernel.dispatch({ type: 'RESUME', timestamp: Date.now() });
        }
    }, [isPaused, isActive, kernel]);

    // --- KERNEL OBSERVER (Visuals & React State) ---
    useEffect(() => {
        const showSnackbar = useUIStore.getState().showSnackbar;
        let lastStatus: RuntimeState['status'] | null = null;

        const unsub = kernel.subscribe((state: RuntimeState) => {
            // Safety Monitor
            if (state.status === 'SAFETY_LOCK' && lastStatus !== 'SAFETY_LOCK') {
                showSnackbar('Safety lock engaged. Session stopped.', 'error');
                stopSession();
            }
            lastStatus = state.status;

            // Visual Cortex Driver
            const duration = state.phaseDuration || 1;
            progressRef.current = state.phaseElapsed / duration;
            phaseDurationSecRef.current = duration;
            // Convert discrete kernel updates into smooth visual progress.
            // (Kernel ticks at SafetyConfig.clocks.controlHz, but visuals should be display-rate smooth.)
            phaseEpochPerfMsRef.current = performance.now() - (state.phaseElapsed * 1000);
            entropyRef.current = state.belief.prediction_error;

            // UI State Sync
            if (state.phase !== useSessionStore.getState().phase || state.cycleCount !== useSessionStore.getState().cycleCount) {
                syncState(state.phase, state.cycleCount);
            }
        });
        return unsub;
    }, [stopSession, syncState, kernel]);

    // --- CLOCK DRIVER (Fixed Timestep Tick Loop) ---
    useEffect(() => {
        if (!isActive) return;

        let lastTime = performance.now();
        let frameId: number;
        let accumulator = 0;

        const TARGET_HZ = SafetyConfig.clocks.controlHz;
        const STEP_SEC = 1 / TARGET_HZ;
        const MAX_STEPS = SafetyConfig.clocks.maxControlStepsPerFrame;

        const tickLoop = (now: number) => {
            if (isPaused) {
                // Freeze progress while paused by shifting the epoch forward by the paused wall-time.
                if (phaseEpochPerfMsRef.current) {
                    phaseEpochPerfMsRef.current += (now - lastTime);
                }
                lastTime = now;
                frameId = requestAnimationFrame(tickLoop);
                return;
            }

            // Smooth visual progress at display rate (independent of controlHz).
            if (phaseEpochPerfMsRef.current) {
                const duration = phaseDurationSecRef.current || 1;
                const elapsedSec = (now - phaseEpochPerfMsRef.current) / 1000;
                const p = elapsedSec / duration;
                progressRef.current = Math.max(0, Math.min(1, p));
            }

            const dt = Math.min((now - lastTime) / 1000, SafetyConfig.clocks.maxFrameDtSec);
            lastTime = now;
            accumulator += dt;

            let steps = 0;
            while (accumulator >= STEP_SEC && steps < MAX_STEPS) {

                // Gated Injection: Only inject if quality is NOT invalid
                // and individual metric has a value (passed insufficient window check)
                let tickData: any = {
                    timestamp: Date.now(),
                    delta_time: STEP_SEC,
                    visibilty_state: document.hidden ? 'hidden' : 'visible',
                    user_interaction: undefined
                };

                const latestVitals = vitalsRef.current;
                if (latestVitals && latestVitals.quality.quality !== 'invalid') {
                    if (latestVitals.hr.value !== undefined) {
                        tickData.heart_rate = latestVitals.hr.value;
                        tickData.hr_confidence = latestVitals.hr.confidence;
                    }
                    if (latestVitals.rr.value !== undefined) {
                        tickData.respiration_rate = latestVitals.rr.value;
                    }
                    if (latestVitals.hrv.value !== undefined) {
                        tickData.stress_index = latestVitals.hrv.value.stressIndex;
                    }
                    if (latestVitals.affect.value !== undefined) {
                        tickData.facial_valence = latestVitals.affect.value.valence;
                    }
                }

                kernel.tick(STEP_SEC, tickData);
                accumulator -= STEP_SEC;
                steps++;
            }

            frameId = requestAnimationFrame(tickLoop);
        };

        frameId = requestAnimationFrame(tickLoop);
        return () => cancelAnimationFrame(frameId);
    }, [isActive, isPaused, kernel]);

    const stableRefs = useRef<EngineRefs | null>(null);
    if (!stableRefs.current) stableRefs.current = { progressRef, entropyRef };
    return stableRefs.current;
}
