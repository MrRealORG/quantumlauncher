use std::collections::HashSet;

use base64::{Engine as _, engine::general_purpose::STANDARD};
use ql_core::{Instance, InstanceKind};
use ql_packager::{self, export_instance, import_instance};
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::events::{EVENT_GENERIC_PROGRESS, GenericProgressPayload};

// ---------- Serializable types ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ExportResult {
    /// Base64-encoded zip file data
    pub data: String,
    /// Size in bytes
    pub size: usize,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ImportResult {
    pub instance_name: String,
    pub is_server: bool,
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn export_instance(
    app: AppHandle,
    name: String,
    kind: InstanceKind,
    exceptions: Vec<String>,
) -> Result<ExportResult, String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&name),
        InstanceKind::Server => Instance::server(&name),
    };

    let exceptions_set: HashSet<String> = exceptions.into_iter().collect();

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    let bytes = export_instance(instance, exceptions_set, Some(sender))
        .await
        .map_err(|e| e.to_string())?;

    let size = bytes.len();
    let data = STANDARD.encode(&bytes);

    Ok(ExportResult { data, size })
}

#[tauri::command]
pub async fn import_instance(
    app: AppHandle,
    file_path: String,
) -> Result<Option<ImportResult>, String> {
    let path = std::path::PathBuf::from(&file_path);

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    let result = import_instance(path, true, Some(sender))
        .await
        .map_err(|e| e.to_string())?;

    match result {
        Some(instance) => Ok(Some(ImportResult {
            instance_name: instance.get_name().to_string(),
            is_server: instance.is_server(),
        })),
        None => Ok(None),
    }
}
