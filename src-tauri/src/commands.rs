//! Tauri commands exposing ZenOneRuntime to the frontend.
//!
//! These commands are invoked via `invoke('command_name', args)` from TypeScript.

use std::sync::Mutex;
use tauri::State;

use zenone_ffi::{
    FfiBreathPattern, FfiFrame, FfiRuntimeState, FfiSessionStats, ZenOneError, ZenOneRuntime,
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

// =============================================================================
// CONTROL
// =============================================================================

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
