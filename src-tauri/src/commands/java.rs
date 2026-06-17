use serde::{Deserialize, Serialize};

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn get_java_versions(
    app: tauri::AppHandle,
    version: usize,
    _instance_name: Option<String>,
) -> Result<String, String> {
    let java_version = match version {
        8 => ql_core::JavaVersion::Java8,
        16 => ql_core::JavaVersion::Java16,
        17 => ql_core::JavaVersion::Java17,
        21 => ql_core::JavaVersion::Java21,
        25 => ql_core::JavaVersion::Java25,
        _ => ql_core::JavaVersion::Java21,
    };

    let (sender, receiver) = std::sync::mpsc::channel();

    // Forward progress to frontend
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            use crate::events::{EVENT_GENERIC_PROGRESS, GenericProgressPayload};
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    let path = ql_java_handler::get_java_binary(java_version, ql_java_handler::JAVA, Some(&sender))
        .await
        .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn find_java_in_dir(
    name: String,
    dir: String,
) -> Result<String, String> {
    let dir = std::path::PathBuf::from(&dir);
    let path = ql_java_handler::find_java_bin_in_dir(&name, &dir)
        .await
        .map_err(|e| e.to_string())?;

    Ok(path.to_string_lossy().to_string())
}

#[tauri::command]
pub async fn delete_java_installs() -> Result<(), String> {
    ql_java_handler::delete_java_installs().await;
    Ok(())
}
