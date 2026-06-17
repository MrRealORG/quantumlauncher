use serde::{Deserialize, Serialize};

/// Event names used for Tauri's event system.
/// The frontend listens for these events to update progress bars, status text, etc.

/// Emitted during instance creation downloads.
pub const EVENT_DOWNLOAD_PROGRESS: &str = "download-progress";

/// Emitted during generic progress operations (java install, mod downloads, etc.).
pub const EVENT_GENERIC_PROGRESS: &str = "generic-progress";

/// Emitted when a game or server process exits.
pub const EVENT_PROCESS_EXIT: &str = "process-exit";

/// Emitted when a game log line is received.
pub const EVENT_GAME_LOG: &str = "game-log";

// ---------- Payload structs ----------

/// Payload for download progress events during instance creation.
#[derive(Debug, Clone, Serialize, Deserialize)]
#[serde(tag = "stage", content = "data")]
pub enum DownloadProgressPayload {
    /// Downloading the version manifest JSON
    DownloadingJsonManifest,
    /// Downloading the specific version JSON
    DownloadingVersionJson,
    /// Downloading assets with progress
    DownloadingAssets { progress: usize, out_of: usize },
    /// Downloading libraries with progress
    DownloadingLibraries { progress: usize, out_of: usize },
    /// Downloading the game jar
    DownloadingJar,
}

/// Payload for generic progress events (java install, mod downloads, etc.)
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GenericProgressPayload {
    /// Number of items completed
    pub done: usize,
    /// Total number of items
    pub total: usize,
    /// Optional human-readable message
    pub message: Option<String>,
    /// Whether the operation has finished
    pub has_finished: bool,
}

impl From<ql_core::DownloadProgress> for DownloadProgressPayload {
    fn from(val: ql_core::DownloadProgress) -> Self {
        match val {
            ql_core::DownloadProgress::DownloadingJsonManifest => Self::DownloadingJsonManifest,
            ql_core::DownloadProgress::DownloadingVersionJson => Self::DownloadingVersionJson,
            ql_core::DownloadProgress::DownloadingAssets { progress, out_of } => {
                Self::DownloadingAssets { progress, out_of }
            }
            ql_core::DownloadProgress::DownloadingLibraries { progress, out_of } => {
                Self::DownloadingLibraries { progress, out_of }
            }
            ql_core::DownloadProgress::DownloadingJar => Self::DownloadingJar,
        }
    }
}

impl From<ql_core::GenericProgress> for GenericProgressPayload {
    fn from(val: ql_core::GenericProgress) -> Self {
        Self {
            done: val.done,
            total: val.total,
            message: val.message,
            has_finished: val.has_finished,
        }
    }
}

/// Payload emitted when a process exits.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ProcessExitPayload {
    pub instance_name: String,
    pub exit_code: Option<i32>,
    pub is_classic_server: bool,
}

/// Payload for game log lines.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GameLogPayload {
    pub instance_name: String,
    pub line: String,
}
