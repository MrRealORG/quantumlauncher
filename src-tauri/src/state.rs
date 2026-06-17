use std::collections::HashMap;
use std::sync::Arc;

use ql_core::LaunchedProcess;
use tokio::sync::Mutex;

/// Shared application state managed through Tauri's state system.
///
/// This holds mutable state that needs to be shared across Tauri commands,
/// such as running game/server processes.
pub struct AppState {
    /// Currently running game and server processes, keyed by instance name.
    pub running_processes: Mutex<HashMap<String, LaunchedProcess>>,
}

impl AppState {
    /// Creates a new empty application state.
    pub fn new() -> Self {
        Self {
            running_processes: Mutex::new(HashMap::new()),
        }
    }
}

impl Default for AppState {
    fn default() -> Self {
        Self::new()
    }
}

/// Convenience alias for Tauri's managed state type.
pub type ManagedState<'a> = tauri::State<'a, AppState>;
