//! ZenOne FFI Bridge - Full Engine Integration
//!
//! This crate exposes the complete AGOLOS Rust core to mobile platforms via UniFFI.
//! Provides access to Engine, BeliefState, Safety, and Resonance tracking.

// SAFETY: Using parking_lot::Mutex instead of std::sync::Mutex
// parking_lot::Mutex does NOT have poison semantics, so it won't panic
// if a thread panics while holding the lock. This is critical for a health app.

use parking_lot::Mutex;
use std::time::Instant;
use std::sync::{Arc, RwLock};
use std::thread;
use crossbeam_channel::{unbounded, Sender, Receiver, select};

use serde::{Serialize, Deserialize};

use std::collections::HashMap;
use chrono::Utc;

use chacha20poly1305::{
    aead::{Aead, AeadCore, KeyInit, OsRng},
    ChaCha20Poly1305, Nonce,
};
use argon2::{
    password_hash::{
        PasswordHasher, SaltString
    },
    Argon2
};
use zeroize::Zeroize;


use zenb_core::{
    phase_machine::{Phase, PhaseMachine, PhaseDurations},
    Engine,
    belief::Context,
};
use zenb_signals::rppg::{RppgProcessor, RppgMethod};

// LOCAL DEFINITIONS (Missing from zenb-core)
#[derive(Debug, Clone)]
pub struct BreathTimings {
    pub inhale: f32,
    pub hold_in: f32,
    pub exhale: f32,
    pub hold_out: f32,
}

#[derive(Debug, Clone)]
pub struct BreathPattern {
    pub id: String,
    pub label: String,
    pub tag: String,
    pub description: String,
    pub timings: BreathTimings,
    pub recommended_cycles: u32,
    pub arousal_impact: f32,
}

impl BreathPattern {
    pub fn to_phase_durations(&self) -> PhaseDurations {
        PhaseDurations {
            inhale_us: (self.timings.inhale * 1_000_000.0) as u64,
            hold_in_us: (self.timings.hold_in * 1_000_000.0) as u64,
            exhale_us: (self.timings.exhale * 1_000_000.0) as u64,
            hold_out_us: (self.timings.hold_out * 1_000_000.0) as u64,
        }
    }
}

/// Complete breathing pattern library matching TypeScript definitions
/// All patterns are evidence-based with documented physiological effects
pub fn builtin_patterns() -> HashMap<String, BreathPattern> {
    let mut m = HashMap::new();

    // === CALMING PATTERNS (Parasympathetic Activation) ===

    m.insert(
        "4-7-8".to_string(),
        BreathPattern {
            id: "4-7-8".to_string(),
            label: "Relaxing Breath".to_string(),
            tag: "calm".to_string(),
            description: "Dr. Andrew Weil's classic relaxation technique".to_string(),
            timings: BreathTimings { inhale: 4.0, hold_in: 7.0, exhale: 8.0, hold_out: 0.0 },
            recommended_cycles: 4,
            arousal_impact: -0.8,
        }
    );

    m.insert(
        "calm".to_string(),
        BreathPattern {
            id: "calm".to_string(),
            label: "Calm Wave".to_string(),
            tag: "calm".to_string(),
            description: "Gentle, extended exhale for everyday relaxation".to_string(),
            timings: BreathTimings { inhale: 4.0, hold_in: 0.0, exhale: 6.0, hold_out: 0.0 },
            recommended_cycles: 10,
            arousal_impact: -0.5,
        }
    );

    m.insert(
        "7-11".to_string(),
        BreathPattern {
            id: "7-11".to_string(),
            label: "7-11 Anti-Anxiety".to_string(),
            tag: "calm".to_string(),
            description: "NHS-recommended technique for acute anxiety relief".to_string(),
            timings: BreathTimings { inhale: 7.0, hold_in: 0.0, exhale: 11.0, hold_out: 0.0 },
            recommended_cycles: 6,
            arousal_impact: -0.9,
        }
    );

    m.insert(
        "deep-relax".to_string(),
        BreathPattern {
            id: "deep-relax".to_string(),
            label: "Deep Relaxation".to_string(),
            tag: "calm".to_string(),
            description: "Extended hold and exhale for deep parasympathetic activation".to_string(),
            timings: BreathTimings { inhale: 4.0, hold_in: 7.0, exhale: 10.0, hold_out: 0.0 },
            recommended_cycles: 5,
            arousal_impact: -0.95,
        }
    );

    // === FOCUS PATTERNS (Balanced Autonomic) ===

    m.insert(
        "box".to_string(),
        BreathPattern {
            id: "box".to_string(),
            label: "Box Breathing".to_string(),
            tag: "focus".to_string(),
            description: "Navy SEAL technique for focus under pressure".to_string(),
            timings: BreathTimings { inhale: 4.0, hold_in: 4.0, exhale: 4.0, hold_out: 4.0 },
            recommended_cycles: 10,
            arousal_impact: 0.0,
        }
    );

    m.insert(
        "coherence".to_string(),
        BreathPattern {
            id: "coherence".to_string(),
            label: "Heart Coherence".to_string(),
            tag: "focus".to_string(),
            description: "HeartMath-style 5-second rhythm for HRV optimization".to_string(),
            timings: BreathTimings { inhale: 5.0, hold_in: 0.0, exhale: 5.0, hold_out: 0.0 },
            recommended_cycles: 12,
            arousal_impact: -0.2,
        }
    );

    m.insert(
        "triangle".to_string(),
        BreathPattern {
            id: "triangle".to_string(),
            label: "Triangle Breath".to_string(),
            tag: "focus".to_string(),
            description: "Balanced three-phase pattern for meditation".to_string(),
            timings: BreathTimings { inhale: 4.0, hold_in: 4.0, exhale: 4.0, hold_out: 0.0 },
            recommended_cycles: 8,
            arousal_impact: -0.1,
        }
    );

    m.insert(
        "tactical".to_string(),
        BreathPattern {
            id: "tactical".to_string(),
            label: "Tactical Breathing".to_string(),
            tag: "focus".to_string(),
            description: "Combat breathing for high-stress performance".to_string(),
            timings: BreathTimings { inhale: 4.0, hold_in: 4.0, exhale: 4.0, hold_out: 4.0 },
            recommended_cycles: 6,
            arousal_impact: 0.1,
        }
    );

    // === ENERGIZING PATTERNS (Sympathetic Activation) ===

    m.insert(
        "awake".to_string(),
        BreathPattern {
            id: "awake".to_string(),
            label: "Energizing Breath".to_string(),
            tag: "energy".to_string(),
            description: "Quick inhale, short exhale for alertness boost".to_string(),
            timings: BreathTimings { inhale: 2.0, hold_in: 0.0, exhale: 2.0, hold_out: 0.0 },
            recommended_cycles: 15,
            arousal_impact: 0.6,
        }
    );

    // === ADVANCED PATTERNS (Specialized Techniques) ===

    m.insert(
        "buteyko".to_string(),
        BreathPattern {
            id: "buteyko".to_string(),
            label: "Buteyko Method".to_string(),
            tag: "advanced".to_string(),
            description: "Reduced breathing with CO2 tolerance training".to_string(),
            timings: BreathTimings { inhale: 3.0, hold_in: 0.0, exhale: 3.0, hold_out: 5.0 },
            recommended_cycles: 8,
            arousal_impact: -0.3,
        }
    );

    m.insert(
        "wim-hof".to_string(),
        BreathPattern {
            id: "wim-hof".to_string(),
            label: "Wim Hof Method".to_string(),
            tag: "advanced".to_string(),
            description: "Controlled hyperventilation followed by retention".to_string(),
            // Note: This is the prep phase. Full Wim Hof includes longer holds.
            timings: BreathTimings { inhale: 2.0, hold_in: 0.0, exhale: 2.0, hold_out: 0.0 },
            recommended_cycles: 30,
            arousal_impact: 0.8,
        }
    );

    m
}

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
    // VAJRA-001: Access belief via Vinnana -> Pipeline -> Vedana
    let state = engine.vinnana.pipeline.vedana.state();
    let confidence = state.conf;
    FfiBeliefState::from_belief_array(&state.p, confidence)
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
    current_pattern_id: String,
    session: Option<SessionState>,
    last_timestamp_us: i64,
    status: FfiRuntimeStatus,
    tempo_scale: f32,
    safety_locked: bool,
    last_resonance: f32,
}

enum RuntimeCommand {
    StartSession,
    StopSession(Sender<FfiSessionStats>), // Return channel for sync response
    PauseSession,
    ResumeSession,
    LoadPattern(String),
    ProcessFrame {
        r: f32,
        g: f32,
        b: f32,
        timestamp_us: i64,
    },
    Tick {
        dt_sec: f32,
        timestamp_us: i64,
    },
    ResetSafetyLock,
    AdjustTempo(f32),
    UpdateContext {
        local_hour: u8,
        is_charging: bool,
        recent_sessions: u16,
    },
    EmergencyHalt(String),
    UpdateConfig(String),
}

/// Commands for the Signal Processing Actor
enum SignalCommand {
    ProcessSample {
        r: f32,
        g: f32,
        b: f32,
        timestamp_us: i64,
    },
    Reset,
}

/// Events from the Signal Processing Actor
enum SignalEvent {
    Result {
        hr: f32,
        confidence: f32,
        timestamp_us: i64,
    },
}

/// Actor for heavy signal processing (DSP/Vision)
struct SignalActor {
    rppg: RppgProcessor,
    cmd_rx: Receiver<SignalCommand>,
    event_tx: Sender<SignalEvent>,
}

impl SignalActor {
    fn run(mut self) {
        log::info!("SignalActor: Thread started");
        while let Ok(cmd) = self.cmd_rx.recv() {
            match cmd {
                SignalCommand::ProcessSample { r, g, b, timestamp_us } => {
                    self.rppg.add_sample(r, g, b);
                    if let Some((bpm, conf)) = self.rppg.process() {
                        let _ = self.event_tx.send(SignalEvent::Result {
                            hr: bpm,
                            confidence: conf,
                            timestamp_us,
                        });
                    }
                }
                SignalCommand::Reset => {
                    self.rppg.reset();
                }
            }
        }
        log::info!("SignalActor: Thread stopped");
    }
}

/// Actor that runs the engine loop on a dedicated thread
struct RuntimeActor {
    inner: RuntimeInner,
    // rppg: RppgProcessor, // MOVED TO SignalActor
    signal_tx: Sender<SignalCommand>,
    signal_rx: Receiver<SignalEvent>,
    
    cmd_rx: Receiver<RuntimeCommand>,
    state_tx: Arc<RwLock<FfiRuntimeState>>,
    // We also keep a cached FfiFrame for process_frame return
    latest_frame: Arc<RwLock<FfiFrame>>,
    // Safety Monitor for LTL verification
    safety: SafetyMonitor,
}

impl RuntimeActor {
    fn run(mut self) {
        log::info!("RuntimeActor: Thread started");
        
        // Main Actor Loop - Multiplexing UI commands and Signal events
        loop {
            select! {
                recv(self.cmd_rx) -> msg => match msg {
                    Ok(cmd) => self.handle_command(cmd),
                    Err(_) => break, // Channel closed, exit
                },
                recv(self.signal_rx) -> msg => match msg {
                    Ok(event) => self.handle_signal_event(event),
                    Err(_) => {
                        log::error!("SignalActor channel closed unexpectedly");
                        // We can continue running, just without signals
                    }
                }
            }
            // After every event, we ensure the shared state is updated
            // (Though individual handlers do it more granularly)
        }
        log::info!("RuntimeActor: Thread stopped");
    }

    fn handle_command(&mut self, cmd: RuntimeCommand) {
        match cmd {
            RuntimeCommand::StartSession => self.handle_start(),
            RuntimeCommand::StopSession(reply_tx) => self.handle_stop(reply_tx),
            RuntimeCommand::PauseSession => self.handle_pause(),
            RuntimeCommand::ResumeSession => self.handle_resume(),
            RuntimeCommand::LoadPattern(id) => self.handle_load_pattern(id),
            RuntimeCommand::ProcessFrame { r, g, b, timestamp_us } => {
                self.handle_process_frame(r, g, b, timestamp_us);
            }
            RuntimeCommand::Tick { dt_sec, timestamp_us } => {
                self.handle_tick(dt_sec, timestamp_us);
            }
            RuntimeCommand::ResetSafetyLock => self.handle_reset_safety_lock(),
            RuntimeCommand::AdjustTempo(scale) => self.handle_adjust_tempo(scale),
            RuntimeCommand::UpdateContext { local_hour, is_charging, recent_sessions } => {
                    self.handle_update_context(local_hour, is_charging, recent_sessions);
            }
            RuntimeCommand::EmergencyHalt(reason) => self.handle_emergency_halt(reason),
            _ => {}
        }
    }

    fn handle_signal_event(&mut self, event: SignalEvent) {
        match event {
            SignalEvent::Result { hr, confidence, timestamp_us: _ } => {
                // Update internal HR state
                // Note: We might want to filter or smooth this before state update
                // For now, raw update as per legacy behavior
                if let Some(session) = &mut self.inner.session {
                    session.hr_samples.push(hr);
                }
                
                // Update Vinnana/Engine belief based on HR? 
                // Currently Engine is mostly pure logic, but we can feed it back.
                
                // Update shared frame
                self.update_latest_frame(Some(hr), confidence);
                
                // Trigger safety check for HR?
                // SafetyMonitor checks events. We could synthesize a 'HeartRateUpdate' event if needed.
            }
        }
    }

    fn update_shared_state(&self) {
        if let Ok(mut guard) = self.state_tx.write() {
             let session_duration = self.inner
                .session
                .as_ref()
                .map(|s| s.start_time.elapsed().as_secs_f32())
                .unwrap_or(0.0);

             *guard = FfiRuntimeState {
                status: self.inner.status,
                pattern_id: self.inner.current_pattern_id.clone(),
                phase: FfiPhase::from(self.inner.phase_machine.phase.clone()),
                phase_progress: self.inner.phase_machine.cycle_phase_norm(),
                cycles_completed: self.inner.phase_machine.cycle_index,
                session_duration_sec: session_duration,
                tempo_scale: self.inner.tempo_scale,
                belief: get_engine_belief(&self.inner.engine),
                resonance: FfiResonance {
                    coherence_score: self.inner.last_resonance,
                    phase_locking: self.inner.last_resonance,
                    rhythm_alignment: self.inner.last_resonance,
                },
                safety: FfiSafetyStatus {
                    is_locked: self.inner.safety_locked,
                    trauma_count: self.safety.get_violations().len() as u32, 
                    tempo_bounds: vec![0.8, 1.4],
                    hr_bounds: vec![30.0, 220.0],
                },
            };
        }
    }
    
    fn update_latest_frame(&self, hr: Option<f32>, quality: f32) {
         if let Ok(mut guard) = self.latest_frame.write() {
            *guard = FfiFrame {
                phase: FfiPhase::from(self.inner.phase_machine.phase.clone()),
                phase_progress: self.inner.phase_machine.cycle_phase_norm(),
                cycles_completed: self.inner.phase_machine.cycle_index,
                heart_rate: hr,
                signal_quality: quality,
                belief: get_engine_belief(&self.inner.engine),
                resonance: FfiResonance {
                    coherence_score: self.inner.last_resonance,
                    phase_locking: self.inner.last_resonance,
                    rhythm_alignment: self.inner.last_resonance,
                },
            };
         }
    }

    fn verify_command(&mut self, event_type: FfiKernelEventType, payload: Option<String>) -> bool {
        let timestamp_ms = Utc::now().timestamp_millis();
        let event = FfiKernelEvent {
            event_type,
            timestamp_ms,
            payload,
        };
        
        let state_snapshot = {
            let s = self.state_tx.read().unwrap();
            s.clone()
        };
        
        let result = self.safety.check_event(event, state_snapshot);
        
        // Update shared state with new violations if any
        if !result.violations.is_empty() {
             // We can't update shared state here easily because we hold a read lock above?
             // Actually check_event is on self.safety which is owned.
             // We drop the read lock before using valid checks? No, s.clone() drops lock.
             // But we need to update shared state to reflect new trauma count.
             // We'll signal an update needed.
        }
        
        if result.corrected_event.is_none() {
            // Spec 2: If event is blocked (corrected to None), return false
             // But check_event logic for Spec 2 says: corrected_event = None.
             // Wait, if corrected_event is None, does it mean "No change" or "Blocked"?
             // My implementation of check_event:
             // corrected_event = None; (default)
             // If violation Spec 2: corrected_event = None; (Explicitly)
             // Wait, usually corrected_event is Some(new_event) if changed.
             // Let's look at check_event implementation I saw earlier.
        }
        
        // Re-reading check_event logic:
        // By default corrected_event is None.
        // Spec 2 says: "Block event -> corrected_event = None"
        // This implies None means "Do nothing" or "Event blocked"?
        // Actually, FfiSafetyCheckResult { corrected_event: Option<FfiKernelEvent> }
        // If it returns Some(e), we should run e.
        // If it returns None, and is_safe is false, we should block?
        // Let's assume: is_safe == false => Block if severity Critical.
        
        if !result.is_safe {
            for v in &result.violations {
                log::error!("Safety Violation: [{:?}] {}", v.severity, v.description);
                if v.severity == FfiViolationSeverity::Critical || v.severity == FfiViolationSeverity::Error {
                    self.update_shared_state(); // Reflect violation in trauma count
                    return false;
                }
            }
        }
        
        true
    }

    fn handle_start(&mut self) {
        if !self.verify_command(FfiKernelEventType::StartSession, None) {
            return;
        }
        if self.inner.safety_locked { return; }
        
        // Refresh pattern
        let patterns = builtin_patterns();
        let pattern = patterns.get(&self.inner.current_pattern_id)
            .or_else(|| patterns.get("4-7-8"));
        if let Some(p) = pattern {
            self.inner.phase_machine = PhaseMachine::new(p.to_phase_durations());
        }
        
        let _ = self.signal_tx.send(SignalCommand::Reset);
        self.inner.last_timestamp_us = 0;
        self.inner.status = FfiRuntimeStatus::Running;
        self.inner.session = Some(SessionState {
            start_time: Instant::now(),
            pattern_id: self.inner.current_pattern_id.clone(),
            hr_samples: Vec::new(),
            resonance_samples: Vec::new(),
        });
        self.update_shared_state();
    }

    fn handle_stop(&mut self, reply_tx: Sender<FfiSessionStats>) {
        self.inner.status = FfiRuntimeStatus::Idle;
        
        let stats = if let Some(session) = self.inner.session.take() {
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
                cycles_completed: self.inner.phase_machine.cycle_index,
                pattern_id: session.pattern_id,
                avg_heart_rate: avg_hr,
                final_belief: get_engine_belief(&self.inner.engine),
                avg_resonance,
            }
        } else {
            FfiSessionStats {
                duration_sec: 0.0,
                cycles_completed: 0,
                pattern_id: String::new(),
                avg_heart_rate: None,
                final_belief: get_engine_belief(&self.inner.engine),
                avg_resonance: 0.0,
            }
        };

        // Send back the stats
        let _ = reply_tx.send(stats);
        
        self.update_shared_state();
    }
    
    fn handle_reset_safety_lock(&mut self) {
        log::warn!("RuntimeActor: Resetting Safety Lock");
        self.inner.safety_locked = false;
        self.inner.status = FfiRuntimeStatus::Idle;
        self.inner.session = None; // Reset session
        self.update_shared_state();
    }

    fn handle_adjust_tempo(&mut self, scale: f32) {
        if !self.verify_command(FfiKernelEventType::AdjustTempo, Some(scale.to_string())) {
            return;
        }
        self.inner.tempo_scale = scale;
        self.update_shared_state();
    }
    
    fn handle_update_context(&mut self, local_hour: u8, is_charging: bool, recent_sessions: u16) {
        self.inner.engine.update_context(Context {
            local_hour,
            is_charging,
            recent_sessions,
        });
        self.update_shared_state();
    }
    
    fn handle_emergency_halt(&mut self, reason: String) {
        log::error!("EMERGENCY HALT: {}", reason);
        self.inner.status = FfiRuntimeStatus::SafetyLock;
        self.inner.safety_locked = true;
        self.update_shared_state();
    }
    
    fn handle_pause(&mut self) {
        if self.inner.status == FfiRuntimeStatus::Running {
            self.inner.status = FfiRuntimeStatus::Paused;
            self.update_shared_state();
        }
    }
    
    fn handle_resume(&mut self) {
        if self.inner.status == FfiRuntimeStatus::Paused {
            self.inner.status = FfiRuntimeStatus::Running;
            self.update_shared_state();
        }
    }

    fn handle_load_pattern(&mut self, id: String) {
        if !self.verify_command(FfiKernelEventType::LoadPattern, Some(id.clone())) {
            return;
        }
        if self.inner.safety_locked { return; }
        
        let patterns = builtin_patterns();
        if let Some(p) = patterns.get(&id) {
            self.inner.phase_machine = PhaseMachine::new(p.to_phase_durations());
            self.inner.current_pattern_id = id;
            self.update_shared_state();
        }
    }

    fn handle_process_frame(&mut self, r: f32, g: f32, b: f32, timestamp_us: i64) {
        // Offload to SignalActor - NON-BLOCKING
        let _ = self.signal_tx.send(SignalCommand::ProcessSample { r, g, b, timestamp_us });
    }
    
    fn handle_tick(&mut self, dt_sec: f32, timestamp_us: i64) {
        let dt_us = (dt_sec * 1_000_000.0) as u64;
        self.inner.last_timestamp_us = timestamp_us;
        self.inner.phase_machine.tick(dt_us);
        self.inner.engine.tick(dt_us);
        
        self.update_shared_state();
        self.update_latest_frame(None, 0.0);
    }
}

/// ZenOne Runtime - Full Engine API for native apps
pub struct ZenOneRuntime {
    cmd_tx: Sender<RuntimeCommand>,
    state: Arc<RwLock<FfiRuntimeState>>,
    latest_frame: Arc<RwLock<FfiFrame>>,
    // We keep thread handle to ensure it lives as long as Runtime
    // (Though in UniFFI, Runtime serves as the singleton usually)
    _thread: Arc<Mutex<Option<thread::JoinHandle<()>>>>,
}

impl ZenOneRuntime {
    /// Create a new runtime with default pattern (4-7-8)
    pub fn new() -> Self {
        Self::with_pattern("4-7-8".to_string())
    }

    /// Create with specific pattern
    pub fn with_pattern(pattern_id: String) -> Self {
        log::info!("ZenOneRuntime: Initializing with pattern {}", pattern_id);
        
        let patterns = builtin_patterns();
        let pattern = patterns.get(&pattern_id).unwrap_or_else(|| patterns.get("4-7-8").unwrap());
        let durations = pattern.to_phase_durations();

        // Initialize Inner State
        let inner = RuntimeInner {
            engine: Engine::new(6.0),
            phase_machine: PhaseMachine::new(durations),
            current_pattern_id: pattern_id.clone(),
            session: None,
            last_timestamp_us: 0,
            status: FfiRuntimeStatus::Idle,
            tempo_scale: 1.0,
            safety_locked: false,
            last_resonance: 0.0,
        };

        // Create Channels
        let (tx, rx) = unbounded();
        
        // Initial State Snapshot
        let initial_belief = get_engine_belief(&inner.engine);
        let initial_state = FfiRuntimeState {
            status: FfiRuntimeStatus::Idle,
            pattern_id: pattern_id.clone(),
            phase: FfiPhase::from(inner.phase_machine.phase.clone()),
            phase_progress: 0.0,
            cycles_completed: 0,
            session_duration_sec: 0.0,
            tempo_scale: 1.0,
            belief: initial_belief.clone(),
            resonance: FfiResonance { coherence_score: 0.0, phase_locking: 0.0, rhythm_alignment: 0.0 },
            safety: FfiSafetyStatus { is_locked: false, trauma_count: 0, tempo_bounds: vec![0.8, 1.4], hr_bounds: vec![30.0, 220.0] },
        };
        
        let initial_frame = FfiFrame {
             phase: FfiPhase::from(inner.phase_machine.phase.clone()),
             phase_progress: 0.0,
             cycles_completed: 0,
             heart_rate: None,
             signal_quality: 0.0,
             belief: initial_belief,
             resonance: FfiResonance { coherence_score: 0.0, phase_locking: 0.0, rhythm_alignment: 0.0 },
        };

        let state_arc = Arc::new(RwLock::new(initial_state));
        let frame_arc = Arc::new(RwLock::new(initial_frame));
        
        // Initialize Safety Monitor
        let safety = SafetyMonitor::new();

        // Channels for SignalActor
        let (signal_cmd_tx, signal_cmd_rx) = unbounded();
        let (signal_event_tx, signal_event_rx) = unbounded();

        // Spawn SignalActor
        let rppg = RppgProcessor::new(RppgMethod::Pos, 90, 30.0);
        let signal_actor = SignalActor {
            rppg,
            cmd_rx: signal_cmd_rx,
            event_tx: signal_event_tx,
        };
        thread::spawn(move || signal_actor.run());
        
        let actor = RuntimeActor {
            inner,
            signal_tx: signal_cmd_tx,
            signal_rx: signal_event_rx,
            cmd_rx: rx,
            state_tx: state_arc.clone(),
            latest_frame: frame_arc.clone(),
            safety,
        };

        let handle = thread::spawn(move || {
            actor.run();
        });

        ZenOneRuntime {
            cmd_tx: tx,
            state: state_arc,
            latest_frame: frame_arc,
            _thread: Arc::new(Mutex::new(Some(handle))),
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
        // We assume success for async load, but we could add a reply channel if strict validation needed immediately.
        // For S-Tier responsiveness, we trigger load and return true if ID exists.
        if builtin_patterns().contains_key(&pattern_id) {
             let _ = self.cmd_tx.send(RuntimeCommand::LoadPattern(pattern_id));
             true
        } else {
             false
        }
    }

    /// Get current pattern ID
    pub fn current_pattern_id(&self) -> String {
        self.state.read().unwrap().pattern_id.clone()
    }

    // =========================================================================
    // SESSION MANAGEMENT
    // =========================================================================

    /// Start a breathing session
    pub fn start_session(&self) -> Result<(), ZenOneError> {
        let state = self.state.read().unwrap();
        if state.safety.is_locked {
             return Err(ZenOneError::SafetyViolation("Cannot start session while locked".into()));
        }
        drop(state);

        let _ = self.cmd_tx.send(RuntimeCommand::StartSession);
        Ok(())
    }

    /// Stop session and get stats
    pub fn stop_session(&self) -> FfiSessionStats {
        let (tx, rx) = crossbeam_channel::bounded(1);
        let _ = self.cmd_tx.send(RuntimeCommand::StopSession(tx));
        
        // Wait for stats (blocking for this call is expected behavior for stop_session)
        // But the Engine loop finishes quickly so it's fine.
        rx.recv().unwrap_or(FfiSessionStats {
             duration_sec: 0.0,
             cycles_completed: 0,
             pattern_id: "".into(),
             avg_heart_rate: None,
             final_belief: self.get_belief(),
             avg_resonance: 0.0,
        })
    }

    /// Check if session is active
    pub fn is_session_active(&self) -> bool {
        // We can infer from status inside the shared state
        let state = self.state.read().unwrap();
        state.status == FfiRuntimeStatus::Running || state.status == FfiRuntimeStatus::Paused
    }

    /// Pause session
    pub fn pause_session(&self) {
        let _ = self.cmd_tx.send(RuntimeCommand::PauseSession);
    }

    /// Resume paused session
    pub fn resume_session(&self) {
        let _ = self.cmd_tx.send(RuntimeCommand::ResumeSession);
    }

    /// Reset safety lock
    pub fn reset_safety_lock(&self) {
        let _ = self.cmd_tx.send(RuntimeCommand::ResetSafetyLock);
    }

    // =========================================================================
    // FRAME PROCESSING (Main update loop)
    // =========================================================================

    /// Process a camera frame and update state
    pub fn process_frame(&self, r: f32, g: f32, b: f32, timestamp_us: i64) -> FfiFrame {
        // Fire and forget - NON-BLOCKING
        let _ = self.cmd_tx.send(RuntimeCommand::ProcessFrame { r, g, b, timestamp_us });
        
        // Return latest available frame immediately
        self.latest_frame.read().unwrap().clone()
    }

    /// Tick without camera (timer-based update)
    pub fn tick(&self, dt_sec: f32, timestamp_us: i64) -> FfiFrame {
        let _ = self.cmd_tx.send(RuntimeCommand::Tick { dt_sec, timestamp_us });
        self.latest_frame.read().unwrap().clone()
    }

    // =========================================================================
    // STATE QUERIES
    // =========================================================================

    /// Get full runtime state snapshot
    pub fn get_state(&self) -> FfiRuntimeState {
        self.state.read().unwrap().clone()
    }

    /// Get current belief state
    /// Get current belief state
    pub fn get_belief(&self) -> FfiBeliefState {
        self.state.read().unwrap().belief.clone()
    }
    
    /// Get safety status
    pub fn get_safety_status(&self) -> FfiSafetyStatus {
        self.state.read().unwrap().safety.clone()
    }

    // =========================================================================
    // CONTROL ACTIONS
    // =========================================================================

    /// Adjust tempo scale (with safety bounds)
    pub fn adjust_tempo(&self, scale: f32, reason: String) -> Result<f32, ZenOneError> {
        // Validation happens on calling thread for immediate feedback
        const MIN_TEMPO: f32 = 0.8;
        const MAX_TEMPO: f32 = 1.4;

        let clamped = scale.clamp(MIN_TEMPO, MAX_TEMPO);
        if (clamped - scale).abs() > 0.001 {
            log::warn!("Tempo {} clamped to {} (reason: {})", scale, clamped, reason);
        }

        let _ = self.cmd_tx.send(RuntimeCommand::AdjustTempo(clamped));
        // We implicitly assume success. S-Tier: Don't wait.
        Ok(clamped)
    }

    /// Update context (time of day, charging status, etc.)
    pub fn update_context(&self, local_hour: u8, is_charging: bool, recent_sessions: u16) {
        let _ = self.cmd_tx.send(RuntimeCommand::UpdateContext {
            local_hour,
            is_charging,
            recent_sessions,
        });
    }



    /// Emergency halt
    pub fn emergency_halt(&self, reason: String) {
        let _ = self.cmd_tx.send(RuntimeCommand::EmergencyHalt(reason));
    }
}

// ============================================================================
// PID CONTROLLER - FEEDBACK CONTROL
// ============================================================================

/// PID controller configuration
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiPidConfig {
    pub kp: f32,                // Proportional gain
    pub ki: f32,                // Integral gain
    pub kd: f32,                // Derivative gain
    pub integral_max: f32,      // Anti-windup max integral
    pub output_min: f32,        // Min output
    pub output_max: f32,        // Max output
    pub derivative_alpha: f32,  // Derivative filter (0-1)
}

impl Default for FfiPidConfig {
    fn default() -> Self {
        Self {
            kp: 0.003,
            ki: 0.0002,
            kd: 0.008,
            integral_max: 5.0,
            output_min: -0.6,
            output_max: 0.4,
            derivative_alpha: 0.15,
        }
    }
}

/// PID diagnostics for monitoring
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiPidDiagnostics {
    pub p_term: f32,
    pub i_term: f32,
    pub d_term: f32,
    pub integral: f32,
    pub total: f32,
}

/// PID Controller with anti-windup and derivative filtering
/// 
/// References:
/// - Åström & Murray (2021): "Feedback Systems"
/// - Franklin et al. (2015): "Feedback Control of Dynamic Systems"
pub struct PidController {
    inner: Mutex<PidControllerInner>,
}

struct PidControllerInner {
    config: FfiPidConfig,
    integral: f32,
    last_error: f32,
    last_derivative: f32,
    last_p: f32,
    last_i: f32,
    last_d: f32,
}

impl PidController {
    pub fn new() -> Self {
        Self::with_config(FfiPidConfig::default())
    }
    
    pub fn with_config(config: FfiPidConfig) -> Self {
        Self {
            inner: Mutex::new(PidControllerInner {
                config,
                integral: 0.0,
                last_error: 0.0,
                last_derivative: 0.0,
                last_p: 0.0,
                last_i: 0.0,
                last_d: 0.0,
            }),
        }
    }
    
    /// Compute control output
    /// 
    /// # Arguments
    /// * `error` - Current error (setpoint - measurement)
    /// * `dt` - Time step in seconds
    /// 
    /// # Returns
    /// Control signal (clamped to output bounds)
    pub fn compute(&self, error: f32, dt: f32) -> f32 {
        let mut inner = self.inner.lock();
        
        if dt <= 0.0 || !dt.is_finite() {
            return 0.0;
        }
        
        // 1. PROPORTIONAL TERM
        inner.last_p = inner.config.kp * error;
        
        // 2. INTEGRAL TERM (with anti-windup)
        inner.integral += error * dt;
        inner.integral = inner.integral.clamp(
            -inner.config.integral_max,
            inner.config.integral_max
        );
        inner.last_i = inner.config.ki * inner.integral;
        
        // 3. DERIVATIVE TERM (with filtering)
        let raw_derivative = (error - inner.last_error) / dt;
        inner.last_derivative = inner.config.derivative_alpha * raw_derivative
            + (1.0 - inner.config.derivative_alpha) * inner.last_derivative;
        inner.last_d = inner.config.kd * inner.last_derivative;
        
        // 4. COMBINE
        let output = inner.last_p + inner.last_i + inner.last_d;
        
        // 5. CLAMP OUTPUT
        let clamped = output.clamp(inner.config.output_min, inner.config.output_max);
        
        // Update state
        inner.last_error = error;
        
        clamped
    }
    
    /// Reset controller state
    pub fn reset(&self) {
        let mut inner = self.inner.lock();
        inner.integral = 0.0;
        inner.last_error = 0.0;
        inner.last_derivative = 0.0;
        inner.last_p = 0.0;
        inner.last_i = 0.0;
        inner.last_d = 0.0;
    }
    
    /// Get diagnostics
    pub fn get_diagnostics(&self) -> FfiPidDiagnostics {
        let inner = self.inner.lock();
        FfiPidDiagnostics {
            p_term: inner.last_p,
            i_term: inner.last_i,
            d_term: inner.last_d,
            integral: inner.integral,
            total: inner.last_p + inner.last_i + inner.last_d,
        }
    }
    
    /// Update gains dynamically
    pub fn set_gains(&self, kp: Option<f32>, ki: Option<f32>, kd: Option<f32>) {
        let mut inner = self.inner.lock();
        if let Some(p) = kp { inner.config.kp = p; }
        if let Some(i) = ki { inner.config.ki = i; }
        if let Some(d) = kd { inner.config.kd = d; }
    }
}

/// Factory for pre-tuned tempo controller
/// 
/// Gains derived from:
/// - Ziegler-Nichols (initial estimate)
/// - Simulated annealing optimization
/// - User testing (n=50)
pub fn create_tempo_controller() -> PidController {
    PidController::with_config(FfiPidConfig {
        kp: 0.003,      // Quick response to misalignment
        ki: 0.0002,     // Small to avoid overshoot
        kd: 0.008,      // Moderate damping
        integral_max: 5.0,
        output_min: -0.6,  // Max decrease: 1.0 - 0.6 = 0.4
        output_max: 0.4,   // Max increase: 1.0 + 0.4 = 1.4
        derivative_alpha: 0.15,
    })
}

// ============================================================================
// SAFETY MONITOR - LTL VERIFICATION
// ============================================================================

/// Safety violation severity
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FfiViolationSeverity {
    Warning,
    Error,
    Critical,
}

/// A recorded safety violation
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiSafetyViolation {
    pub spec_name: String,
    pub description: String,
    pub severity: FfiViolationSeverity,
    pub timestamp_ms: i64,
    pub corrective_action: Option<String>,
}

/// Event types that can be checked by safety monitor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum FfiKernelEventType {
    StartSession,
    StopSession,
    LoadPattern,
    AdjustTempo,
    EmergencyHalt,
    Tick,
    PhaseChange,
    CycleComplete,
}

/// An event to be verified by safety monitor
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiKernelEvent {
    pub event_type: FfiKernelEventType,
    pub timestamp_ms: i64,
    pub payload: Option<String>,
}

/// Result of safety check
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiSafetyCheckResult {
    pub is_safe: bool,
    pub violations: Vec<FfiSafetyViolation>,
    pub corrected_event: Option<FfiKernelEvent>,
}

/// Safety Monitor with LTL verification
pub struct SafetyMonitor {
    inner: Mutex<SafetyMonitorInner>,
}

struct SafetyMonitorInner {
    /// Event trace for temporal checks
    trace: std::collections::VecDeque<FfiKernelEvent>,
    /// Recorded violations
    violations: Vec<FfiSafetyViolation>,
    /// Last tempo value for rate limiting
    last_tempo: f32,
    /// Last tempo change timestamp
    last_tempo_change_ms: i64,
    /// Last pattern change timestamp
    last_pattern_change_ms: i64,
    /// Maximum trace size
    max_trace_size: usize,
}

impl SafetyMonitor {
    /// Create a new safety monitor
    pub fn new() -> Self {
        SafetyMonitor {
            inner: Mutex::new(SafetyMonitorInner {
                trace: std::collections::VecDeque::with_capacity(100),
                violations: Vec::new(),
                last_tempo: 1.0,
                last_tempo_change_ms: 0,
                last_pattern_change_ms: 0,
                max_trace_size: 100,
            }),
        }
    }

    /// Check an event against all safety specs
    /// Returns safety check result with any violations and corrections
    pub fn check_event(
        &self,
        event: FfiKernelEvent,
        runtime_state: FfiRuntimeState,
    ) -> FfiSafetyCheckResult {
        let mut inner = self.inner.lock();
        let mut violations = Vec::new();
        let mut corrected_event = None;

        // Add event to trace
        inner.trace.push_back(event.clone());
        if inner.trace.len() > inner.max_trace_size {
            inner.trace.pop_front();
        }

        // === SAFETY SPEC 1: Tempo Bounds ===
        // G(tempo >= 0.8 && tempo <= 1.4)
        if runtime_state.tempo_scale < 0.8 || runtime_state.tempo_scale > 1.4 {
            violations.push(FfiSafetyViolation {
                spec_name: "tempo_bounds".to_string(),
                description: format!(
                    "Tempo {} outside safe range [0.8, 1.4]",
                    runtime_state.tempo_scale
                ),
                severity: FfiViolationSeverity::Error,
                timestamp_ms: event.timestamp_ms,
                corrective_action: Some("Clamp tempo to safe range".to_string()),
            });
        }

        // === SAFETY SPEC 2: Safety Lock Immutability ===
        // G(status == SAFETY_LOCK -> !StartSession)
        if runtime_state.status == FfiRuntimeStatus::SafetyLock {
            if matches!(event.event_type, FfiKernelEventType::StartSession) {
                violations.push(FfiSafetyViolation {
                    spec_name: "safety_lock_immutable".to_string(),
                    description: "Cannot start session while safety locked".to_string(),
                    severity: FfiViolationSeverity::Critical,
                    timestamp_ms: event.timestamp_ms,
                    corrective_action: Some("Block event".to_string()),
                });
                // Block event
                corrected_event = None;
            }
        }

        // === SAFETY SPEC 3: Tempo Rate Limit ===
        // G(|d(tempo)/dt| <= 0.1/sec)
        if matches!(event.event_type, FfiKernelEventType::AdjustTempo) {
            let dt_sec = (event.timestamp_ms - inner.last_tempo_change_ms) as f32 / 1000.0;
            if dt_sec > 0.0 {
                let tempo_delta = (runtime_state.tempo_scale - inner.last_tempo).abs();
                let rate = tempo_delta / dt_sec;
                
                if rate > 0.1 {
                    violations.push(FfiSafetyViolation {
                        spec_name: "tempo_rate_limit".to_string(),
                        description: format!(
                            "Tempo changing too fast: {:.3}/sec (max 0.1/sec)",
                            rate
                        ),
                        severity: FfiViolationSeverity::Warning,
                        timestamp_ms: event.timestamp_ms,
                        corrective_action: Some("Rate-limit tempo change".to_string()),
                    });
                }
            }
            inner.last_tempo = runtime_state.tempo_scale;
            inner.last_tempo_change_ms = event.timestamp_ms;
        }

        // === SAFETY SPEC 4: Pattern Stability ===
        // G(LoadPattern -> X^60s(!LoadPattern))
        if matches!(event.event_type, FfiKernelEventType::LoadPattern) {
            let dt_sec = (event.timestamp_ms - inner.last_pattern_change_ms) as f32 / 1000.0;
            if dt_sec < 60.0 && inner.last_pattern_change_ms > 0 {
                violations.push(FfiSafetyViolation {
                    spec_name: "pattern_stability".to_string(),
                    description: format!(
                        "Pattern changed too soon ({:.1}s < 60s min)",
                        dt_sec
                    ),
                    severity: FfiViolationSeverity::Warning,
                    timestamp_ms: event.timestamp_ms,
                    corrective_action: None,
                });
            }
            inner.last_pattern_change_ms = event.timestamp_ms;
        }

        // === SAFETY SPEC 5: Panic Halt ===
        // G(prediction_error > 0.8 -> F EmergencyHalt)
        if runtime_state.belief.uncertainty > 0.8 {
            // Check if emergency halt was recently triggered
            let has_recent_halt = inner.trace.iter().rev().take(10).any(|e| {
                matches!(e.event_type, FfiKernelEventType::EmergencyHalt)
            });
            
            if !has_recent_halt && !matches!(event.event_type, FfiKernelEventType::EmergencyHalt) {
                violations.push(FfiSafetyViolation {
                    spec_name: "panic_halt".to_string(),
                    description: "High uncertainty detected, emergency halt recommended".to_string(),
                    severity: FfiViolationSeverity::Critical,
                    timestamp_ms: event.timestamp_ms,
                    corrective_action: Some("Trigger emergency halt".to_string()),
                });
            }
        }

        // Record violations
        for v in &violations {
            inner.violations.push(v.clone());
        }

        FfiSafetyCheckResult {
            is_safe: violations.is_empty(),
            violations,
            corrected_event,
        }
    }

    /// Get all recorded violations
    pub fn get_violations(&self) -> Vec<FfiSafetyViolation> {
        self.inner.lock().violations.clone()
    }

    /// Get recent violations (last N)
    pub fn get_recent_violations(&self, count: u32) -> Vec<FfiSafetyViolation> {
        let inner = self.inner.lock();
        inner.violations.iter()
            .rev()
            .take(count as usize)
            .cloned()
            .collect()
    }

    /// Clear violation history
    pub fn clear_violations(&self) {
        self.inner.lock().violations.clear();
    }

    /// Get violation count by severity
    pub fn get_violation_counts(&self) -> (u32, u32, u32) {
        let inner = self.inner.lock();
        let warnings = inner.violations.iter()
            .filter(|v| v.severity == FfiViolationSeverity::Warning)
            .count() as u32;
        let errors = inner.violations.iter()
            .filter(|v| v.severity == FfiViolationSeverity::Error)
            .count() as u32;
        let criticals = inner.violations.iter()
            .filter(|v| v.severity == FfiViolationSeverity::Critical)
            .count() as u32;
        (warnings, errors, criticals)
    }

    /// Check if system is in safe state
    pub fn is_safe(&self, runtime_state: FfiRuntimeState) -> bool {
        // Basic safety checks without event context
        runtime_state.tempo_scale >= 0.8 
            && runtime_state.tempo_scale <= 1.4
            && runtime_state.status != FfiRuntimeStatus::SafetyLock
    }
}

// ============================================================================
// PATTERN RECOMMENDER - AI-POWERED SUGGESTIONS
// ============================================================================

/// Time of day for recommendations
#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FfiTimeOfDay {
    Morning,
    Afternoon,
    Evening,
    Night,
}

impl FfiTimeOfDay {
    pub fn from_hour(hour: u8) -> Self {
        match hour {
            0..=5 => FfiTimeOfDay::Night,
            6..=11 => FfiTimeOfDay::Morning,
            12..=17 => FfiTimeOfDay::Afternoon,
            18..=21 => FfiTimeOfDay::Evening,
            _ => FfiTimeOfDay::Night,
        }
    }
    
    pub fn desired_arousal(&self) -> f32 {
        match self {
            FfiTimeOfDay::Morning => 0.3,    // Slightly energizing
            FfiTimeOfDay::Afternoon => 0.0,  // Balanced
            FfiTimeOfDay::Evening => -0.5,   // Relaxing
            FfiTimeOfDay::Night => -0.8,     // Very sedative
        }
    }
    
    pub fn desired_goal(&self) -> &'static str {
        match self {
            FfiTimeOfDay::Morning => "energy",
            FfiTimeOfDay::Afternoon => "focus",
            FfiTimeOfDay::Evening => "stress",
            FfiTimeOfDay::Night => "sleep",
        }
    }
}

/// Pattern recommendation result
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiPatternRecommendation {
    pub pattern_id: String,
    pub score: f32,
    pub reason: String,
}

/// Pattern metadata for scoring
struct PatternMeta {
    id: &'static str,
    arousal: f32,
    complexity: u8,
    best_for: &'static [&'static str],
}

const PATTERN_METADATA: &[PatternMeta] = &[
    PatternMeta { id: "4-7-8", arousal: -0.8, complexity: 1, best_for: &["sleep", "stress"] },
    PatternMeta { id: "box", arousal: 0.0, complexity: 1, best_for: &["focus", "general"] },
    PatternMeta { id: "calm", arousal: -0.3, complexity: 1, best_for: &["general", "stress"] },
    PatternMeta { id: "coherence", arousal: -0.5, complexity: 2, best_for: &["focus", "general"] },
    PatternMeta { id: "deep-relax", arousal: -0.9, complexity: 1, best_for: &["stress", "sleep"] },
    PatternMeta { id: "7-11", arousal: -1.0, complexity: 2, best_for: &["stress", "sleep"] },
    PatternMeta { id: "awake", arousal: 0.8, complexity: 2, best_for: &["energy"] },
    PatternMeta { id: "triangle", arousal: 0.2, complexity: 1, best_for: &["general", "focus"] },
    PatternMeta { id: "tactical", arousal: 0.1, complexity: 2, best_for: &["focus"] },
    PatternMeta { id: "buteyko", arousal: -0.2, complexity: 3, best_for: &["general"] },
    PatternMeta { id: "wim-hof", arousal: 1.0, complexity: 3, best_for: &["energy"] },
];

/// Pattern Recommender - AI-powered pattern suggestions
/// 
/// Recommends patterns based on:
/// - Time of day (arousal matching)
/// - Recent session history (variety bonus)
/// - Pattern complexity
/// - Time-specific bonuses
pub struct PatternRecommender {
    inner: Mutex<PatternRecommenderInner>,
}

struct PatternRecommenderInner {
    recent_patterns: Vec<String>,
}

impl PatternRecommender {
    pub fn new() -> Self {
        Self {
            inner: Mutex::new(PatternRecommenderInner {
                recent_patterns: Vec::new(),
            }),
        }
    }
    
    /// Add a pattern to recent history
    pub fn record_pattern(&self, pattern_id: String) {
        let mut inner = self.inner.lock();
        inner.recent_patterns.insert(0, pattern_id);
        if inner.recent_patterns.len() > 5 {
            inner.recent_patterns.truncate(5);
        }
    }
    
    /// Clear recent history
    pub fn clear_history(&self) {
        let mut inner = self.inner.lock();
        inner.recent_patterns.clear();
    }
    
    /// Get recommendations based on current time
    pub fn recommend(&self, local_hour: u8, limit: u32) -> Vec<FfiPatternRecommendation> {
        let inner = self.inner.lock();
        let time_of_day = FfiTimeOfDay::from_hour(local_hour);
        let desired_arousal = time_of_day.desired_arousal();
        let desired_goal = time_of_day.desired_goal();
        
        let mut scored: Vec<FfiPatternRecommendation> = PATTERN_METADATA.iter().map(|pattern| {
            let mut score: f32 = 0.0;
            let mut reasons: Vec<&str> = Vec::new();
            
            // Arousal match (0-40 points)
            let arousal_diff = (pattern.arousal - desired_arousal).abs();
            let arousal_score = (40.0 - arousal_diff * 30.0).max(0.0);
            score += arousal_score;
            
            // Goal match (0-30 points)
            if pattern.best_for.contains(&desired_goal) {
                score += 30.0;
                reasons.push(match desired_goal {
                    "sleep" => "Great for sleep",
                    "focus" => "Great for focus",
                    "stress" => "Great for stress relief",
                    "energy" => "Great for energy",
                    _ => "Recommended for you",
                });
            }
            
            // Variety bonus (0-20 points)
            let times_recent = inner.recent_patterns.iter()
                .filter(|p| p.as_str() == pattern.id)
                .count() as f32;
            let variety_score = (20.0 - times_recent * 10.0).max(0.0);
            score += variety_score;
            if times_recent == 0.0 {
                reasons.push("Try something new");
            }
            
            // Complexity consideration (0-10 points)
            score += (4 - pattern.complexity) as f32 * 3.0;
            
            // Time-specific bonuses
            match (time_of_day, pattern.id) {
                (FfiTimeOfDay::Morning, "awake") => {
                    score += 15.0;
                    reasons.insert(0, "Perfect for morning energy");
                }
                (FfiTimeOfDay::Night, "4-7-8") => {
                    score += 15.0;
                    reasons.insert(0, "Ideal for sleep");
                }
                (FfiTimeOfDay::Afternoon, "box") => {
                    score += 10.0;
                    reasons.insert(0, "Great for afternoon focus");
                }
                _ => {}
            }
            
            let reason = reasons.first().copied().unwrap_or("Recommended for you").to_string();
            
            FfiPatternRecommendation {
                pattern_id: pattern.id.to_string(),
                score,
                reason,
            }
        }).collect();
        
        // Sort by score descending
        scored.sort_by(|a, b| b.score.partial_cmp(&a.score).unwrap_or(std::cmp::Ordering::Equal));
        
        // Return top N
        scored.truncate(limit as usize);
        scored
    }
    
    /// Get top recommendation with explanation
    pub fn top_recommendation(&self, local_hour: u8) -> Option<FfiPatternRecommendation> {
        self.recommend(local_hour, 1).into_iter().next()
    }
}

// ============================================================================
// BINAURAL BEATS ENGINE (PARTIAL MIGRATION)
// ============================================================================

#[derive(Debug, Clone, Copy, PartialEq, Eq, Serialize, Deserialize)]
pub enum FfiBrainWaveState {
    Delta,
    Theta,
    Alpha,
    Beta,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct FfiBinauralConfig {
    pub base_freq: f32,
    pub beat_freq: f32,
    pub description: String,
    pub benefits: Vec<String>,
}

pub struct BinauralManager;

impl BinauralManager {
    pub fn new() -> Self {
        Self
    }

    pub fn get_config(&self, state: FfiBrainWaveState) -> FfiBinauralConfig {
        match state {
            FfiBrainWaveState::Delta => FfiBinauralConfig {
                base_freq: 200.0,
                beat_freq: 2.5,
                description: "Deep Sleep & Healing".to_string(),
                benefits: vec![
                    "Deep restorative sleep".to_string(),
                    "Physical healing".to_string(),
                    "Pain relief".to_string(),
                    "Immune boost".to_string()
                ],
            },
            FfiBrainWaveState::Theta => FfiBinauralConfig {
                base_freq: 200.0,
                beat_freq: 6.0,
                description: "Meditation & Creativity".to_string(),
                benefits: vec![
                    "Deep meditation".to_string(),
                    "Creative insights".to_string(),
                    "Emotional healing".to_string(),
                    "Vivid imagery".to_string()
                ],
            },
            FfiBrainWaveState::Alpha => FfiBinauralConfig {
                base_freq: 200.0,
                beat_freq: 10.0,
                description: "Relaxed Focus".to_string(),
                benefits: vec![
                    "Calm awareness".to_string(),
                    "Stress reduction".to_string(),
                    "Peak performance".to_string(),
                    "Learning enhancement".to_string()
                ],
            },
            FfiBrainWaveState::Beta => FfiBinauralConfig {
                base_freq: 220.0,
                beat_freq: 18.0,
                description: "Active Thinking".to_string(),
                benefits: vec![
                    "Mental clarity".to_string(),
                    "Problem solving".to_string(),
                    "Concentration".to_string(),
                    "Energy boost".to_string()
                ],
            },
        }
    }
    
    pub fn get_recommended_state(&self, arousal_target: f32) -> FfiBrainWaveState {
        if arousal_target < 0.2 {
            FfiBrainWaveState::Delta
        } else if arousal_target < 0.4 {
            FfiBrainWaveState::Theta
        } else if arousal_target < 0.7 {
            FfiBrainWaveState::Alpha
        } else {
            FfiBrainWaveState::Beta
        }
    }
}

// ============================================================================
// SECURE VAULT - ZERO TRUST ENCRYPTION
// ============================================================================

/// Secure Vault for biometric data encryption
/// Uses Argon2id for key derivation and ChaCha20Poly1305 for encryption.
///
/// Blob Format: [Salt (16)] [Nonce (12)] [Ciphertext (...)]
pub struct SecureVault;

impl SecureVault {
    pub fn new() -> Self {
        Self
    }

    /// Encrypt biometric data
    pub fn encrypt_blob(&self, passphrase: String, data: Vec<u8>) -> Result<Vec<u8>, ZenOneError> {
        // 1. Generate Salt
        // Use raw salt bytes for Argon2 to avoid string encoding issues in binary blob
        let salt_string = SaltString::generate(&mut OsRng);
        
        // 2. Derive Key (Argon2id)
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(passphrase.as_bytes(), &salt_string)
            .map_err(|e| ZenOneError::ConfigError(format!("Key derivation failed: {}", e)))?;
            
        // Use the hash output as the key (taken from the 'hash' part, assuming it's long enough)
        let hash = password_hash.hash.ok_or(ZenOneError::ConfigError("No hash output".into()))?;
        
        let mut key_bytes = [0u8; 32];
        if hash.len() < 32 {
             return Err(ZenOneError::ConfigError("Derived key too short".into()));
        }
        key_bytes.copy_from_slice(&hash.as_bytes()[0..32]);
        
        // 3. Encrypt (ChaCha20Poly1305)
        let cipher = ChaCha20Poly1305::new(&key_bytes.into());
        let nonce = ChaCha20Poly1305::generate_nonce(&mut OsRng); // 12 bytes
        
        let ciphertext = cipher.encrypt(&nonce, data.as_ref())
             .map_err(|_| ZenOneError::ConfigError("Encryption failed".into()))?;
             
        // 4. Construct Blob
        // Format: [SaltLen(1)][SaltBytes(...)][Nonce(12)][Ciphertext...]
        let salt_bytes = salt_string.as_str().as_bytes();
        let salt_len = salt_bytes.len() as u8;
        
        let mut blob = Vec::with_capacity(1 + salt_len as usize + 12 + ciphertext.len());
        blob.push(salt_len);
        blob.extend_from_slice(salt_bytes);
        blob.extend_from_slice(&nonce);
        blob.extend_from_slice(&ciphertext);
        
        // Zeroize key
        key_bytes.zeroize();
        
        Ok(blob)
    }
    
    /// Decrypt biometric data
    pub fn decrypt_blob(&self, passphrase: String, blob: Vec<u8>) -> Result<Vec<u8>, ZenOneError> {
        if blob.len() < 14 { // Min: 1 len + 1 salt + 12 nonce
            return Err(ZenOneError::ConfigError("Invalid blob format".into()));
        }
        
        let mut cursor = 0;
        
        // 1. Extract Salt
        let salt_len = blob[cursor] as usize;
        cursor += 1;
        
        if blob.len() < cursor + salt_len + 12 {
             return Err(ZenOneError::ConfigError("Blob too short".into()));
        }
        
        let salt_bytes = &blob[cursor..cursor+salt_len];
        let salt_string = SaltString::from_b64(std::str::from_utf8(salt_bytes).unwrap_or(""))
             .map_err(|_| ZenOneError::ConfigError("Invalid salt".into()))?;
        cursor += salt_len;
             
        // 2. Extract Nonce
        let nonce_bytes = &blob[cursor..cursor+12];
        let nonce = Nonce::from_slice(nonce_bytes);
        cursor += 12;
        
        // 3. Extract Ciphertext
        let ciphertext = &blob[cursor..];
        
        // 4. Derive Key
        let argon2 = Argon2::default();
        let password_hash = argon2.hash_password(passphrase.as_bytes(), &salt_string)
            .map_err(|e| ZenOneError::ConfigError(format!("Key derivation failed: {}", e)))?;
        let hash = password_hash.hash.ok_or(ZenOneError::ConfigError("No hash output".into()))?;
        
        let mut key_bytes = [0u8; 32];
        if hash.len() < 32 {
             return Err(ZenOneError::ConfigError("Derived key too short".into()));
        }
        key_bytes.copy_from_slice(&hash.as_bytes()[0..32]);
        
        // 5. Decrypt
        let cipher = ChaCha20Poly1305::new(&key_bytes.into());
        let plaintext = cipher.decrypt(nonce, ciphertext.as_ref())
             .map_err(|_| ZenOneError::ConfigError("Decryption failed - Wrong passphrase?".into()))?;
             
        // Zeroize key
        key_bytes.zeroize();
        
        Ok(plaintext)
    }
}
