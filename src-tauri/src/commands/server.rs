use std::collections::HashMap;
use std::sync::Arc;

use ql_core::ListEntry;
use ql_servers::{self, ServerProperties};
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::events::{DownloadProgressPayload, EVENT_DOWNLOAD_PROGRESS};
use crate::state::AppState;

// ---------- Serializable types ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CreateServerResult {
    pub name: String,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct RunServerResult {
    pub server_name: String,
    pub pid: Option<u32>,
    pub is_classic_server: bool,
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn create_server(
    app: AppHandle,
    name: String,
    version: String,
    list_entry_kind: String,
    supports_server: bool,
) -> Result<CreateServerResult, String> {
    use ql_core::ListEntryKind;

    let kind = match list_entry_kind.as_str() {
        "release" => ListEntryKind::Release,
        "snapshot" => ListEntryKind::Snapshot,
        "preclassic" => ListEntryKind::Preclassic,
        "classic" => ListEntryKind::Classic,
        "indev" => ListEntryKind::Indev,
        "infdev" => ListEntryKind::Infdev,
        "alpha" => ListEntryKind::Alpha,
        "beta" => ListEntryKind::Beta,
        "april-fools" => ListEntryKind::AprilFools,
        "special" => ListEntryKind::Special,
        _ => ListEntryKind::Release,
    };

    let entry = ListEntry {
        name: version,
        kind,
        supports_server,
    };

    let (sender, receiver) = std::sync::mpsc::channel();

    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_DOWNLOAD_PROGRESS, DownloadProgressPayload::from(progress));
        }
    });

    let result = ql_servers::create_server(name, entry, Some(&sender))
        .await
        .map_err(|e| e.to_string())?;

    Ok(CreateServerResult { name: result })
}

#[tauri::command]
pub async fn delete_server(
    name: String,
) -> Result<(), String> {
    ql_servers::delete_server(&name).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn run_server(
    app: AppHandle,
    state: tauri::State<'_, AppState>,
    name: String,
) -> Result<RunServerResult, String> {
    let (sender, receiver) = std::sync::mpsc::channel();

    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            use crate::events::{EVENT_GENERIC_PROGRESS, GenericProgressPayload};
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    let process = ql_servers::run(Arc::from(name.clone()), Some(sender))
        .await
        .map_err(|e| e.to_string())?;

    let pid = process.child.lock().await.id();
    let is_classic = process.is_classic_server;

    // Store the process
    state
        .running_processes
        .lock()
        .await
        .insert(name.clone(), process.clone());

    // Monitor exit
    let app_clone = app.clone();
    let name_clone = name.clone();
    let state_inner = state.inner().clone();
    tokio::spawn(async move {
        let exit_status = process.child.lock().await.wait().await;
        let exit_code = exit_status.ok().and_then(|s| s.code());

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

    Ok(RunServerResult {
        server_name: name,
        pid,
        is_classic_server: is_classic,
    })
}

#[tauri::command]
pub async fn get_server_properties(
    name: String,
) -> Result<HashMap<String, String>, String> {
    let props = ServerProperties::load(&name)
        .await
        .ok_or_else(|| format!("Server '{}' not found or properties file missing", name))?;
    Ok(props.entries)
}

#[tauri::command]
pub async fn save_server_properties(
    name: String,
    entries: HashMap<String, String>,
) -> Result<(), String> {
    let props = ServerProperties { entries };
    props.save(&name).await.map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn send_server_command(
    state: tauri::State<'_, AppState>,
    name: String,
    command: String,
) -> Result<bool, String> {
    let processes = state.running_processes.lock().await;
    if let Some(process) = processes.get(&name) {
        use std::io::Write;
        use tokio::io::AsyncWriteExt;

        let mut child = process.child.lock().await;
        if let Some(stdin) = child.stdin.as_mut() {
            let cmd_with_newline = format!("{}\n", command);
            stdin
                .write_all(cmd_with_newline.as_bytes())
                .await
                .map_err(|e| e.to_string())?;
            stdin.flush().await.map_err(|e| e.to_string())?;
            return Ok(true);
        }
        return Ok(false);
    }
    Ok(false)
}
