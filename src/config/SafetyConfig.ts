/**
 * ZENB SAFETY CONFIGURATION
 * =========================
 *
 * This file defines all safety-critical parameters for the ZenB runtime.
 * Changes to these values can impact user safety - modify with extreme caution.
 *
 * INVARIANTS:
 * 1. Tempo must always be in [tempo.min, tempo.max]
 * 2. HR must be rejected if outside [vitals.hrHardMin, vitals.hrHardMax]
 * 3. Control loop must run at exactly clocks.controlHz
 * 4. Emergency halt must trigger after safety.minSessionSecBeforeEmergency
 *
 * DERIVATION NOTES:
 * - HR bounds based on physiological limits (resting to max exertion)
 * - Tempo bounds chosen to prevent hyperventilation (too fast) or hypoventilation (too slow)
 * - Control rate of 10Hz provides 100ms response time (within human perception threshold)
 */

export const SafetyConfig = {
  /**
   * CLOCK CONFIGURATION
   * Controls the timing of the control loop and frame processing.
   */
  clocks: {
    /** Control loop frequency in Hz. 10Hz = 100ms tick interval. */
    controlHz: 10,

    /** Maximum frame delta time in seconds. Prevents time jumps from causing instability. */
    maxFrameDtSec: 0.1,

    /** Max control steps per animation frame. Prevents spiral of death. */
    maxControlStepsPerFrame: 3,

    /** Target visual frame rate (for adaptive quality). */
    targetVisualFps: 60,

    /** Minimum acceptable visual frame rate before quality reduction. */
    minAcceptableFps: 30,
  },

  /**
   * VITAL SIGN BOUNDS
   * Physiologically-derived limits for heart rate measurements.
   */
  vitals: {
    /** Absolute minimum HR (BPM). Values below indicate sensor error or severe bradycardia. */
    hrHardMin: 30,

    /** Absolute maximum HR (BPM). Values above indicate sensor error or extreme tachycardia. */
    hrHardMax: 220,

    /** Soft minimum for warnings. Resting HR below 40 is unusual for most adults. */
    hrSoftMin: 40,

    /** Soft maximum for warnings. HR above 200 suggests extreme exertion. */
    hrSoftMax: 200,

    /**
     * HR confidence threshold. Measurements below this confidence are not trusted.
     * Range: 0.0 - 1.0
     */
    hrMinConfidence: 0.3,

    /** HRV bounds (RMSSD in ms). Normal range is 20-120ms for healthy adults. */
    hrvMin: 5,
    hrvMax: 200,

    /** Respiration rate bounds (breaths per minute). */
    rrMin: 4,
    rrMax: 40,
  },

  /**
   * TEMPO REGULATION
   * Controls how the breathing guide speed can be adjusted.
   */
  tempo: {
    /**
     * HARD LIMIT: Minimum tempo scale.
     * 0.8 = breathing can be sped up by at most 20% from base rate.
     * Prevents hyperventilation risk.
     */
    min: 0.8,

    /**
     * HARD LIMIT: Maximum tempo scale.
     * 1.4 = breathing can be slowed by at most 40% from base rate.
     * Prevents hypoventilation risk.
     */
    max: 1.4,

    /** Upward adjustment step size per control tick. */
    upStep: 0.002,

    /** Downward adjustment step size per control tick. */
    downStep: 0.001,

    /** Rhythm alignment threshold below which tempo increases (user breathing too slow). */
    lowAlign: 0.35,

    /** Rhythm alignment threshold above which tempo decreases (user breathing too fast). */
    highAlign: 0.8,

    /** Deadband around target - no adjustment within this range. */
    deadband: 0.01,

    /** Maximum tempo change per AI tool call. */
    maxDeltaPerAdjustment: 0.2,

    /** Cooldown between tempo adjustments (ms). */
    adjustmentCooldownMs: 5000,
  },

  /**
   * WATCHDOG CONFIGURATION
   * Monitors for divergence between user state and expected state.
   */
  watchdog: {
    /**
     * Maximum time (ms) the system can tolerate high prediction error
     * before triggering safety intervention.
     */
    maxDivergenceTimeMs: 30000,

    /** Prediction error threshold above which system is considered "diverging". */
    divergenceThreshold: 0.6,

    /** Critical divergence threshold that triggers immediate safety response. */
    criticalDivergenceThreshold: 0.9,

    /** Time window for averaging divergence (ms). */
    divergenceWindowMs: 5000,
  },

  /**
   * SAFETY SYSTEM
   * Emergency response and trauma-informed care parameters.
   */
  safety: {
    /** Minimum session duration before emergency halt is possible. */
    minSessionSecBeforeEmergency: 10,

    /** Duration of safety lock (ms). Default: 24 hours. */
    safetyLockDurationMs: 24 * 60 * 60 * 1000,

    /** Cumulative stress score threshold that triggers safety lock. */
    stressScoreLockThreshold: 150,

    /** Pattern switch cooldown (ms). Prevents rapid pattern cycling. */
    patternSwitchCooldownMs: 30000,

    /** Minimum session duration before pattern switch allowed. */
    minSessionSecBeforePatternSwitch: 30,
  },

  /**
   * AI COACH SAFETY
   * Limits on AI-driven interventions.
   */
  aiCoach: {
    /** Maximum telemetry update rate to AI (ms). */
    maxTelemetryIntervalMs: 5000,

    /** Critical event minimum interval (ms). */
    criticalEventIntervalMs: 1500,

    /** Maximum audio payload size (bytes). Prevents DoS. */
    maxAudioPayloadBytes: 256 * 1024,

    /** Tool execution timeout (ms). */
    toolExecutionTimeoutMs: 5000,

    /** User confirmation timeout (ms). */
    confirmationTimeoutMs: 30000,
  },

  /**
   * CAMERA VITALS
   * Signal quality thresholds for rPPG measurement.
   */
  cameraVitals: {
    /** Minimum brightness (0-255) for valid signal. */
    minBrightness: 45,

    /** Maximum saturation ratio before signal degradation. */
    maxSaturationRatio: 0.15,

    /** Maximum motion magnitude before signal is invalid. */
    maxMotion: 0.45,

    /** Minimum FPS for reliable signal extraction. */
    minFps: 15,

    /** Maximum frame timing jitter (ms). */
    maxFpsJitterMs: 15,

    /** Minimum SNR for trusting HR measurement. */
    minSnrLinear: 1.2,

    /** Time windows for different measurements (seconds). */
    hrWindowSec: 12,
    rrWindowSec: 40,
    hrvWindowSec: 120,
  },

  /**
   * PERSISTENCE
   * Data retention and storage limits.
   */
  persistence: {
    /** Event log retention period (ms). Default: 7 days. */
    retentionMs: 7 * 24 * 60 * 60 * 1000,

    /** Maximum event log entries. */
    maxEventLogSize: 1000,

    /** Maximum session history entries. */
    maxSessionHistory: 100,
  },

  /**
   * DERIVED VALUES
   * Computed from the above constants. Do not modify directly.
   */
  derived: {
    /** Control tick interval in milliseconds. */
    get controlTickMs(): number {
      return 1000 / SafetyConfig.clocks.controlHz;
    },

    /** Maximum frame delta in milliseconds. */
    get maxFrameDtMs(): number {
      return SafetyConfig.clocks.maxFrameDtSec * 1000;
    },

    /** Retention period in days. */
    get retentionDays(): number {
      return SafetyConfig.persistence.retentionMs / (24 * 60 * 60 * 1000);
    },
  },
} as const;

export type SafetyConfigType = typeof SafetyConfig;

/**
 * VALIDATION HELPERS
 */

/** Check if a heart rate value is within hard bounds. */
export function isHrValid(hr: number): boolean {
  return hr >= SafetyConfig.vitals.hrHardMin && hr <= SafetyConfig.vitals.hrHardMax;
}

/** Check if a tempo scale is within allowed bounds. */
export function isTempoValid(scale: number): boolean {
  return scale >= SafetyConfig.tempo.min && scale <= SafetyConfig.tempo.max;
}

/** Clamp a tempo scale to allowed bounds. */
export function clampTempo(scale: number): number {
  return Math.max(SafetyConfig.tempo.min, Math.min(SafetyConfig.tempo.max, scale));
}

/** Check if a prediction error indicates critical divergence. */
export function isCriticalDivergence(predictionError: number): boolean {
  return predictionError > SafetyConfig.watchdog.criticalDivergenceThreshold;
}
