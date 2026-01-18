/**
 * Services Index
 */

export { nextPhaseSkipZero, isPatternValid } from './phaseMachine';
export { recommendPatterns, getTopRecommendation, getPersonalizedGreeting } from './patternRecommender';
export { wearableService, useWearable, WEARABLE_PROVIDERS } from './wearableService';
export type { WearableProvider, WearableData, WearableDevice, ProviderConfig } from './wearableService';
export { breathingCoach, useCoaching } from './coachingService';
export type { CoachingContext, CoachingMessage } from './coachingService';
export { authService, useAuth, syncUserData } from './authService';
export type { UserProfile, AuthState, SessionSyncData } from './authService';

// Advanced physiological services (migrated from ZenOne-main)
export { UKFStateEstimator } from './UKFStateEstimator';
export type { UKFConfig } from './UKFStateEstimator';
export { SafetyMonitor, SAFETY_SPECS, LIVENESS_SPECS } from './SafetyMonitor';
export type { SafetyViolation, LTLFormula } from './SafetyMonitor';
export { BinauralEngine, binauralEngine, BINAURAL_CONFIGS, MockAudioBackend } from './BinauralEngine';
export type { BrainWaveState, BinauralConfig, IAudioBackend } from './BinauralEngine';
export { ToolExecutor, AI_TOOLS } from './AIToolRegistry';
export type { ToolDefinition, ToolContext, IKernelInterface, KernelState } from './AIToolRegistry';



