//! ZenOne FFI Bridge - Full Engine Integration
//!
//! This crate exposes the complete AGOLOS Rust core to mobile platforms via UniFFI.
//! Provides access to Engine, BeliefState, Safety, and Resonance tracking.

use std::sync::Mutex;
use std::time::Instant;

use serde::{Serialize, Deserialize};

use zenb_core::{
    breath_patterns::{builtin_patterns, BreathPattern},
    phase_machine::{Phase, PhaseMachine},
    Engine,
    belief::Context,
};
use zenb_signals::rppg::EnsembleProcessor;

uniffi::include_scaffolding!("zenone");

// ============================================================================
// UniFFI ERROR TYPE
// ============================================================================

#[derive(Debug, thiserror::Error)]
pub enum ZenOneError {
    #[error("pattern not found")]
    PatternNotFound,

    #[error("session not active")]
    SessionNotActive,

    #[error("safety violation: {0}")]
    SafetyViolation(String),

    #[error("config error: {0}")]
    ConfigError(String),
}

// ============================================================================
// FFI-SAFE TYPES
// ============================================================================

/// Breathing pattern info (FFI-safe)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiBreathPattern {
    pub id: String,
    pub label: String,
    pub tag: String,
    pub description: String,
    pub inhale_sec: f32,
    pub hold_in_sec: f32,
    pub exhale_sec: f32,
    pub hold_out_sec: f32,
    pub recommended_cycles: u32,
    pub arousal_impact: f32,
}

impl From<&BreathPattern> for FfiBreathPattern {
    fn from(p: &BreathPattern) -> Self {
        FfiBreathPattern {
            id: p.id.clone(),
            label: p.label.clone(),
            tag: p.tag.clone(),
            description: p.description.clone(),
            inhale_sec: p.timings.inhale,
            hold_in_sec: p.timings.hold_in,
            exhale_sec: p.timings.exhale,
            hold_out_sec: p.timings.hold_out,
            recommended_cycles: p.recommended_cycles,
            arousal_impact: p.arousal_impact,
        }
    }
}

/// Current phase (FFI-safe enum)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FfiPhase {
    Inhale,
    HoldIn,
    Exhale,
    HoldOut,
}

impl From<Phase> for FfiPhase {
    fn from(p: Phase) -> Self {
        match p {
            Phase::Inhale => FfiPhase::Inhale,
            Phase::HoldIn => FfiPhase::HoldIn,
            Phase::Exhale => FfiPhase::Exhale,
            Phase::HoldOut => FfiPhase::HoldOut,
        }
    }
}

/// Belief basis mode (FFI-safe)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FfiBeliefMode {
    Calm,
    Stress,
    Focus,
    Sleepy,
    Energize,
}

impl From<u8> for FfiBeliefMode {
    fn from(idx: u8) -> Self {
        match idx {
            0 => FfiBeliefMode::Calm,
            1 => FfiBeliefMode::Stress,
            2 => FfiBeliefMode::Focus,
            3 => FfiBeliefMode::Sleepy,
            4 => FfiBeliefMode::Energize,
            _ => FfiBeliefMode::Calm,
        }
    }
}

/// Runtime status (FFI-safe)
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FfiRuntimeStatus {
    Idle,
    Running,
    Paused,
    SafetyLock,
}

/// Full belief state (FFI-safe)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiBeliefState {
    /// 5-mode probability distribution [Calm, Stress, Focus, Sleepy, Energize]
    pub probabilities: Vec<f32>,
    /// Confidence level 0-1
    pub confidence: f32,
    /// Dominant mode
    pub mode: FfiBeliefMode,
    /// Uncertainty (inverse of confidence)
    pub uncertainty: f32,
}

impl FfiBeliefState {
    fn from_belief_array(p: &[f32; 5], confidence: f32) -> Self {
        let (max_idx, _) = p.iter().enumerate()
            .max_by(|(_, a), (_, b)| a.partial_cmp(b).unwrap())
            .unwrap_or((0, &0.0));
        FfiBeliefState {
            probabilities: p.to_vec(),
            confidence,
            mode: FfiBeliefMode::from(max_idx as u8),
            uncertainty: 1.0 - confidence,
        }
    }

    fn default() -> Self {
        FfiBeliefState {
            probabilities: vec![0.2; 5],
            confidence: 0.0,
            mode: FfiBeliefMode::Calm,
            uncertainty: 1.0,
        }
    }
}

/// Helper to extract belief from Engine's vinnana controller
fn get_engine_belief(engine: &Engine) -> FfiBeliefState {
    if let Some(ref state) = engine.vinnana.last_state {
        let confidence = state.confidence;
        FfiBeliefState::from_belief_array(&state.belief, confidence)
    } else {
        FfiBeliefState::default()
    }
}

/// Estimate from Engine (FFI-safe)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiEstimate {
    /// Arousal level 0-1
    pub arousal: f32,
    /// Prediction error (high = user deviating from expected)
    pub prediction_error: f32,
    /// Resonance/coherence score 0-1
    pub resonance_score: f32,
    /// Free energy (active inference metric)
    pub free_energy: f32,
    /// Confidence in estimate
    pub confidence: f32,
}

/// Safety status (FFI-safe)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiSafetyStatus {
    /// Whether safety lock is engaged
    pub is_locked: bool,
    /// Number of trauma entries in registry
    pub trauma_count: u32,
    /// Current tempo bounds [min, max]
    pub tempo_bounds: Vec<f32>,
    /// Current HR bounds [min, max]
    pub hr_bounds: Vec<f32>,
}

/// Resonance metrics (FFI-safe)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiResonance {
    /// Coherence score 0-1
    pub coherence_score: f32,
    /// Phase locking value
    pub phase_locking: f32,
    /// Rhythm alignment 0-1
    pub rhythm_alignment: f32,
}

/// Frame result from process_frame
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiFrame {
    pub phase: FfiPhase,
    pub phase_progress: f32,
    pub cycles_completed: u64,
    pub heart_rate: Option<f32>,
    pub signal_quality: f32,
    /// Full belief state
    pub belief: FfiBeliefState,
    /// Resonance metrics
    pub resonance: FfiResonance,
}

/// Session statistics
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiSessionStats {
    pub duration_sec: f32,
    pub cycles_completed: u64,
    pub pattern_id: String,
    pub avg_heart_rate: Option<f32>,
    /// Final belief state
    pub final_belief: FfiBeliefState,
    /// Average resonance score
    pub avg_resonance: f32,
}

/// Full runtime state snapshot (FFI-safe)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiRuntimeState {
    pub status: FfiRuntimeStatus,
    pub pattern_id: String,
    pub phase: FfiPhase,
    pub phase_progress: f32,
    pub cycles_completed: u64,
    pub session_duration_sec: f32,
    pub tempo_scale: f32,
    pub belief: FfiBeliefState,
    pub resonance: FfiResonance,
    pub safety: FfiSafetyStatus,
}

// ============================================================================
// RUNTIME
// ============================================================================

struct SessionState {
    start_time: Instant,
    pattern_id: String,
    hr_samples: Vec<f32>,
    resonance_samples: Vec<f32>,
}

struct RuntimeInner {
    engine: Engine,
    phase_machine: PhaseMachine,
    processor: EnsembleProcessor,
    current_pattern_id: String,
    session: Option<SessionState>,
    last_timestamp_us: i64,
    status: FfiRuntimeStatus,
    tempo_scale: f32,
    safety_locked: bool,
    last_resonance: f32,
}

/// ZenOne Runtime - Full Engine API for native apps
pub struct ZenOneRuntime {
    inner: Mutex<RuntimeInner>,
}

impl ZenOneRuntime {
    /// Create a new runtime with default pattern (4-7-8)
    pub fn new() -> Self {
        Self::with_pattern("4-7-8".to_string())
    }

    /// Create with specific pattern
    pub fn with_pattern(pattern_id: String) -> Self {
        let patterns = builtin_patterns();
        let pattern = patterns
            .get(&pattern_id)
            .or_else(|| patterns.get("4-7-8"))
            .unwrap();

        let durations = pattern.to_phase_durations();

        ZenOneRuntime {
            inner: Mutex::new(RuntimeInner {
                engine: Engine::new(6.0), // Default BPM for phase timing
                phase_machine: PhaseMachine::new(durations),
                processor: EnsembleProcessor::new(),
                current_pattern_id: pattern_id,
                session: None,
                last_timestamp_us: 0,
                status: FfiRuntimeStatus::Idle,
                tempo_scale: 1.0,
                safety_locked: false,
                last_resonance: 0.0,
            }),
        }
    }

    // =========================================================================
    // PATTERN MANAGEMENT
    // =========================================================================

    /// Get all available patterns
    pub fn get_patterns(&self) -> Vec<FfiBreathPattern> {
        builtin_patterns()
            .values()
            .map(|p| FfiBreathPattern::from(p))
            .collect()
    }

    /// Load a pattern by ID
    pub fn load_pattern(&self, pattern_id: String) -> bool {
        let patterns = builtin_patterns();
        if let Some(pattern) = patterns.get(&pattern_id) {
            let mut inner = self.inner.lock().unwrap();
            
            // Safety check: reject if locked
            if inner.safety_locked {
                log::warn!("Cannot load pattern while safety locked");
                return false;
            }
            
            inner.phase_machine = PhaseMachine::new(pattern.to_phase_durations());
            inner.current_pattern_id = pattern_id;
            true
        } else {
            false
        }
    }

    /// Get current pattern ID
    pub fn current_pattern_id(&self) -> String {
        self.inner.lock().unwrap().current_pattern_id.clone()
    }

    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    /// Start a breathing session
    pub fn start_session(&self) -> Result<(), ZenOneError> {
        let mut inner = self.inner.lock().unwrap();

        // Safety check
        if inner.safety_locked {
            return Err(ZenOneError::SafetyViolation(
                "Cannot start session while safety locked".into(),
            ));
        }

        let patterns = builtin_patterns();
        let pattern = patterns
            .get(&inner.current_pattern_id)
            .or_else(|| patterns.get("4-7-8"));

        if let Some(pattern) = pattern {
            inner.phase_machine = PhaseMachine::new(pattern.to_phase_durations());
        }

        inner.processor = EnsembleProcessor::new();
        inner.last_timestamp_us = 0;
        inner.status = FfiRuntimeStatus::Running;
        inner.session = Some(SessionState {
            start_time: Instant::now(),
            pattern_id: inner.current_pattern_id.clone(),
            hr_samples: Vec::new(),
            resonance_samples: Vec::new(),
        });

        Ok(())
    }

    /// Stop session and get stats
    pub fn stop_session(&self) -> FfiSessionStats {
        let mut inner = self.inner.lock().unwrap();
        inner.status = FfiRuntimeStatus::Idle;

        if let Some(session) = inner.session.take() {
            let duration = session.start_time.elapsed();
            let avg_hr = if !session.hr_samples.is_empty() {
                Some(session.hr_samples.iter().sum::<f32>() / session.hr_samples.len() as f32)
            } else {
                None
            };
            let avg_resonance = if !session.resonance_samples.is_empty() {
                session.resonance_samples.iter().sum::<f32>()
                    / session.resonance_samples.len() as f32
            } else {
                0.0
            };

            FfiSessionStats {
                duration_sec: duration.as_secs_f32(),
                cycles_completed: inner.phase_machine.cycle_index,
                pattern_id: session.pattern_id,
                avg_heart_rate: avg_hr,
                final_belief: get_engine_belief(&inner.engine),
                avg_resonance,
            }
        } else {
            FfiSessionStats {
                duration_sec: 0.0,
                cycles_completed: 0,
                pattern_id: String::new(),
                avg_heart_rate: None,
                final_belief: FfiBeliefState {
                    probabilities: vec![0.0; 5],
                    confidence: 0.0,
                    mode: FfiBeliefMode::Calm,
                    uncertainty: 1.0,
                },
                avg_resonance: 0.0,
            }
        }
    }

    /// Check if session is active
    pub fn is_session_active(&self) -> bool {
        self.inner.lock().unwrap().session.is_some()
    }

    /// Pause session
    pub fn pause_session(&self) {
        let mut inner = self.inner.lock().unwrap();
        if inner.status == FfiRuntimeStatus::Running {
            inner.status = FfiRuntimeStatus::Paused;
        }
    }

    /// Resume paused session
    pub fn resume_session(&self) {
        let mut inner = self.inner.lock().unwrap();
        if inner.status == FfiRuntimeStatus::Paused {
            inner.status = FfiRuntimeStatus::Running;
        }
    }

    // =========================================================================
    // FRAME PROCESSING (Main update loop)
    // =========================================================================

    /// Process a camera frame and update state
    pub fn process_frame(&self, r: f32, g: f32, b: f32, timestamp_us: i64) -> FfiFrame {
        let mut inner = self.inner.lock().unwrap();

        // Calculate delta time
        let dt_us = if inner.last_timestamp_us > 0 {
            (timestamp_us - inner.last_timestamp_us).max(0) as u64
        } else {
            33_333 // ~30fps default
        };
        inner.last_timestamp_us = timestamp_us;

        // rPPG processing
        inner.processor.add_sample(r, g, b);
        let ppg_result = inner.processor.process();

        // Build sensor features for Engine
        let hr = ppg_result.as_ref().map(|r| r.bpm);
        let quality = ppg_result.as_ref().map(|r| r.confidence).unwrap_or(0.0);

        // Ingest sensor data into Engine
        let features = [
            hr.unwrap_or(0.0),
            0.0, // HRV placeholder
            0.0, // RR placeholder
            quality,
            0.0, // Motion placeholder
        ];
        let _estimate = inner.engine.ingest_sensor(&features, timestamp_us);

        // Update phase machine
        let (_transitions, _cycles) = inner.phase_machine.tick(dt_us);

        // Get resonance from Engine
        let resonance_score = inner.engine.resonance_score_ema;
        inner.last_resonance = resonance_score;

        // Track metrics for session
        if let Some(ref mut session) = inner.session {
            if let Some(hr_val) = hr {
                session.hr_samples.push(hr_val);
            }
            session.resonance_samples.push(resonance_score);
        }

        // Build response
        let belief = get_engine_belief(&inner.engine);
        let resonance = FfiResonance {
            coherence_score: resonance_score,
            phase_locking: inner.engine.resonance_score_ema, // Simplified
            rhythm_alignment: resonance_score,
        };

        FfiFrame {
            phase: FfiPhase::from(inner.phase_machine.phase.clone()),
            phase_progress: inner.phase_machine.cycle_phase_norm(),
            cycles_completed: inner.phase_machine.cycle_index,
            heart_rate: hr,
            signal_quality: quality,
            belief,
            resonance,
        }
    }

    /// Tick without camera (timer-based update)
    pub fn tick(&self, dt_sec: f32, timestamp_us: i64) -> FfiFrame {
        let mut inner = self.inner.lock().unwrap();

        let dt_us = (dt_sec * 1_000_000.0) as u64;
        inner.last_timestamp_us = timestamp_us;

        // Update phase machine
        let (_transitions, _cycles) = inner.phase_machine.tick(dt_us);

        // Tick engine
        let _cycles = inner.engine.tick(dt_us);

        let belief = get_engine_belief(&inner.engine);
        let resonance = FfiResonance {
            coherence_score: inner.last_resonance,
            phase_locking: inner.last_resonance,
            rhythm_alignment: inner.last_resonance,
        };

        FfiFrame {
            phase: FfiPhase::from(inner.phase_machine.phase.clone()),
            phase_progress: inner.phase_machine.cycle_phase_norm(),
            cycles_completed: inner.phase_machine.cycle_index,
            heart_rate: None,
            signal_quality: 0.0,
            belief,
            resonance,
        }
    }

    // =========================================================================
    // STATE QUERIES
    // =========================================================================

    /// Get full runtime state snapshot
    pub fn get_state(&self) -> FfiRuntimeState {
        let inner = self.inner.lock().unwrap();

        let session_duration = inner
            .session
            .as_ref()
            .map(|s| s.start_time.elapsed().as_secs_f32())
            .unwrap_or(0.0);

        FfiRuntimeState {
            status: inner.status,
            pattern_id: inner.current_pattern_id.clone(),
            phase: FfiPhase::from(inner.phase_machine.phase.clone()),
            phase_progress: inner.phase_machine.cycle_phase_norm(),
            cycles_completed: inner.phase_machine.cycle_index,
            session_duration_sec: session_duration,
            tempo_scale: inner.tempo_scale,
            belief: get_engine_belief(&inner.engine),
            resonance: FfiResonance {
                coherence_score: inner.last_resonance,
                phase_locking: inner.last_resonance,
                rhythm_alignment: inner.last_resonance,
            },
            safety: FfiSafetyStatus {
                is_locked: inner.safety_locked,
                trauma_count: 0, // Would need cache access
                tempo_bounds: vec![0.8, 1.4],
                hr_bounds: vec![30.0, 220.0],
            },
        }
    }

    /// Get current belief state
    pub fn get_belief(&self) -> FfiBeliefState {
        let inner = self.inner.lock().unwrap();
        get_engine_belief(&inner.engine)
    }

    /// Get safety status
    pub fn get_safety_status(&self) -> FfiSafetyStatus {
        let inner = self.inner.lock().unwrap();
        FfiSafetyStatus {
            is_locked: inner.safety_locked,
            trauma_count: 0,
            tempo_bounds: vec![0.8, 1.4],
            hr_bounds: vec![30.0, 220.0],
        }
    }

    // =========================================================================
    // CONTROL ACTIONS
    // =========================================================================

    /// Adjust tempo scale (with safety bounds)
    pub fn adjust_tempo(&self, scale: f32, reason: String) -> Result<f32, ZenOneError> {
        let mut inner = self.inner.lock().unwrap();

        // Safety bounds [0.8, 1.4]
        const MIN_TEMPO: f32 = 0.8;
        const MAX_TEMPO: f32 = 1.4;

        let clamped = scale.clamp(MIN_TEMPO, MAX_TEMPO);
        if (clamped - scale).abs() > 0.001 {
            log::warn!(
                "Tempo {} clamped to {} (reason: {})",
                scale,
                clamped,
                reason
            );
        }

        inner.tempo_scale = clamped;
        Ok(clamped)
    }

    /// Update context (time of day, charging status, etc.)
    pub fn update_context(&self, local_hour: u8, is_charging: bool, recent_sessions: u16) {
        let mut inner = self.inner.lock().unwrap();
        inner.engine.update_context(Context {
            local_hour,
            is_charging,
            recent_sessions,
        });
    }

    /// Emergency halt
    pub fn emergency_halt(&self, reason: String) {
        let mut inner = self.inner.lock().unwrap();
        inner.status = FfiRuntimeStatus::SafetyLock;
        inner.safety_locked = true;
        log::error!("EMERGENCY HALT: {}", reason);
    }

    /// Reset safety lock (requires explicit action)
    pub fn reset_safety_lock(&self) {
        let mut inner = self.inner.lock().unwrap();
        inner.safety_locked = false;
        inner.status = FfiRuntimeStatus::Idle;
        log::info!("Safety lock reset");
    }
}
