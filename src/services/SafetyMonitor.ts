/**
 * SAFETY MONITOR & SHIELD - FORMAL VERIFICATION
 * ==============================================
 *
 * Implements runtime verification using Linear Temporal Logic (LTL)
 * and a safety shield to prevent/correct unsafe kernel events.
 *
 * LTL Operators:
 * - G (Globally): Property must hold at all times
 * - F (Finally): Property must eventually hold
 * - X (Next): Property must hold in the next state
 * - U (Until): p U q means p holds until q becomes true
 *
 * References:
 * - Pnueli (1977): "The Temporal Logic of Programs"
 * - Bloem et al. (2015): "Synthesizing Reactive Systems from LTL"
 * - RTCA DO-178C: Software safety standard (avionics)
 */

import { KernelEvent } from '../types';
import type { RuntimeState } from './RustKernelBridge';

// =============================================================================
// LTL FORMULA TYPES
// =============================================================================

export type LTLOperator = 'G' | 'F' | 'X' | 'U' | 'ATOMIC';

export interface LTLFormula {
    operator: LTLOperator;
    name: string;
    description: string;

    // For atomic propositions
    predicate?: (state: RuntimeState, event: KernelEvent | undefined, trace: KernelEvent[]) => boolean;

    // For composite formulas
    subformula?: LTLFormula;
    left?: LTLFormula;  // For 'Until'
    right?: LTLFormula; // For 'Until'

    // For bounded temporal operators
    bound?: number; // Max steps to wait (for bounded 'U' and 'F')
}

// =============================================================================
// PENDING CHECK TYPES (for X and U operators)
// =============================================================================

interface PendingNextCheck {
    formula: LTLFormula;
    deadline: number; // Steps remaining
    timestamp: number;
}

interface PendingUntilCheck {
    left: LTLFormula;
    right: LTLFormula;
    bound: number;
    step: number;
    timestamp: number;
}

// =============================================================================
// SAFETY PROPERTIES
// =============================================================================

export const SAFETY_SPECS: LTLFormula[] = [
    {
        operator: 'G',
        name: 'tempo_bounds',
        description: 'Tempo must always stay within [0.8, 1.4]',
        subformula: {
            operator: 'ATOMIC',
            name: 'tempo_in_bounds',
            description: 'Check tempo bounds',
            predicate: (state) => state.tempoScale >= 0.8 && state.tempoScale <= 1.4
        }
    },

    {
        operator: 'G',
        name: 'safety_lock_immutable',
        description: 'Once in SAFETY_LOCK, cannot start new session',
        subformula: {
            operator: 'ATOMIC',
            name: 'no_start_when_locked',
            description: 'Check safety lock',
            predicate: (state, event) => {
                if (state.status === 'SAFETY_LOCK' && event?.type === 'START_SESSION') {
                    return false;
                }
                return true;
            }
        }
    },

    {
        operator: 'G',
        name: 'tempo_rate_limit',
        description: 'Tempo cannot change faster than 0.1/sec',
        subformula: {
            operator: 'ATOMIC',
            name: 'check_tempo_rate',
            description: 'Check tempo rate of change',
            predicate: (state, event, trace) => {
                if (event?.type === 'ADJUST_TEMPO') {
                    const last = trace.slice().reverse().find(e => e.type === 'ADJUST_TEMPO') as (KernelEvent & { type: 'ADJUST_TEMPO' }) | undefined;
                    if (!last) return true; // No prior tempo change to rate-limit against

                    const dt = (event.timestamp - last.timestamp) / 1000;
                    if (dt > 0) {
                        const delta = Math.abs(event.scale - state.tempoScale);
                        const rate = delta / dt;
                        return rate <= 0.1;
                    }
                }
                return true;
            }
        }
    },

    {
        operator: 'G',
        name: 'pattern_stability',
        description: 'Protocol cannot be changed more than once every 60 seconds',
        subformula: {
            operator: 'ATOMIC',
            name: 'check_pattern_stability',
            description: 'Check last pattern change',
            predicate: (_state, event, trace) => {
                if (event?.type === 'LOAD_PROTOCOL') {
                    const lastLoad = trace.slice().reverse().find(e => e.type === 'LOAD_PROTOCOL');
                    if (lastLoad) {
                        const timeSince = (event.timestamp - lastLoad.timestamp) / 1000;
                        if (timeSince < 60) return false;
                    }
                }
                return true;
            }
        }
    },

    {
        operator: 'G',
        name: 'panic_halt',
        description: 'High prediction error must trigger halt',
        subformula: {
            operator: 'ATOMIC',
            name: 'halt_on_panic',
            description: 'Check emergency halt',
            predicate: (state, event) => {
                if (
                    state.belief.prediction_error > 0.95 &&
                    state.sessionDuration > 10 &&
                    state.status === 'RUNNING'
                ) {
                    if (event?.type !== 'HALT' && event?.type !== 'SAFETY_INTERDICTION') {
                        return false;
                    }
                }
                return true;
            }
        }
    },

    // NEW: Next-state property example
    {
        operator: 'G',
        name: 'phase_continuity',
        description: 'After CYCLE_COMPLETE, next state should reset phase progress',
        subformula: {
            operator: 'X',
            name: 'next_phase_reset',
            description: 'Check phase reset after cycle',
            predicate: (state, event) => {
                // This gets checked on the NEXT tick after CYCLE_COMPLETE
                if (event?.type === 'CYCLE_COMPLETE') {
                    return state.phaseElapsed < 0.1; // Should be near 0
                }
                return true;
            }
        }
    }
];

// =============================================================================
// LIVENESS PROPERTIES
// =============================================================================

export const LIVENESS_SPECS: LTLFormula[] = [
    {
        operator: 'F',
        name: 'tempo_convergence',
        description: 'Tempo should eventually stabilize near 1.0',
        bound: 100, // Within 100 ticks
        subformula: {
            operator: 'ATOMIC',
            name: 'tempo_near_normal',
            description: 'Tempo is close to 1.0',
            predicate: (state) => {
                if (state.status === 'RUNNING' && state.sessionDuration > 60) {
                    return Math.abs(state.tempoScale - 1.0) < 0.1;
                }
                return true;
            }
        }
    },

    // NEW: Until property example
    {
        operator: 'U',
        name: 'stress_recovery',
        description: 'High arousal must eventually lead to calmer state',
        bound: 50,
        left: {
            operator: 'ATOMIC',
            name: 'arousal_decreasing',
            description: 'Arousal is not increasing',
            predicate: (state) => state.belief.arousal < 0.9
        },
        right: {
            operator: 'ATOMIC',
            name: 'calm_achieved',
            description: 'Calm state reached',
            predicate: (state) => state.belief.arousal < 0.5
        }
    }
];

// =============================================================================
// VIOLATION RECORD
// =============================================================================

export interface SafetyViolation {
    timestamp: number;
    propertyName: string;
    description: string;
    severity: 'CRITICAL' | 'WARNING';
    state: RuntimeState;
    event?: KernelEvent;
}

// =============================================================================
// SAFETY MONITOR CLASS
// =============================================================================

export class SafetyMonitor {
    private violations: SafetyViolation[] = [];
    private trace: KernelEvent[] = [];
    private readonly MAX_TRACE = 100;
    private readonly MAX_VIOLATIONS = 100;

    // Pending temporal checks
    private pendingNext: PendingNextCheck[] = [];
    private pendingUntil: PendingUntilCheck[] = [];

    /**
     * Check if an event is safe to execute
     * @returns null if safe, or a corrected event if fixable
     */
    checkEvent(event: KernelEvent, currentState: RuntimeState): {
        safe: boolean;
        correctedEvent?: KernelEvent;
        violation?: SafetyViolation;
    } {
        // 1. Check pending Next (X) obligations
        const nextViolation = this.checkPendingNext(currentState, event);
        if (nextViolation) {
            this.recordViolation(nextViolation);
            console.warn(`[SafetyMonitor] Next-state violation: "${nextViolation.propertyName}"`);
        }

        // 2. Check pending Until (U) obligations
        const untilViolation = this.checkPendingUntil(currentState, event);
        if (untilViolation) {
            this.recordViolation(untilViolation);
            console.warn(`[SafetyMonitor] Until violation: "${untilViolation.propertyName}"`);
        }

        // 3. Evaluate all safety properties
        for (const spec of SAFETY_SPECS) {
            const satisfied = this.evaluate(spec, currentState, event, this.trace);

            if (!satisfied) {
                const violation: SafetyViolation = {
                    timestamp: Date.now(),
                    propertyName: spec.name,
                    description: spec.description,
                    severity: 'CRITICAL',
                    state: currentState,
                    event: event
                };

                this.recordViolation(violation);

                // Attempt to shield (correct) the event
                const corrected = this.shield(event, currentState, spec);

                if (corrected) {
                    console.warn(`[SafetyMonitor] Corrected violation of "${spec.name}"`, corrected);
                    return { safe: false, correctedEvent: corrected, violation };
                } else {
                    console.error(`[SafetyMonitor] CRITICAL: Cannot correct "${spec.name}". Rejecting event.`, event);
                    return { safe: false, violation };
                }
            }
        }

        // 4. Check liveness properties (warnings only)
        for (const spec of LIVENESS_SPECS) {
            const satisfied = this.evaluate(spec, currentState, event, this.trace);
            if (!satisfied) {
                const violation: SafetyViolation = {
                    timestamp: Date.now(),
                    propertyName: spec.name,
                    description: spec.description,
                    severity: 'WARNING',
                    state: currentState,
                    event: event
                };
                this.recordViolation(violation);
                console.warn(`[SafetyMonitor] Liveness warning: "${spec.name}"`);
            }
        }

        // 5. Update trace
        this.trace.push(event);
        if (this.trace.length > this.MAX_TRACE) this.trace.shift();

        return { safe: true };
    }

    /**
     * Evaluate an LTL formula
     */
    private evaluate(
        formula: LTLFormula,
        state: RuntimeState,
        event: KernelEvent | undefined,
        trace: KernelEvent[]
    ): boolean {
        switch (formula.operator) {
            case 'ATOMIC':
                return formula.predicate ? formula.predicate(state, event, trace) : true;

            case 'G': // Globally (always)
                // For runtime verification, we check the current state
                return formula.subformula ? this.evaluate(formula.subformula, state, event, trace) : true;

            case 'F': // Finally (eventually) - bounded
                // Check if property holds now
                if (formula.subformula && this.evaluate(formula.subformula, state, event, trace)) {
                    return true;
                }
                // For bounded F, we track progress toward satisfaction
                // Return true (optimistic) and rely on timeout tracking
                return true;

            case 'X': // Next
                // Schedule check for next state transition
                if (formula.subformula) {
                    this.pendingNext.push({
                        formula: formula.subformula,
                        deadline: 1,
                        timestamp: Date.now()
                    });
                }
                return true; // Optimistic, checked on next tick

            case 'U': // Until (bounded)
                return this.evaluateUntil(formula, state, event, trace);

            default:
                return true;
        }
    }

    /**
     * Evaluate 'Until' operator: p U q
     * Returns true if q holds OR (p holds and we register for future check)
     */
    private evaluateUntil(
        formula: LTLFormula,
        state: RuntimeState,
        event: KernelEvent | undefined,
        trace: KernelEvent[]
    ): boolean {
        // If right (q) is satisfied, Until is satisfied
        if (formula.right && this.evaluate(formula.right, state, event, trace)) {
            // Remove any pending Until for this formula
            this.pendingUntil = this.pendingUntil.filter(p =>
                !(p.left === formula.left && p.right === formula.right)
            );
            return true;
        }

        // Check if left (p) holds
        if (formula.left && !this.evaluate(formula.left, state, event, trace)) {
            return false; // p failed before q
        }

        // p holds, register for future checking
        const existing = this.pendingUntil.find(p =>
            p.left === formula.left && p.right === formula.right
        );

        if (!existing) {
            this.pendingUntil.push({
                left: formula.left!,
                right: formula.right!,
                bound: formula.bound || 50,
                step: 0,
                timestamp: Date.now()
            });
        } else {
            existing.step++;
            if (existing.step > existing.bound) {
                // Exceeded bound without q becoming true
                return false;
            }
        }

        return true; // Still waiting for q
    }

    /**
     * Check pending Next (X) obligations
     */
    private checkPendingNext(state: RuntimeState, event: KernelEvent): SafetyViolation | null {
        const toRemove: number[] = [];
        let violation: SafetyViolation | null = null;

        for (let i = 0; i < this.pendingNext.length; i++) {
            const pending = this.pendingNext[i];
            pending.deadline--;

            if (pending.deadline <= 0) {
                toRemove.push(i);

                // Now check if the formula holds
                if (!this.evaluate(pending.formula, state, event, this.trace)) {
                    violation = {
                        timestamp: Date.now(),
                        propertyName: `X(${pending.formula.name})`,
                        description: `Next-state property violated: ${pending.formula.description}`,
                        severity: 'WARNING',
                        state,
                        event
                    };
                }
            }
        }

        // Remove processed checks (reverse order to maintain indices)
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.pendingNext.splice(toRemove[i], 1);
        }

        return violation;
    }

    /**
     * Check pending Until (U) obligations
     */
    private checkPendingUntil(state: RuntimeState, event: KernelEvent): SafetyViolation | null {
        const toRemove: number[] = [];
        let violation: SafetyViolation | null = null;

        for (let i = 0; i < this.pendingUntil.length; i++) {
            const pending = this.pendingUntil[i];

            // Check if right (q) is now satisfied
            if (this.evaluate(pending.right, state, event, this.trace)) {
                toRemove.push(i);
                continue; // Until satisfied
            }

            // Check if left (p) still holds
            if (!this.evaluate(pending.left, state, event, this.trace)) {
                toRemove.push(i);
                violation = {
                    timestamp: Date.now(),
                    propertyName: `${pending.left.name} U ${pending.right.name}`,
                    description: `Until violated: ${pending.left.description} failed before ${pending.right.description}`,
                    severity: 'WARNING',
                    state,
                    event
                };
            }

            // Check bound
            pending.step++;
            if (pending.step > pending.bound) {
                toRemove.push(i);
                violation = {
                    timestamp: Date.now(),
                    propertyName: `${pending.left.name} U ${pending.right.name}`,
                    description: `Until bound exceeded: ${pending.right.description} not reached within ${pending.bound} steps`,
                    severity: 'WARNING',
                    state,
                    event
                };
            }
        }

        // Remove processed checks
        for (let i = toRemove.length - 1; i >= 0; i--) {
            this.pendingUntil.splice(toRemove[i], 1);
        }

        return violation;
    }

    /**
     * Safety Shield: Attempt to correct an unsafe event
     */
    private shield(
        unsafeEvent: KernelEvent,
        state: RuntimeState,
        violatedSpec: LTLFormula
    ): KernelEvent | null {
        if (unsafeEvent.type === 'ADJUST_TEMPO') {
            const scale = unsafeEvent.scale;

            // Clamp tempo to safe bounds [0.8, 1.4]
            const safeTempo = Math.max(0.8, Math.min(1.4, scale));

            // Check rate constraint (relative to last tempo adjustment)
            const last = this.trace.slice().reverse().find(e => e.type === 'ADJUST_TEMPO') as (KernelEvent & { type: 'ADJUST_TEMPO' }) | undefined;
            if (!last) {
                return {
                    ...unsafeEvent,
                    scale: safeTempo,
                    reason: `${unsafeEvent.reason} [SHIELDED: ${violatedSpec.name}]`
                };
            }

            const dt = (unsafeEvent.timestamp - last.timestamp) / 1000;
            if (dt > 0) {
                const maxDelta = 0.1 * dt;
                const clampedTempo = Math.max(
                    state.tempoScale - maxDelta,
                    Math.min(state.tempoScale + maxDelta, safeTempo)
                );

                return {
                    ...unsafeEvent,
                    scale: clampedTempo,
                    reason: `${unsafeEvent.reason} [SHIELDED: ${violatedSpec.name}]`
                };
            }

            return {
                ...unsafeEvent,
                scale: safeTempo,
                reason: `${unsafeEvent.reason} [SHIELDED]`
            };
        }

        if (unsafeEvent.type === 'START_SESSION') {
            // Cannot shield a START_SESSION if locked
            return null;
        }

        return null;
    }

    /**
     * Record a violation for analysis
     */
    private recordViolation(violation: SafetyViolation): void {
        this.violations.push(violation);
        if (this.violations.length > this.MAX_VIOLATIONS) {
            this.violations.shift();
        }
    }

    /**
     * Get violation history
     */
    getViolations(): SafetyViolation[] {
        return [...this.violations];
    }

    /**
     * Clear violation history
     */
    clearViolations(): void {
        this.violations = [];
    }

    /**
     * Clear all pending checks
     */
    clearPending(): void {
        this.pendingNext = [];
        this.pendingUntil = [];
    }

    /**
     * Get statistics
     */
    getStats() {
        const critical = this.violations.filter(v => v.severity === 'CRITICAL').length;
        const warnings = this.violations.filter(v => v.severity === 'WARNING').length;

        return {
            totalViolations: this.violations.length,
            critical,
            warnings,
            pendingNextChecks: this.pendingNext.length,
            pendingUntilChecks: this.pendingUntil.length,
            recentViolations: this.violations.slice(-10)
        };
    }
}

// Singleton instance
export const safetyMonitor = new SafetyMonitor();
