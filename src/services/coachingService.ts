/**
 * Coaching Service
 * Delivers context-aware encouragement messages during breathing sessions
 */

import { BreathPhase } from '../types';

export interface CoachingMessage {
    message: string;
    priority: number; // 1-5, higher = more important
    category: 'encouragement' | 'milestone' | 'technique' | 'celebration';
}

export interface SessionContext {
    cycleCount: number;
    durationSec: number;
    phase: BreathPhase;
    alignment: number; // 0-1
    heartRate: number;
    tempoScale: number;
}

export class CoachingService {
    private lastMessageTime = 0;
    private lastCycleTriggered = 0;
    private milestonesFired = new Set<number>();
    private readonly MESSAGE_COOLDOWN = 30000; // 30 seconds minimum between messages

    /**
     * Get a coaching message based on current session context
     * Returns null if no message should be displayed
     */
    getCoachingMessage(context: SessionContext): CoachingMessage | null {
        const now = Date.now();

        // Respect cooldown period
        if (now - this.lastMessageTime < this.MESSAGE_COOLDOWN) {
            return null;
        }

        // Don't interrupt during critical phases (inhale/exhale peak moments)
        if (context.phase === 'inhale' || context.phase === 'exhale') {
            return null;
        }

        // Check for milestone messages (highest priority)
        const milestoneMsg = this.checkMilestones(context);
        if (milestoneMsg) {
            this.lastMessageTime = now;
            return milestoneMsg;
        }

        // Check for cycle-based messages
        const cycleMsg = this.checkCycleMilestones(context);
        if (cycleMsg) {
            this.lastMessageTime = now;
            return cycleMsg;
        }

        // Check for performance-based encouragement
        const performanceMsg = this.checkPerformance(context);
        if (performanceMsg) {
            this.lastMessageTime = now;
            return performanceMsg;
        }

        return null;
    }

    /**
     * Time-based milestones (2min, 5min, 10min)
     */
    private checkMilestones(context: SessionContext): CoachingMessage | null {
        const { durationSec } = context;

        // 2 minute milestone
        if (durationSec >= 120 && durationSec < 125 && !this.milestonesFired.has(2)) {
            this.milestonesFired.add(2);
            return {
                message: '2 minutes of mindful breathing ✨',
                priority: 5,
                category: 'milestone',
            };
        }

        // 5 minute milestone
        if (durationSec >= 300 && durationSec < 305 && !this.milestonesFired.has(5)) {
            this.milestonesFired.add(5);
            return {
                message: '5 minutes! Beautiful practice 🌟',
                priority: 5,
                category: 'celebration',
            };
        }

        // 10 minute milestone
        if (durationSec >= 600 && durationSec < 605 && !this.milestonesFired.has(10)) {
            this.milestonesFired.add(10);
            return {
                message: '10 minutes of deep presence 🙏',
                priority: 5,
                category: 'celebration',
            };
        }

        return null;
    }

    /**
     * Cycle-based encouragement (every 3 cycles)
     */
    private checkCycleMilestones(context: SessionContext): CoachingMessage | null {
        const { cycleCount } = context;

        // Every 3 cycles
        if (cycleCount > 0 && cycleCount % 3 === 0 && cycleCount !== this.lastCycleTriggered) {
            this.lastCycleTriggered = cycleCount;

            const messages = [
                "You're finding your rhythm 🌊",
                "Steady and smooth, well done 🍃",
                `${cycleCount} cycles of breath harmony 💫`,
                "Each breath brings calm 🌙",
            ];

            return {
                message: messages[cycleCount % messages.length],
                priority: 3,
                category: 'encouragement',
            };
        }

        return null;
    }

    /**
     * Performance-based encouragement
     */
    private checkPerformance(context: SessionContext): CoachingMessage | null {
        const { alignment, heartRate, tempoScale, cycleCount } = context;

        // Only start giving performance feedback after a few cycles
        if (cycleCount < 2) return null;

        // Excellent alignment
        if (alignment > 0.85) {
            return {
                message: 'Beautiful rhythm, perfectly in sync 💙',
                priority: 4,
                category: 'encouragement',
            };
        }

        // Heart rate dropping nicely
        if (heartRate > 0 && heartRate < 60) {
            return {
                message: 'Your heart is slowing - deep relaxation 💚',
                priority: 4,
                category: 'encouragement',
            };
        }

        // Struggle detection - low alignment
        if (alignment < 0.4 && cycleCount > 3) {
            return {
                message: 'Take your time, let the breath flow naturally 🌿',
                priority: 3,
                category: 'technique',
            };
        }

        // Tempo adjusting significantly
        if (tempoScale > 1.15) {
            return {
                message: 'Finding your natural pace, stay with it 🎵',
                priority: 3,
                category: 'technique',
            };
        }

        return null;
    }

    /**
     * Reset service state (call when session ends)
     */
    reset(): void {
        this.lastMessageTime = 0;
        this.lastCycleTriggered = 0;
        this.milestonesFired.clear();
    }
}
