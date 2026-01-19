//! Tauri application entrypoint with ZenOne Kernel integration.

mod commands;

use std::sync::Mutex;
use commands::{RuntimeState, SafetyMonitorState, PidControllerState, RecommenderState, BinauralState};
use tauri::Manager;
use zenone_ffi::{ZenOneRuntime, SafetyMonitor, PidController, PatternRecommender, BinauralManager};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState(ZenOneRuntime::new()))
        .manage(SafetyMonitorState(Mutex::new(SafetyMonitor::new())))
        .manage(PidControllerState(Mutex::new(PidController::new())))
        .manage(RecommenderState(Mutex::new(PatternRecommender::new())))
        .manage(BinauralState(Mutex::new(BinauralManager::new())))
        .invoke_handler(tauri::generate_handler![
            // Pattern commands
            commands::get_patterns,
            commands::load_pattern,
            commands::current_pattern_id,
            // Session commands
            commands::start_session,
            commands::stop_session,
            commands::pause_session,
            commands::resume_session,
            commands::is_session_active,
            // Frame processing
            commands::tick,
            commands::process_frame,
            // State queries
            commands::get_state,
            commands::get_belief,
            commands::get_safety_status,
            // Context & Control
            commands::update_context,
            commands::adjust_tempo,
            commands::emergency_halt,
            commands::reset_safety_lock,
            // Safety Monitor commands
            commands::check_safety_event,
            commands::get_safety_violations,
            commands::get_recent_safety_violations,
            commands::clear_safety_violations,
            commands::is_system_safe,
            // PID Controller commands
            commands::pid_compute,
            commands::pid_reset,
            commands::pid_get_diagnostics,
            // Pattern Recommender commands
            commands::recommend_patterns,
            commands::record_pattern_usage,
            commands::clear_pattern_history,
            // Binaural commands
            commands::get_binaural_config,
            commands::get_binaural_recommendation,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
                // Open DevTools in debug mode
                if let Some(window) = app.get_webview_window("main") {
                    window.open_devtools();
                }
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
