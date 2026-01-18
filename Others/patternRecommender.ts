/**
 * Pattern Recommender - AI-powered pattern suggestions
 * 
 * Recommends breathing patterns based on:
 * - Time of day
 * - Recent session history
 * - User's stress/relaxation needs
 * - Pattern variety
 */

import { useSessionStore, type SessionRecord } from '../stores/sessionStore';

// =============================================================================
// TYPES
// =============================================================================

export interface PatternRecommendation {
    patternId: string;
    score: number;
    reason: string;
}

export interface UserContext {
    timeOfDay: 'morning' | 'afternoon' | 'evening' | 'night';
    recentPatterns: string[];
    avgRecentHr: number | null;
    daysSinceLastSession: number;
    currentStreak: number;
}

// =============================================================================
// PATTERN METADATA
// =============================================================================

interface PatternMeta {
    id: string;
    arousal: number;     // -1 (sedative) to 1 (stimulant)
    complexity: number;   // 1-3 difficulty
    bestFor: string[];    // ['sleep', 'focus', 'stress', 'energy', 'general']
}

const PATTERN_METADATA: PatternMeta[] = [
    { id: '4-7-8', arousal: -0.8, complexity: 1, bestFor: ['sleep', 'stress'] },
    { id: 'box', arousal: 0, complexity: 1, bestFor: ['focus', 'general'] },
    { id: 'calm', arousal: -0.3, complexity: 1, bestFor: ['general', 'stress'] },
    { id: 'coherence', arousal: -0.5, complexity: 2, bestFor: ['focus', 'general'] },
    { id: 'deep-relax', arousal: -0.9, complexity: 1, bestFor: ['stress', 'sleep'] },
    { id: '7-11', arousal: -1.0, complexity: 2, bestFor: ['stress', 'sleep'] },
    { id: 'awake', arousal: 0.8, complexity: 2, bestFor: ['energy'] },
    { id: 'triangle', arousal: 0.2, complexity: 1, bestFor: ['general', 'focus'] },
    { id: 'tactical', arousal: 0.1, complexity: 2, bestFor: ['focus'] },
    { id: 'buteyko', arousal: -0.2, complexity: 3, bestFor: ['general'] },
    { id: 'wim-hof', arousal: 1.0, complexity: 3, bestFor: ['energy'] },
];

// =============================================================================
// RECOMMENDATION ENGINE
// =============================================================================

function getTimeOfDay(): UserContext['timeOfDay'] {
    const hour = new Date().getHours();
    if (hour < 6) return 'night';
    if (hour < 12) return 'morning';
    if (hour < 18) return 'afternoon';
    if (hour < 22) return 'evening';
    return 'night';
}

function getDesiredArousal(timeOfDay: UserContext['timeOfDay']): number {
    switch (timeOfDay) {
        case 'morning': return 0.3;    // Slightly energizing
        case 'afternoon': return 0;    // Balanced
        case 'evening': return -0.5;   // Relaxing
        case 'night': return -0.8;     // Very sedative
    }
}

function getDesiredGoal(timeOfDay: UserContext['timeOfDay']): string {
    switch (timeOfDay) {
        case 'morning': return 'energy';
        case 'afternoon': return 'focus';
        case 'evening': return 'stress';
        case 'night': return 'sleep';
    }
}

export function recommendPatterns(limit: number = 3): PatternRecommendation[] {
    const timeOfDay = getTimeOfDay();
    const desiredArousal = getDesiredArousal(timeOfDay);
    const desiredGoal = getDesiredGoal(timeOfDay);

    // Get recent patterns to encourage variety
    const { sessions } = useSessionStore.getState();
    const recentPatterns = sessions.slice(0, 5).map(s => s.patternId);

    // Score each pattern
    const scored = PATTERN_METADATA.map(pattern => {
        let score = 0;
        let reasons: string[] = [];

        // Arousal match (0-40 points)
        const arousalDiff = Math.abs(pattern.arousal - desiredArousal);
        const arousalScore = Math.max(0, 40 - arousalDiff * 30);
        score += arousalScore;

        // Goal match (0-30 points)
        if (pattern.bestFor.includes(desiredGoal)) {
            score += 30;
            reasons.push(`Great for ${desiredGoal}`);
        }

        // Variety bonus (0-20 points)
        const timesRecent = recentPatterns.filter(p => p === pattern.id).length;
        const varietyScore = Math.max(0, 20 - timesRecent * 10);
        score += varietyScore;
        if (timesRecent === 0) {
            reasons.push('Try something new');
        }

        // Complexity consideration (0-10 points)
        // Favor simpler patterns slightly
        score += (4 - pattern.complexity) * 3;

        // Time-specific bonuses
        if (timeOfDay === 'morning' && pattern.id === 'awake') {
            score += 15;
            reasons.push('Perfect for morning energy');
        }
        if (timeOfDay === 'night' && pattern.id === '4-7-8') {
            score += 15;
            reasons.push('Ideal for sleep');
        }
        if (timeOfDay === 'afternoon' && pattern.id === 'box') {
            score += 10;
            reasons.push('Great for afternoon focus');
        }

        const reason = reasons.length > 0 ? reasons[0] : 'Recommended for you';

        return {
            patternId: pattern.id,
            score,
            reason,
        };
    });

    // Sort by score and return top N
    return scored
        .sort((a, b) => b.score - a.score)
        .slice(0, limit);
}

/**
 * Get a single top recommendation with explanation
 */
export function getTopRecommendation(): PatternRecommendation | null {
    const recommendations = recommendPatterns(1);
    return recommendations[0] || null;
}

/**
 * Get personalized greeting based on context
 */
export function getPersonalizedGreeting(): string {
    const timeOfDay = getTimeOfDay();
    const { streak } = useSessionStore.getState();

    const greetings: Record<string, string[]> = {
        morning: [
            'Good morning! Ready to energize?',
            'Rise and breathe! ☀️',
            'Start your day mindfully.',
        ],
        afternoon: [
            'Afternoon check-in time.',
            'Take a mindful break.',
            'Reset and refocus.',
        ],
        evening: [
            'Wind down with intention.',
            'Evening calm awaits.',
            'Prepare for restful sleep.',
        ],
        night: [
            'Time for deep relaxation.',
            'Sleep preparation mode.',
            'Let the day go. 🌙',
        ],
    };

    const options = greetings[timeOfDay];
    let greeting = options[Math.floor(Math.random() * options.length)];

    if (streak.currentStreak >= 7) {
        greeting += ` 🔥 ${streak.currentStreak}-day streak!`;
    }

    return greeting;
}
