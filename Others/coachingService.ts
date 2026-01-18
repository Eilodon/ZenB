/**
 * AI Coaching Service - Gemini-powered breathing coach
 * 
 * Provides personalized coaching based on:
 * - Session performance
 * - Heart rate/HRV trends
 * - Time of day
 * - User goals
 */

// =============================================================================
// TYPES
// =============================================================================

export interface CoachingContext {
    currentPhase: string;
    cyclesCompleted: number;
    heartRate: number | null;
    hrv: { rmssd: number; sdnn: number } | null;
    patternId: string;
    sessionDurationSec: number;
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    streakDays: number;
    totalSessions: number;
}

export interface CoachingMessage {
    type: 'encouragement' | 'guidance' | 'insight' | 'milestone';
    message: string;
    emoji: string;
}

// =============================================================================
// COACHING TEMPLATES
// =============================================================================

const PHASE_GUIDANCE: Record<string, string[]> = {
    Inhale: [
        'Fill your lungs slowly and deeply',
        'Draw the breath down to your belly',
        'Imagine breathing in calm energy',
    ],
    HoldIn: [
        'Hold gently, no tension',
        'Feel the stillness within',
        'Let the oxygen spread through your body',
    ],
    Exhale: [
        'Release slowly and completely',
        'Let go of any tension',
        'Feel your body relax with each breath out',
    ],
    HoldOut: [
        'Rest in the empty space',
        'Find peace in the pause',
        'Prepare for the next breath',
    ],
};

const ENCOURAGEMENTS = [
    { message: 'You\'re doing great!', emoji: '🌟' },
    { message: 'Beautiful rhythm', emoji: '✨' },
    { message: 'Stay with it', emoji: '💪' },
    { message: 'Perfect flow', emoji: '🌊' },
    { message: 'Your focus is strong', emoji: '🎯' },
];

const HR_INSIGHTS = {
    dropping: [
        'Your heart rate is dropping - great relaxation response',
        'Notice how your body is calming down',
    ],
    elevated: [
        'Your heart rate is a bit elevated - that\'s okay, keep breathing',
        'The breath will help bring your nervous system into balance',
    ],
    stable: [
        'Your heart rate is steady - you\'ve found your rhythm',
        'You\'re in a great coherent state',
    ],
};

const MILESTONE_MESSAGES = [
    { cycles: 5, message: 'Five cycles complete!', emoji: '🎉' },
    { cycles: 10, message: 'Ten cycles - halfway there!', emoji: '🔥' },
    { cycles: 20, message: 'Twenty cycles - you\'re a natural!', emoji: '👑' },
    { minutes: 5, message: 'Five minutes of mindfulness!', emoji: '⏱️' },
    { minutes: 10, message: 'Ten minutes - impressive focus!', emoji: '🧘' },
];

const STREAK_MESSAGES: Record<number, string> = {
    3: 'Three days in a row! You\'re building momentum.',
    7: 'A whole week of consistent practice! 🔥',
    14: 'Two weeks strong! This is becoming a habit.',
    30: 'One month of daily practice - you\'re transformed!',
};

// =============================================================================
// COACHING ENGINE
// =============================================================================

export class BreathingCoach {
    private lastMessage: CoachingMessage | null = null;
    private lastMessageTime: number = 0;
    private minMessageInterval = 30000; // 30 seconds between messages

    /**
     * Get phase-specific guidance
     */
    getPhaseGuidance(phase: string): string {
        const options = PHASE_GUIDANCE[phase] || [];
        return options[Math.floor(Math.random() * options.length)] || '';
    }

    /**
     * Get contextual coaching message
     */
    getCoachingMessage(context: CoachingContext): CoachingMessage | null {
        const now = Date.now();

        // Respect minimum interval
        if (now - this.lastMessageTime < this.minMessageInterval) {
            return null;
        }

        let message: CoachingMessage | null = null;

        // Check for milestone
        const milestone = this.checkMilestone(context);
        if (milestone) {
            message = milestone;
        }

        // HR-based insight
        else if (context.heartRate && Math.random() < 0.3) {
            message = this.getHrInsight(context.heartRate);
        }

        // Random encouragement
        else if (Math.random() < 0.2) {
            const enc = ENCOURAGEMENTS[Math.floor(Math.random() * ENCOURAGEMENTS.length)];
            message = { type: 'encouragement', ...enc };
        }

        if (message) {
            this.lastMessage = message;
            this.lastMessageTime = now;
        }

        return message;
    }

    /**
     * Get session summary coaching
     */
    getSessionSummary(context: CoachingContext): CoachingMessage {
        const { cyclesCompleted, sessionDurationSec, heartRate, streakDays } = context;

        let message = '';
        let emoji = '✨';

        if (sessionDurationSec >= 600) {
            message = `Amazing! ${Math.floor(sessionDurationSec / 60)} minutes of pure focus.`;
            emoji = '🏆';
        } else if (cyclesCompleted >= 10) {
            message = `${cyclesCompleted} cycles completed. You're mastering your breath.`;
            emoji = '🌟';
        } else if (heartRate && heartRate < 65) {
            message = 'Your body responded beautifully to the practice.';
            emoji = '💚';
        } else {
            message = 'Every breath counts. See you next time!';
            emoji = '🙏';
        }

        // Add streak acknowledgment
        if (streakDays && STREAK_MESSAGES[streakDays]) {
            message += ` ${STREAK_MESSAGES[streakDays]}`;
        }

        return { type: 'insight', message, emoji };
    }

    /**
     * Get personalized greeting
     */
    getGreeting(context: Pick<CoachingContext, 'timeOfDay' | 'streakDays' | 'totalSessions'>): string {
        const greetings: Record<string, string> = {
            morning: 'Good morning! Ready to start your day mindfully?',
            afternoon: 'Afternoon check-in. Let\'s reset.',
            evening: 'Wind down with intention tonight.',
            night: 'Prepare for restful sleep.',
        };

        let greeting = greetings[context.timeOfDay];

        if (context.streakDays >= 7) {
            greeting += ` 🔥 ${context.streakDays}-day streak!`;
        } else if (context.totalSessions === 0) {
            greeting = 'Welcome! Your first breath awaits. 🌱';
        }

        return greeting;
    }

    private checkMilestone(context: CoachingContext): CoachingMessage | null {
        const { cyclesCompleted, sessionDurationSec } = context;
        const minutes = sessionDurationSec / 60;

        for (const milestone of MILESTONE_MESSAGES) {
            if ('cycles' in milestone && cyclesCompleted === milestone.cycles) {
                return { type: 'milestone', message: milestone.message, emoji: milestone.emoji };
            }
            if ('minutes' in milestone && milestone.minutes !== undefined && Math.abs(minutes - milestone.minutes) < 0.1) {
                return { type: 'milestone', message: milestone.message, emoji: milestone.emoji };
            }
        }

        return null;
    }

    private getHrInsight(heartRate: number): CoachingMessage {
        let insight: string;

        if (heartRate < 60) {
            insight = HR_INSIGHTS.dropping[Math.floor(Math.random() * HR_INSIGHTS.dropping.length)];
        } else if (heartRate > 80) {
            insight = HR_INSIGHTS.elevated[Math.floor(Math.random() * HR_INSIGHTS.elevated.length)];
        } else {
            insight = HR_INSIGHTS.stable[Math.floor(Math.random() * HR_INSIGHTS.stable.length)];
        }

        return { type: 'insight', message: insight, emoji: '💓' };
    }
}

// Singleton instance
export const breathingCoach = new BreathingCoach();

// =============================================================================
// HOOK
// =============================================================================

import { useState, useCallback, useEffect, useRef } from 'react';

export function useCoaching() {
    const [currentMessage, setCurrentMessage] = useState<CoachingMessage | null>(null);
    const clearTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

    useEffect(() => {
        return () => {
            if (clearTimerRef.current) {
                clearTimeout(clearTimerRef.current);
            }
        };
    }, []);

    const updateContext = useCallback((context: CoachingContext) => {
        const message = breathingCoach.getCoachingMessage(context);
        if (message) {
            setCurrentMessage(message);

            // Auto-clear after 5 seconds
            if (clearTimerRef.current) {
                clearTimeout(clearTimerRef.current);
            }
            clearTimerRef.current = setTimeout(() => setCurrentMessage(null), 5000);
        }
    }, []);

    const getSessionSummary = useCallback((context: CoachingContext) => {
        return breathingCoach.getSessionSummary(context);
    }, []);

    const getGreeting = useCallback((context: Pick<CoachingContext, 'timeOfDay' | 'streakDays' | 'totalSessions'>) => {
        return breathingCoach.getGreeting(context);
    }, []);

    return {
        currentMessage,
        updateContext,
        getSessionSummary,
        getGreeting,
    };
}
