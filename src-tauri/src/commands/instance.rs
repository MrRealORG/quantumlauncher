use std::sync::Arc;

use ql_core::{DownloadProgress, Instance, InstanceConfigJson, InstanceKind, ListEntry, ListEntryKind, LAUNCHER_DIR};
use ql_instances::{
    self,
    auth::AccountData,
    download::create_instance,
    instance::launch::launch,
};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter, State};

use crate::events::{DownloadProgressPayload, EVENT_DOWNLOAD_PROGRESS};
use crate::state::AppState;

// ---------- Data types for the frontend ----------

/// A simplified instance info returned to the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct InstanceInfo {
    pub name: String,
    pub kind: InstanceKind,
}

/// Account data serializable for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct AccountDataSerializable {
    pub access_token: Option<String>,
    pub uuid: String,
    pub username: String,
    pub nice_username: String,
    pub account_type: String,
    pub needs_refresh: bool,
}

impl From<AccountData> for AccountDataSerializable {
    fn from(a: AccountData) -> Self {
        Self {
            access_token: a.access_token,
            uuid: a.uuid,
            username: a.username,
            nice_username: a.nice_username,
            account_type: a.account_type.to_string(),
            needs_refresh: a.needs_refresh,
        }
    }
}

/// Version list entry serializable for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct VersionListResult {
    pub versions: Vec<ListEntry>,
    pub latest_release: String,
}

/// Result of launching a game instance.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LaunchResult {
    pub instance_name: String,
    pub pid: Option<u32>,
    pub is_classic_server: bool,
}

// ---------- Helper functions ----------

/// Lists instance directories under the given `InstanceKind` root directory.
fn list_instance_dirs(kind: InstanceKind) -> Result<Vec<String>, String> {
    let root = kind.get_root_directory();
    std::fs::create_dir_all(&root).map_err(|e| e.to_string())?;

    let entries = std::fs::read_dir(&root).map_err(|e| e.to_string())?;
    let mut names = Vec::new();

    for entry in entries {
        let entry = entry.map_err(|e| e.to_string())?;
        let name = entry.file_name().to_string_lossy().to_string();
        // Skip hidden files and non-directories
        if name.starts_with('.') {
            continue;
        }
        if let Ok(metadata) = entry.metadata() {
            if metadata.is_dir() {
                names.push(name);
            }
        }
    }

    Ok(names)
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn get_client_instances() -> Result<Vec<String>, String> {
    let names = list_instance_dirs(InstanceKind::Client)?;
    Ok(names)
}

#[tauri::command]
pub async fn get_server_instances() -> Result<Vec<String>, String> {
    let names = list_instance_dirs(InstanceKind::Server)?;
    Ok(names)
}

#[tauri::command]
pub async fn create_instance(
    app: AppHandle,
    name: String,
    version: String,
    kind: InstanceKind,
    list_entry_kind: ListEntryKind,
    supports_server: bool,
) -> Result<String, String> {
    let (sender, receiver) = std::sync::mpsc::channel::<DownloadProgress>();

    // Spawn a task to forward progress events to the frontend
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let payload = DownloadProgressPayload::from(progress);
            let _ = app_clone.emit(EVENT_DOWNLOAD_PROGRESS, &payload);
        }
    });

    let entry = ListEntry {
        name: version,
        kind: list_entry_kind,
        supports_server,
    };

    let result = create_instance(name, entry, Some(sender), true).await;
    result.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn delete_instance(
    name: String,
    kind: InstanceKind,
) -> Result<(), String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&name),
        InstanceKind::Server => Instance::server(&name),
    };
    let instance_dir = instance.get_instance_path();
    tokio::fs::remove_dir_all(&instance_dir)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn rename_instance(
    old_name: String,
    new_name: String,
    kind: InstanceKind,
) -> Result<(), String> {
    let root = kind.get_root_directory();
    let old_path = root.join(&old_name);
    let new_path = root.join(&new_name);

    if !old_path.exists() {
        return Err(format!("Instance '{}' not found", old_name));
    }
    if new_path.exists() {
        return Err(format!("Instance '{}' already exists", new_name));
    }

    tokio::fs::rename(&old_path, &new_path)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_instance_config(
    name: String,
    kind: InstanceKind,
) -> Result<InstanceConfigJson, String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&name),
        InstanceKind::Server => Instance::server(&name),
    };
    InstanceConfigJson::read(&instance).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_instance_config(
    name: String,
    kind: InstanceKind,
    config: InstanceConfigJson,
) -> Result<(), String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&name),
        InstanceKind::Server => Instance::server(&name),
    };
    config.save(&instance).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn launch_game(
    app: AppHandle,
    state: State<'_, Arc<AppState>>,
    name: String,
    kind: InstanceKind,
    account_data: Option<AccountDataSerializable>,
    global_settings_json: Option<serde_json::Value>,
) -> Result<LaunchResult, String> {
    let global_settings: Option<ql_core::json::GlobalSettings> = global_settings_json
        .and_then(|v| serde_json::from_value(v).ok());

    let auth: Option<AccountData> = account_data.map(|a| AccountData {
        access_token: a.access_token,
        uuid: a.uuid,
        username: a.username.clone(),
        nice_username: a.nice_username,
        refresh_token: String::new(), // Will be refreshed on login
        needs_refresh: a.needs_refresh,
        account_type: match a.account_type.as_str() {
            "ElyBy" => ql_instances::auth::AccountType::ElyBy,
            "LittleSkin" => ql_instances::auth::AccountType::LittleSkin,
            _ => ql_instances::auth::AccountType::Microsoft,
        },
    });

    let username = auth
        .as_ref()
        .map(|a| a.nice_username.clone())
        .unwrap_or_else(|| "Steve".to_owned());

    let extra_java_args = Vec::new();

    let process = launch(
        Arc::from(name.clone()),
        username,
        None,
        auth,
        global_settings,
        extra_java_args,
    )
    .await
    .map_err(|e| e.to_string())?;

    let pid = process.child.lock().await.id();
    let is_classic = process.is_classic_server;

    // Store the process in state
    state
        .running_processes
        .lock()
        .await
        .insert(name.clone(), process.clone());

    // Spawn a task to monitor the process exit
    let app_clone = app.clone();
    let name_clone = name.clone();
    let state_inner = state.inner().clone();
    tokio::spawn(async move {
        let exit_status = process.child.lock().await.wait().await;
        let exit_code = exit_status.ok().and_then(|s| s.code());

        // Remove from state
        state_inner.running_processes.lock().await.remove(&name_clone);

        use crate::events::{EVENT_PROCESS_EXIT, ProcessExitPayload};
        let _ = app_clone.emit(
            EVENT_PROCESS_EXIT,
            ProcessExitPayload {
                instance_name: name_clone,
                exit_code,
                is_classic_server: is_classic,
            },
        );
    });

    Ok(LaunchResult {
        instance_name: name,
        pid,
        is_classic_server: is_classic,
    })
}

#[tauri::command]
pub async fn kill_game(
    state: State<'_, Arc<AppState>>,
    name: String,
) -> Result<bool, String> {
    let mut processes = state.running_processes.lock().await;
    if let Some(process) = processes.remove(&name) {
        let mut child = process.child.lock().await;
        child.start_kill().map_err(|e| e.to_string())?;
        Ok(true)
    } else {
        Ok(false)
    }
}

#[tauri::command]
pub async fn get_instance_notes(
    name: String,
    kind: InstanceKind,
) -> Result<String, String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&name),
        InstanceKind::Server => Instance::server(&name),
    };
    ql_instances::instance::notes::read(instance).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_instance_notes(
    name: String,
    kind: InstanceKind,
    notes: String,
) -> Result<(), String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&name),
        InstanceKind::Server => Instance::server(&name),
    };
    ql_instances::instance::notes::write(instance, notes).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_version_list(
) -> Result<VersionListResult, String> {
    let (versions, latest_release) = ql_instances::list_versions().await.map_err(|e| e.to_string())?;
    Ok(VersionListResult { versions, latest_release })
}

/// Re-download a specific download stage (libraries or assets) for an instance.
/// Used for "Reinstall Libraries" and "Update Assets" buttons.
#[tauri::command]
pub async fn redownload_instance_stage(
    app: AppHandle,
    name: String,
    stage: String,
) -> Result<(), String> {
    let instance = Instance::client(&name);

    let dl_stage = match stage.as_str() {
        "libraries" => DownloadProgress::DownloadingLibraries { progress: 0, out_of: 0 },
        "assets" => DownloadProgress::DownloadingAssets { progress: 0, out_of: 0 },
        _ => return Err(format!("Unknown redownload stage: {stage}")),
    };

    let (sender, receiver) = std::sync::mpsc::channel::<DownloadProgress>();

    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let payload = DownloadProgressPayload::from(progress);
            let _ = app_clone.emit(EVENT_DOWNLOAD_PROGRESS, &payload);
        }
    });

    ql_instances::repeat_stage(instance, dl_stage, Some(sender))
        .await
        .map_err(|e| e.to_string())
}
