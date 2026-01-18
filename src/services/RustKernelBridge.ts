/**
 * RUST KERNEL BRIDGE
 * ==================
 * 
 * This module bridges the AGOLOS Rust core (via UniFFI) to the TypeScript UI layer.
 * It provides a compatible interface with PureZenBKernel while delegating all
 * core logic to the Rust implementation.
 * 
 * NOTE: During development, this uses a mock implementation until UniFFI bindings
 * are generated and linked. The mock maintains API compatibility.
 */

console.log('[ZenB] Module: RustKernelBridge.ts loading...');

import {
    BreathPattern,
    BreathPhase,
    KernelEvent,
    BeliefState,
    Observation,
    SafetyProfile,
    BreathingType,
    BREATHING_PATTERNS
} from '../types';

// Advanced services
import { SafetyMonitor } from './SafetyMonitor';
import { UKFStateEstimator } from './UKFStateEstimator';

// Tauri integration
import { initTauriInvoke, isTauriAvailable, getTauriRuntime, TauriZenOneRuntime } from './TauriRuntime';

// ============================================================================
// FFI TYPE DEFINITIONS (matches rust-core/src/zenone.udl)
// ============================================================================

export type FfiPhase = 'Inhale' | 'HoldIn' | 'Exhale' | 'HoldOut';
export type FfiBeliefMode = 'Calm' | 'Stress' | 'Focus' | 'Sleepy' | 'Energize';
export type FfiRuntimeStatus = 'Idle' | 'Running' | 'Paused' | 'SafetyLock';

export interface FfiBeliefState {
    probabilities: number[];  // [Calm, Stress, Focus, Sleepy, Energize]
    confidence: number;
    mode: FfiBeliefMode;
    uncertainty: number;
}

export interface FfiResonance {
    coherence_score: number;
    phase_locking: number;
    rhythm_alignment: number;
}

export interface FfiSafetyStatus {
    is_locked: boolean;
    trauma_count: number;
    tempo_bounds: number[];
    hr_bounds: number[];
}

export interface FfiFrame {
    phase: FfiPhase;
    phase_progress: number;
    cycles_completed: number;
    heart_rate: number | null;
    signal_quality: number;
    belief: FfiBeliefState;
    resonance: FfiResonance;
}

export interface FfiSessionStats {
    duration_sec: number;
    cycles_completed: number;
    pattern_id: string;
    avg_heart_rate: number | null;
    final_belief: FfiBeliefState;
    avg_resonance: number;
}

export interface FfiRuntimeState {
    status: FfiRuntimeStatus;
    pattern_id: string;
    phase: FfiPhase;
    phase_progress: number;
    cycles_completed: number;
    session_duration_sec: number;
    tempo_scale: number;
    belief: FfiBeliefState;
    resonance: FfiResonance;
    safety: FfiSafetyStatus;
}

// ============================================================================
// TYPE CONVERSION UTILITIES
// ============================================================================

function ffiPhaseToBreathPhase(phase: FfiPhase): BreathPhase {
    const map: Record<FfiPhase, BreathPhase> = {
        'Inhale': 'inhale',
        'HoldIn': 'holdIn',
        'Exhale': 'exhale',
        'HoldOut': 'holdOut'
    };
    return map[phase];
}

// Note: breathPhaseToFfiPhase removed - unused

/**
 * Convert FFI 5-mode belief to TypeScript BeliefState
 * Maps probabilistic modes to continuous dimensions
 */
function ffiBeliefToBeliefState(ffi: FfiBeliefState, resonance: FfiResonance): BeliefState {
    const [calm, stress, focus, sleepy, energize] = ffi.probabilities;

    // Map mode probabilities to continuous state dimensions
    // Arousal: stress + energize (high activation) - calm - sleepy (low activation)
    const arousal = Math.max(0, Math.min(1, 0.5 + (stress + energize - calm - sleepy) * 0.5));

    // Attention: focus + stress (attentive states)
    const attention = Math.max(0, Math.min(1, focus + stress * 0.5));

    // Valence: calm + energize (positive) - stress (negative)
    const valence = (calm + energize * 0.5 - stress) * 2;

    return {
        arousal,
        attention,
        rhythm_alignment: resonance.rhythm_alignment,
        valence: Math.max(-1, Math.min(1, valence)),
        arousal_variance: ffi.uncertainty * 0.3,
        attention_variance: ffi.uncertainty * 0.3,
        rhythm_variance: 1 - resonance.coherence_score,
        prediction_error: ffi.uncertainty,
        innovation: 0,
        mahalanobis_distance: 0,
        confidence: ffi.confidence
    };
}

// ============================================================================
// RUNTIME STATE (TypeScript equivalent of RuntimeState)
// ============================================================================

export type RuntimeStatus = 'IDLE' | 'RUNNING' | 'PAUSED' | 'HALTED' | 'SAFETY_LOCK';
export type AIConnectionStatus = 'connecting' | 'connected' | 'thinking' | 'speaking' | 'disconnected';

export interface RuntimeState {
    readonly version: number;
    readonly status: RuntimeStatus;
    readonly bootTimestamp: number;
    readonly lastUpdateTimestamp: number;

    // Protocol
    readonly pattern: BreathPattern | null;
    readonly tempoScale: number;

    // Phase Machine
    readonly phase: BreathPhase;
    readonly phaseStartTime: number;
    readonly phaseDuration: number;
    readonly cycleCount: number;
    readonly sessionStartTime: number;

    // Belief State
    readonly belief: BeliefState;

    // Safety Registry
    readonly safetyRegistry: Readonly<Record<string, SafetyProfile>>;

    // UI Cache
    readonly phaseElapsed: number;
    readonly sessionDuration: number;
    readonly lastObservation: Observation | null;

    // AI Context
    readonly aiActive: boolean;
    readonly aiStatus: AIConnectionStatus;
    readonly lastAiMessage: string | null;

    // Analysis
    readonly startBelief: BeliefState | null;
}

// ============================================================================
// MOCK FFI RUNTIME (for development/fallback)
// ============================================================================

class MockZenOneRuntime {
    private currentPatternId: string = '4-7-8';
    private sessionActive: boolean = false;
    private status: FfiRuntimeStatus = 'Idle';
    private phase: FfiPhase = 'Inhale';
    private phaseProgress: number = 0;
    private cyclesCompleted: number = 0;
    private tempoScale: number = 1.0;
    private safetyLocked: boolean = false;
    private sessionDurationSec: number = 0;
    private lastBelief: FfiBeliefState = {
        probabilities: [0.4, 0.1, 0.2, 0.2, 0.1],
        confidence: 0.5,
        mode: 'Calm',
        uncertainty: 0.5
    };
    private lastResonance: FfiResonance = {
        coherence_score: 0.5,
        phase_locking: 0.5,
        rhythm_alignment: 0.5
    };

    get_patterns(): any[] {
        return Object.values(BREATHING_PATTERNS).map(p => ({
            id: p.id,
            label: p.label,
            tag: p.tag,
            description: p.description,
            inhale_sec: p.timings.inhale,
            hold_in_sec: p.timings.holdIn,
            exhale_sec: p.timings.exhale,
            hold_out_sec: p.timings.holdOut,
            recommended_cycles: p.recommendedCycles,
            arousal_impact: p.arousalImpact
        }));
    }

    load_pattern(patternId: string): boolean {
        if (patternId in BREATHING_PATTERNS) {
            this.currentPatternId = patternId;
            return true;
        }
        return false;
    }

    current_pattern_id(): string {
        return this.currentPatternId;
    }

    start_session(): void {
        if (this.safetyLocked) {
            throw new Error('Cannot start session while safety locked');
        }
        this.sessionActive = true;
        this.status = 'Running';
        this.sessionDurationSec = 0;
        this.cyclesCompleted = 0;
        this.phaseProgress = 0;
        this.phase = 'Inhale';
    }

    stop_session(): FfiSessionStats {
        this.sessionActive = false;
        if (!this.safetyLocked) {
            this.status = 'Idle';
        }
        return {
            duration_sec: this.sessionDurationSec,
            cycles_completed: this.cyclesCompleted,
            pattern_id: this.currentPatternId,
            avg_heart_rate: null,
            final_belief: this.lastBelief,
            avg_resonance: this.lastResonance.coherence_score
        };
    }

    is_session_active(): boolean {
        return this.sessionActive;
    }

    pause_session(): void {
        if (this.status === 'Running') {
            this.status = 'Paused';
        }
    }

    resume_session(): void {
        if (this.status === 'Paused') {
            this.status = 'Running';
        }
    }

    process_frame(_r: number, _g: number, _b: number, _timestamp_us: number): FfiFrame {
        return this.tick(0.033, Date.now() * 1000);
    }

    tick(dt_sec: number, _timestamp_us: number): FfiFrame {
        if (this.status === 'Running') {
            this.sessionDurationSec += dt_sec;
            const pattern = BREATHING_PATTERNS[this.currentPatternId as BreathingType];
            if (pattern) {
                const phaseDuration = pattern.timings[ffiPhaseToBreathPhase(this.phase)];
                this.phaseProgress += dt_sec / phaseDuration;

                if (this.phaseProgress >= 1) {
                    this.phaseProgress = 0;
                    const phases: FfiPhase[] = ['Inhale', 'HoldIn', 'Exhale', 'HoldOut'];
                    const idx = phases.indexOf(this.phase);
                    let nextIdx = (idx + 1) % 4;

                    // Skip phases with 0 duration
                    while (pattern.timings[ffiPhaseToBreathPhase(phases[nextIdx])] === 0) {
                        nextIdx = (nextIdx + 1) % 4;
                    }

                    this.phase = phases[nextIdx];
                    if (this.phase === 'Inhale') {
                        this.cyclesCompleted++;
                    }
                }
            }

            // Simulate belief improvement
            this.lastBelief.probabilities[0] = Math.min(0.7, this.lastBelief.probabilities[0] + dt_sec * 0.01);
            this.lastBelief.confidence = Math.min(0.9, this.lastBelief.confidence + dt_sec * 0.02);
            this.lastResonance.coherence_score = Math.min(0.9, this.lastResonance.coherence_score + dt_sec * 0.01);
        }

        return {
            phase: this.phase,
            phase_progress: this.phaseProgress,
            cycles_completed: this.cyclesCompleted,
            heart_rate: null,
            signal_quality: 0,
            belief: this.lastBelief,
            resonance: this.lastResonance
        };
    }

    get_state(): FfiRuntimeState {
        return {
            status: this.status,
            pattern_id: this.currentPatternId,
            phase: this.phase,
            phase_progress: this.phaseProgress,
            cycles_completed: this.cyclesCompleted,
            session_duration_sec: this.sessionActive ? this.sessionDurationSec : 0,
            tempo_scale: this.tempoScale,
            belief: this.lastBelief,
            resonance: this.lastResonance,
            safety: {
                is_locked: this.safetyLocked,
                trauma_count: 0,
                tempo_bounds: [0.8, 1.4],
                hr_bounds: [30, 220]
            }
        };
    }

    get_belief(): FfiBeliefState {
        return this.lastBelief;
    }

    get_safety_status(): FfiSafetyStatus {
        return {
            is_locked: this.safetyLocked,
            trauma_count: 0,
            tempo_bounds: [0.8, 1.4],
            hr_bounds: [30, 220]
        };
    }

    adjust_tempo(scale: number, _reason: string): number {
        this.tempoScale = Math.max(0.8, Math.min(1.4, scale));
        return this.tempoScale;
    }

    update_context(_local_hour: number, _is_charging: boolean, _recent_sessions: number): void {
        // Context update placeholder
    }

    emergency_halt(_reason: string): void {
        this.status = 'SafetyLock';
        this.safetyLocked = true;
        this.sessionActive = false;
    }

    reset_safety_lock(): void {
        this.safetyLocked = false;
        this.status = 'Idle';
    }
}

// ============================================================================
// RUST KERNEL BRIDGE (Main Export)
// ============================================================================

export type Middleware = (
    event: KernelEvent,
    before: RuntimeState,
    after: RuntimeState,
    api: { queue: (cmd: KernelEvent) => void }
) => void;

export class RustKernelBridge {
    private runtime: MockZenOneRuntime;
    private tauriRuntime: TauriZenOneRuntime | null = null;
    private useTauri: boolean = false;
    private state: RuntimeState;
    private subscribers = new Set<(state: RuntimeState) => void>();
    private middlewares: Middleware[] = [];
    private safetyRegistry: Record<string, SafetyProfile> = {};
    private eventLog: KernelEvent[] = [];
    private readonly MAX_LOG_SIZE = 1000;

    // Advanced services
    private safetyMonitor = new SafetyMonitor();
    private ukf = new UKFStateEstimator();
    private useUKF = true; // Use UKF for belief state estimation

    constructor() {
        // Initialize mock runtime (always available as fallback)
        this.runtime = new MockZenOneRuntime();
        this.state = this.buildState();

        // Try to initialize Tauri runtime
        this.initTauri();

        // Log boot event
        this.logEvent({ type: 'BOOT', timestamp: Date.now() });
    }

    /**
     * Initialize Tauri runtime asynchronously
     */
    private async initTauri(): Promise<void> {
        try {
            const available = await initTauriInvoke();
            if (available) {
                this.tauriRuntime = getTauriRuntime();
                this.useTauri = true;
                console.log('[RustKernelBridge] Tauri runtime enabled - using native Rust kernel');
                // Sync initial state from Rust
                const rustState = await this.tauriRuntime.get_state();
                this.state = this.buildStateFromRust(rustState);
                this.notify();
            } else {
                console.log('[RustKernelBridge] Tauri not available - using mock runtime');
            }
        } catch (e) {
            console.warn('[RustKernelBridge] Tauri init failed, using mock:', e);
        }
    }

    // =========================================================================
    // PUBLIC API (Compatible with PureZenBKernel interface)
    // =========================================================================

    dispatch(event: KernelEvent): void {
        const beforeState = this.state;

        // SAFETY CHECK: Verify event is safe before processing
        const safetyCheck = this.safetyMonitor.checkEvent(event, this.state);
        if (!safetyCheck.safe) {
            if (safetyCheck.correctedEvent) {
                // Use the shielded/corrected event instead
                console.warn('[RustKernelBridge] Using shielded event:', safetyCheck.correctedEvent);
                event = safetyCheck.correctedEvent;
            } else {
                // Cannot shield, must reject
                console.error('[RustKernelBridge] Event rejected by SafetyMonitor:', event);
                return;
            }
        }

        switch (event.type) {
            case 'BOOT':
                // Already booted via constructor
                break;

            case 'LOAD_PROTOCOL':
                this.runtime.load_pattern(event.patternId);
                break;

            case 'START_SESSION':
                try {
                    this.runtime.start_session();
                } catch (e) {
                    console.warn('[RustKernelBridge] Failed to start session:', e);
                }
                break;

            case 'HALT':
                this.runtime.stop_session();
                break;

            case 'INTERRUPTION':
                if (event.kind === 'pause') {
                    this.runtime.pause_session();
                }
                break;

            case 'RESUME':
                this.runtime.resume_session();
                break;

            case 'ADJUST_TEMPO':
                this.runtime.adjust_tempo(event.scale, event.reason);
                break;

            case 'SAFETY_INTERDICTION':
                if (event.action === 'EMERGENCY_HALT') {
                    this.runtime.emergency_halt(event.action);
                }
                break;

            case 'LOAD_SAFETY_REGISTRY':
                this.safetyRegistry = event.registry;
                break;

            // AI events handled at UI layer
            case 'AI_STATUS_CHANGE':
            case 'AI_VOICE_MESSAGE':
            case 'AI_INTERVENTION':
                // These are handled in state update
                break;

            default:
                // TICK, BELIEF_UPDATE, etc. handled via tick()
                break;
        }

        // Log the event
        this.logEvent(event);

        // Update state
        this.state = this.buildState(beforeState, event);

        // Run middlewares
        const api = { queue: (cmd: KernelEvent) => this.dispatch(cmd) };
        this.middlewares.forEach(mw => mw(event, beforeState, this.state, api));

        // Notify subscribers
        this.notify();
    }

    tick(dt: number, observation: Observation): void {
        const frame = this.runtime.tick(dt, observation.timestamp * 1000);

        // Convert frame to state update
        const beforeState = this.state;
        const sessionDuration = beforeState.status === 'RUNNING'
            ? beforeState.sessionDuration + dt
            : beforeState.sessionDuration;

        // Use UKF for belief state estimation if enabled
        let belief: BeliefState;
        if (this.useUKF && this.state.status === 'RUNNING') {
            // Update UKF with observation
            belief = this.ukf.update(observation, dt);
        } else {
            // Fallback to FFI belief conversion
            belief = ffiBeliefToBeliefState(frame.belief, frame.resonance);
        }

        this.state = {
            ...this.state,
            phase: ffiPhaseToBreathPhase(frame.phase),
            phaseElapsed: frame.phase_progress * this.getPhaseDuration(ffiPhaseToBreathPhase(frame.phase)),
            cycleCount: frame.cycles_completed,
            belief,
            lastObservation: observation,
            lastUpdateTimestamp: Date.now(),
            sessionDuration
        };

        // Run middlewares
        const event: KernelEvent = { type: 'TICK', dt, observation, timestamp: Date.now() };
        const api = { queue: (cmd: KernelEvent) => this.dispatch(cmd) };
        this.middlewares.forEach(mw => mw(event, beforeState, this.state, api));

        this.notify();
    }

    getState(): RuntimeState {
        return this.state;
    }

    subscribe(callback: (state: RuntimeState) => void): () => void {
        this.subscribers.add(callback);
        callback(this.state);
        return () => { this.subscribers.delete(callback); };
    }

    use(middleware: Middleware): void {
        this.middlewares.push(middleware);
    }

    loadSafetyRegistry(registry: Record<string, SafetyProfile>): void {
        this.dispatch({ type: 'LOAD_SAFETY_REGISTRY', registry, timestamp: Date.now() });
    }

    updateSafetyProfile(patternId: string, profile: SafetyProfile): void {
        const newRegistry = { ...this.safetyRegistry, [patternId]: profile };
        this.loadSafetyRegistry(newRegistry);
    }

    getLogBuffer(): KernelEvent[] {
        return [...this.eventLog];
    }

    private logEvent(event: KernelEvent): void {
        this.eventLog.push(event);
        // Trim to MAX_LOG_SIZE
        if (this.eventLog.length > this.MAX_LOG_SIZE) {
            this.eventLog = this.eventLog.slice(-this.MAX_LOG_SIZE);
        }
    }

    // =========================================================================
    // PRIVATE HELPERS
    // =========================================================================

    private buildState(prev?: RuntimeState, event?: KernelEvent): RuntimeState {
        const ffiState = this.runtime.get_state();
        const pattern = BREATHING_PATTERNS[ffiState.pattern_id as BreathingType] || null;

        const statusMap: Record<FfiRuntimeStatus, RuntimeStatus> = {
            'Idle': 'IDLE',
            'Running': 'RUNNING',
            'Paused': 'PAUSED',
            'SafetyLock': 'SAFETY_LOCK'
        };

        const now = Date.now();
        const belief = ffiBeliefToBeliefState(ffiState.belief, ffiState.resonance);

        // Handle AI events at the state level
        let aiStatus = prev?.aiStatus || 'disconnected';
        let aiActive = prev?.aiActive || false;
        let lastAiMessage = prev?.lastAiMessage || null;

        if (event?.type === 'AI_STATUS_CHANGE') {
            aiStatus = event.status;
            aiActive = event.status !== 'disconnected';
        } else if (event?.type === 'AI_VOICE_MESSAGE') {
            lastAiMessage = event.text;
            aiStatus = 'speaking';
        }

        return {
            version: 7.0,
            status: statusMap[ffiState.status],
            bootTimestamp: prev?.bootTimestamp || now,
            lastUpdateTimestamp: now,
            pattern,
            tempoScale: ffiState.tempo_scale,
            phase: ffiPhaseToBreathPhase(ffiState.phase),
            phaseStartTime: prev?.phaseStartTime || now,
            phaseDuration: pattern ? pattern.timings[ffiPhaseToBreathPhase(ffiState.phase)] : 0,
            cycleCount: ffiState.cycles_completed,
            sessionStartTime: (ffiState.status === 'Running' || ffiState.status === 'Paused') ? (prev?.sessionStartTime || now) : 0,
            belief,
            safetyRegistry: this.safetyRegistry,
            phaseElapsed: ffiState.phase_progress * (pattern ? pattern.timings[ffiPhaseToBreathPhase(ffiState.phase)] : 1),
            sessionDuration: ffiState.session_duration_sec,
            lastObservation: prev?.lastObservation || null,
            aiActive,
            aiStatus,
            lastAiMessage,
            startBelief: ffiState.status === 'Running' && !prev?.startBelief ? belief : (prev?.startBelief || null)
        };
    }

    /**
     * Build RuntimeState from Rust FfiRuntimeState
     * Used when Tauri runtime is active
     */
    private buildStateFromRust(ffiState: FfiRuntimeState): RuntimeState {
        const pattern = BREATHING_PATTERNS[ffiState.pattern_id as BreathingType] || null;

        const statusMap: Record<FfiRuntimeStatus, RuntimeStatus> = {
            'Idle': 'IDLE',
            'Running': 'RUNNING',
            'Paused': 'PAUSED',
            'SafetyLock': 'SAFETY_LOCK'
        };

        const now = Date.now();
        const belief = ffiBeliefToBeliefState(ffiState.belief, ffiState.resonance);

        return {
            version: 7.0,
            status: statusMap[ffiState.status],
            bootTimestamp: this.state?.bootTimestamp || now,
            lastUpdateTimestamp: now,
            pattern,
            tempoScale: ffiState.tempo_scale,
            phase: ffiPhaseToBreathPhase(ffiState.phase),
            phaseStartTime: this.state?.phaseStartTime || now,
            phaseDuration: pattern ? pattern.timings[ffiPhaseToBreathPhase(ffiState.phase)] : 0,
            cycleCount: ffiState.cycles_completed,
            sessionStartTime: (ffiState.status === 'Running' || ffiState.status === 'Paused')
                ? (this.state?.sessionStartTime || now)
                : 0,
            belief,
            safetyRegistry: this.safetyRegistry,
            phaseElapsed: ffiState.phase_progress * (pattern ? pattern.timings[ffiPhaseToBreathPhase(ffiState.phase)] : 1),
            sessionDuration: ffiState.session_duration_sec,
            lastObservation: this.state?.lastObservation || null,
            aiActive: this.state?.aiActive || false,
            aiStatus: this.state?.aiStatus || 'disconnected',
            lastAiMessage: this.state?.lastAiMessage || null,
            startBelief: ffiState.status === 'Running' && !this.state?.startBelief ? belief : (this.state?.startBelief || null)
        };
    }

    private getPhaseDuration(phase: BreathPhase): number {
        const pattern = this.state.pattern;
        return pattern ? pattern.timings[phase] : 1;
    }

    private notify(): void {
        this.subscribers.forEach(cb => {
            try { cb(this.state); } catch (e) { console.error('Subscriber error', e); }
        });
    }
}

// Re-export for compatibility
export { RustKernelBridge as PureZenBKernel };
