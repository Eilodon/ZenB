//! Tauri commands exposing ZenOneRuntime to the frontend.
//!
//! These commands are invoked via `invoke('command_name', args)` from TypeScript.

use tauri::State;
use std::sync::Mutex;

use zenone_ffi::{
    FfiBeliefState, FfiBreathPattern, FfiFrame, FfiRuntimeState, FfiSafetyStatus,
    FfiSessionStats, ZenOneRuntime,
};

/// Managed state: holds the ZenOneRuntime singleton.
pub struct RuntimeState(pub ZenOneRuntime);

// =============================================================================
// PATTERN COMMANDS
// =============================================================================

/// Get all available breathing patterns.
#[tauri::command]
pub fn get_patterns(state: State<RuntimeState>) -> Vec<FfiBreathPattern> {
    state.0.get_patterns()
}

/// Load a breathing pattern by ID.
#[tauri::command]
pub fn load_pattern(state: State<RuntimeState>, pattern_id: String) -> bool {
    state.0.load_pattern(pattern_id)
}

/// Get current pattern ID.
#[tauri::command]
pub fn current_pattern_id(state: State<RuntimeState>) -> String {
    state.0.current_pattern_id()
}

// =============================================================================
// SESSION COMMANDS
// =============================================================================

/// Start a breathing session.
#[tauri::command]
pub fn start_session(state: State<RuntimeState>) -> Result<(), String> {
    state.0.start_session().map_err(|e| e.to_string())
}

/// Stop session and return stats.
#[tauri::command]
pub fn stop_session(state: State<RuntimeState>) -> FfiSessionStats {
    state.0.stop_session()
}

/// Pause session.
#[tauri::command]
pub fn pause_session(state: State<RuntimeState>) {
    state.0.pause_session();
}

/// Resume session.
#[tauri::command]
pub fn resume_session(state: State<RuntimeState>) {
    state.0.resume_session();
}

/// Check if session is active.
#[tauri::command]
pub fn is_session_active(state: State<RuntimeState>) -> bool {
    state.0.is_session_active()
}

// =============================================================================
// FRAME PROCESSING
// =============================================================================

/// Tick the engine (timer-based, no camera).
#[tauri::command]
pub fn tick(state: State<RuntimeState>, dt_sec: f32, timestamp_us: i64) -> FfiFrame {
    state.0.tick(dt_sec, timestamp_us)
}

/// Process a camera frame (rPPG pipeline).
#[tauri::command]
pub fn process_frame(
    state: State<RuntimeState>,
    r: f32,
    g: f32,
    b: f32,
    timestamp_us: i64,
) -> FfiFrame {
    state.0.process_frame(r, g, b, timestamp_us)
}

// =============================================================================
// STATE QUERIES
// =============================================================================

/// Get full runtime state snapshot.
#[tauri::command]
pub fn get_state(state: State<RuntimeState>) -> FfiRuntimeState {
    state.0.get_state()
}

/// Get current belief state (for AI/ML integration).
#[tauri::command]
pub fn get_belief(state: State<RuntimeState>) -> FfiBeliefState {
    state.0.get_belief()
}

/// Get safety status (lock state, bounds, trauma count).
#[tauri::command]
pub fn get_safety_status(state: State<RuntimeState>) -> FfiSafetyStatus {
    state.0.get_safety_status()
}

// =============================================================================
// CONTEXT & CONTROL
// =============================================================================

/// Update context (time of day, device state, session history).
/// This helps the Engine adapt its recommendations.
#[tauri::command]
pub fn update_context(
    state: State<RuntimeState>,
    local_hour: u8,
    is_charging: bool,
    recent_sessions: u16,
) {
    state.0.update_context(local_hour, is_charging, recent_sessions);
}

/// Adjust tempo scale.
#[tauri::command]
pub fn adjust_tempo(state: State<RuntimeState>, scale: f32, reason: String) -> Result<f32, String> {
    state.0.adjust_tempo(scale, reason).map_err(|e| e.to_string())
}

/// Emergency halt.
#[tauri::command]
pub fn emergency_halt(state: State<RuntimeState>, reason: String) {
    state.0.emergency_halt(reason);
}

/// Reset safety lock.
#[tauri::command]
pub fn reset_safety_lock(state: State<RuntimeState>) {
    state.0.reset_safety_lock();
}

// =============================================================================
// SAFETY MONITOR COMMANDS
// =============================================================================

use zenone_ffi::{
    FfiKernelEvent, FfiSafetyCheckResult, FfiSafetyViolation, SafetyMonitor,
};

/// Managed state: holds the SafetyMonitor singleton.
pub struct SafetyMonitorState(pub Mutex<SafetyMonitor>);

/// Check an event against safety specs.
#[tauri::command]
pub fn check_safety_event(
    runtime_state: State<RuntimeState>,
    safety_state: State<SafetyMonitorState>,
    event: FfiKernelEvent,
) -> FfiSafetyCheckResult {
    let safety = safety_state.0.lock().unwrap();
    let state = runtime_state.0.get_state();
    safety.check_event(event, state)
}

/// Get all safety violations.
#[tauri::command]
pub fn get_safety_violations(state: State<SafetyMonitorState>) -> Vec<FfiSafetyViolation> {
    let safety = state.0.lock().unwrap();
    safety.get_violations()
}

/// Get recent safety violations.
#[tauri::command]
pub fn get_recent_safety_violations(
    state: State<SafetyMonitorState>,
    count: u32,
) -> Vec<FfiSafetyViolation> {
    let safety = state.0.lock().unwrap();
    safety.get_recent_violations(count)
}

/// Clear safety violation history.
#[tauri::command]
pub fn clear_safety_violations(state: State<SafetyMonitorState>) {
    let safety = state.0.lock().unwrap();
    safety.clear_violations();
}

/// Check if system is in safe state.
#[tauri::command]
pub fn is_system_safe(
    runtime_state: State<RuntimeState>,
    safety_state: State<SafetyMonitorState>,
) -> bool {
    let safety = safety_state.0.lock().unwrap();
    let state = runtime_state.0.get_state();
    safety.is_safe(state)
}

// ============================================================================
// PID CONTROLLER COMMANDS
// ============================================================================

use zenone_ffi::{PidController, FfiPidDiagnostics};
use std::sync::Mutex as StdMutex;

/// Global PID Controller for tempo adjustment (singleton)
pub struct PidControllerState(pub StdMutex<PidController>);

/// Compute PID output for tempo control.
#[tauri::command]
pub fn pid_compute(
    state: State<PidControllerState>,
    error: f32,
    dt: f32,
) -> f32 {
    let pid = state.0.lock().unwrap();
    pid.compute(error, dt)
}

/// Reset PID controller state.
#[tauri::command]
pub fn pid_reset(state: State<PidControllerState>) {
    let pid = state.0.lock().unwrap();
    pid.reset();
}

/// Get PID diagnostics.
#[tauri::command]
pub fn pid_get_diagnostics(state: State<PidControllerState>) -> FfiPidDiagnostics {
    let pid = state.0.lock().unwrap();
    pid.get_diagnostics()
}

// ============================================================================
// PATTERN RECOMMENDER COMMANDS
// ============================================================================

use zenone_ffi::{PatternRecommender, FfiPatternRecommendation};

/// Global Pattern Recommender (singleton)
pub struct RecommenderState(pub StdMutex<PatternRecommender>);

/// Get breathing pattern recommendations.
#[tauri::command]
pub fn recommend_patterns(
    state: State<RecommenderState>,
    local_hour: u8,
    limit: u32,
) -> Vec<FfiPatternRecommendation> {
    let recommender = state.0.lock().unwrap();
    recommender.recommend(local_hour, limit)
}

/// Record pattern usage (for variety scoring).
#[tauri::command]
pub fn record_pattern_usage(
    state: State<RecommenderState>,
    pattern_id: String,
) {
    let recommender = state.0.lock().unwrap();
    recommender.record_pattern(pattern_id);
}

/// Clear pattern history.
#[tauri::command]
pub fn clear_pattern_history(state: State<RecommenderState>) {
    let recommender = state.0.lock().unwrap();
    recommender.clear_history();
}

// ============================================================================
// BINAURAL BEATS COMMANDS
// ============================================================================

use zenone_ffi::{BinauralManager, FfiBrainWaveState, FfiBinauralConfig};

/// Global Binaural Manager (singleton)
pub struct BinauralState(pub StdMutex<BinauralManager>);

/// Get configuration for a brain wave state
#[tauri::command]
pub fn get_binaural_config(
    state: State<BinauralState>,
    brain_wave: FfiBrainWaveState,
) -> FfiBinauralConfig {
    let manager = state.0.lock().unwrap();
    manager.get_config(brain_wave)
}

/// Get recommended brain wave state
#[tauri::command]
pub fn get_binaural_recommendation(
    state: State<BinauralState>,
    arousal_target: f32,
) -> FfiBrainWaveState {
    let manager = state.0.lock().unwrap();
    manager.get_recommended_state(arousal_target)
}
