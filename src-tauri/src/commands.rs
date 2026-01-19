//! Tauri commands exposing ZenOneRuntime to the frontend.
//!
//! These commands are invoked via `invoke('command_name', args)` from TypeScript.

use std::sync::Mutex;
use tauri::State;

use zenone_ffi::{
    FfiBeliefState, FfiBreathPattern, FfiFrame, FfiRuntimeState, FfiSafetyStatus,
    FfiSessionStats, ZenOneRuntime,
};

/// Managed state: holds the ZenOneRuntime singleton.
pub struct RuntimeState(pub Mutex<ZenOneRuntime>);

// =============================================================================
// PATTERN COMMANDS
// =============================================================================

/// Get all available breathing patterns.
#[tauri::command]
pub fn get_patterns(state: State<RuntimeState>) -> Vec<FfiBreathPattern> {
    let runtime = state.0.lock().unwrap();
    runtime.get_patterns()
}

/// Load a breathing pattern by ID.
#[tauri::command]
pub fn load_pattern(state: State<RuntimeState>, pattern_id: String) -> bool {
    let runtime = state.0.lock().unwrap();
    runtime.load_pattern(pattern_id)
}

/// Get current pattern ID.
#[tauri::command]
pub fn current_pattern_id(state: State<RuntimeState>) -> String {
    let runtime = state.0.lock().unwrap();
    runtime.current_pattern_id()
}

// =============================================================================
// SESSION COMMANDS
// =============================================================================

/// Start a breathing session.
#[tauri::command]
pub fn start_session(state: State<RuntimeState>) -> Result<(), String> {
    let runtime = state.0.lock().unwrap();
    runtime.start_session().map_err(|e| e.to_string())
}

/// Stop session and return stats.
#[tauri::command]
pub fn stop_session(state: State<RuntimeState>) -> FfiSessionStats {
    let runtime = state.0.lock().unwrap();
    runtime.stop_session()
}

/// Pause session.
#[tauri::command]
pub fn pause_session(state: State<RuntimeState>) {
    let runtime = state.0.lock().unwrap();
    runtime.pause_session();
}

/// Resume session.
#[tauri::command]
pub fn resume_session(state: State<RuntimeState>) {
    let runtime = state.0.lock().unwrap();
    runtime.resume_session();
}

/// Check if session is active.
#[tauri::command]
pub fn is_session_active(state: State<RuntimeState>) -> bool {
    let runtime = state.0.lock().unwrap();
    runtime.is_session_active()
}

// =============================================================================
// FRAME PROCESSING
// =============================================================================

/// Tick the engine (timer-based, no camera).
#[tauri::command]
pub fn tick(state: State<RuntimeState>, dt_sec: f32, timestamp_us: i64) -> FfiFrame {
    let runtime = state.0.lock().unwrap();
    runtime.tick(dt_sec, timestamp_us)
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
    let runtime = state.0.lock().unwrap();
    runtime.process_frame(r, g, b, timestamp_us)
}

// =============================================================================
// STATE QUERIES
// =============================================================================

/// Get full runtime state snapshot.
#[tauri::command]
pub fn get_state(state: State<RuntimeState>) -> FfiRuntimeState {
    let runtime = state.0.lock().unwrap();
    runtime.get_state()
}

/// Get current belief state (for AI/ML integration).
#[tauri::command]
pub fn get_belief(state: State<RuntimeState>) -> FfiBeliefState {
    let runtime = state.0.lock().unwrap();
    runtime.get_belief()
}

/// Get safety status (lock state, bounds, trauma count).
#[tauri::command]
pub fn get_safety_status(state: State<RuntimeState>) -> FfiSafetyStatus {
    let runtime = state.0.lock().unwrap();
    runtime.get_safety_status()
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
    let runtime = state.0.lock().unwrap();
    runtime.update_context(local_hour, is_charging, recent_sessions);
}

/// Adjust tempo scale.
#[tauri::command]
pub fn adjust_tempo(state: State<RuntimeState>, scale: f32, reason: String) -> Result<f32, String> {
    let runtime = state.0.lock().unwrap();
    runtime.adjust_tempo(scale, reason).map_err(|e| e.to_string())
}

/// Emergency halt.
#[tauri::command]
pub fn emergency_halt(state: State<RuntimeState>, reason: String) {
    let runtime = state.0.lock().unwrap();
    runtime.emergency_halt(reason);
}

/// Reset safety lock.
#[tauri::command]
pub fn reset_safety_lock(state: State<RuntimeState>) {
    let runtime = state.0.lock().unwrap();
    runtime.reset_safety_lock();
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
    let runtime = runtime_state.0.lock().unwrap();
    let safety = safety_state.0.lock().unwrap();
    let state = runtime.get_state();
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
    let runtime = runtime_state.0.lock().unwrap();
    let safety = safety_state.0.lock().unwrap();
    let state = runtime.get_state();
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
