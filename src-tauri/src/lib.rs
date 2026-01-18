//! Tauri application entrypoint with ZenOne Kernel integration.

mod commands;

use std::sync::Mutex;
use commands::RuntimeState;
use zenone_ffi::ZenOneRuntime;

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    tauri::Builder::default()
        .manage(RuntimeState(Mutex::new(ZenOneRuntime::new())))
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
            // Control
            commands::adjust_tempo,
            commands::emergency_halt,
            commands::reset_safety_lock,
        ])
        .setup(|app| {
            if cfg!(debug_assertions) {
                app.handle().plugin(
                    tauri_plugin_log::Builder::default()
                        .level(log::LevelFilter::Info)
                        .build(),
                )?;
            }
            Ok(())
        })
        .run(tauri::generate_context!())
        .expect("error while running tauri application");
}
