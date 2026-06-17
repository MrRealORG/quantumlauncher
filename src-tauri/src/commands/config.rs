use ql_core::{
    clean, file_utils,
    json::GlobalSettings,
    LAUNCHER_CACHE_DIR,
};
use serde::{Deserialize, Serialize};

// ---------- Serializable types ----------

/// The launcher's global configuration.
/// Stored at `PKLauncher/config.json`.
#[derive(Debug, Clone, Serialize, Deserialize, Default)]
pub struct LauncherConfig {
    pub java_args: Vec<String>,
    pub pre_launch_prefix: Vec<String>,
    pub close_on_start: bool,
    #[serde(flatten)]
    pub extra: serde_json::HashMap<String, serde_json::Value>,
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn get_config() -> Result<LauncherConfig, String> {
    let config_path = ql_core::LAUNCHER_DIR.join("config.json");

    if !tokio::fs::try_exists(&config_path).await.unwrap_or(false) {
        return Ok(LauncherConfig::default());
    }

    let contents = tokio::fs::read_to_string(&config_path)
        .await
        .map_err(|e| e.to_string())?;

    serde_json::from_str(&contents).map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn save_config(config: LauncherConfig) -> Result<(), String> {
    let config_path = ql_core::LAUNCHER_DIR.join("config.json");
    let json = serde_json::to_string_pretty(&config).map_err(|e| e.to_string())?;
    tokio::fs::write(&config_path, json)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn get_global_settings() -> Result<GlobalSettings, String> {
    // Global settings are stored alongside the launcher config.
    // We read them from the launcher config file's global_settings field.
    let config_path = ql_core::LAUNCHER_DIR.join("config.json");

    if !tokio::fs::try_exists(&config_path).await.unwrap_or(false) {
        return Ok(GlobalSettings::default());
    }

    let contents = tokio::fs::read_to_string(&config_path)
        .await
        .map_err(|e| e.to_string())?;

    let value: serde_json::Value = serde_json::from_str(&contents).map_err(|e| e.to_string())?;

    Ok(value
        .get("global_settings")
        .and_then(|v| serde_json::from_value(v.clone()).ok())
        .unwrap_or_default())
}

#[tauri::command]
pub async fn save_global_settings(settings: GlobalSettings) -> Result<(), String> {
    let config_path = ql_core::LAUNCHER_DIR.join("config.json");

    let mut value: serde_json::Value = if tokio::fs::try_exists(&config_path).await.unwrap_or(false) {
        let contents = tokio::fs::read_to_string(&config_path)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&contents).map_err(|e| e.to_string())?
    } else {
        serde_json::json!({})
    };

    let settings_json = serde_json::to_value(settings).map_err(|e| e.to_string())?;
    value["global_settings"] = settings_json;

    let json = serde_json::to_string_pretty(&value).map_err(|e| e.to_string())?;
    tokio::fs::write(&config_path, json)
        .await
        .map_err(|e| e.to_string())
}

#[tauri::command]
pub async fn clear_java_installs() -> Result<(), String> {
    ql_java_handler::delete_java_installs().await;
    Ok(())
}

#[tauri::command]
pub async fn clear_cache() -> Result<u64, String> {
    let size = clean::clear_cache_dir().await.map_err(|e| e.to_string())?;
    Ok(size)
}

#[tauri::command]
pub async fn clean_assets() -> Result<u64, String> {
    let cleaned_size = clean::assets_dir().await.map_err(|e| e.to_string())?;
    Ok(cleaned_size)
}

// ---------- Utility commands ----------

#[tauri::command]
pub async fn get_sidebar_config() -> Result<serde_json::Value, String> {
    let config_path = ql_core::LAUNCHER_DIR.join("config.json");
    if !config_path.exists() {
        return Ok(serde_json::json!({ "list": [] }));
    }
    let content = tokio::fs::read_to_string(&config_path)
        .await
        .map_err(|e| e.to_string())?;
    let v: serde_json::Value = serde_json::from_str(&content).unwrap_or_default();
    Ok(v.get("sidebar").cloned().unwrap_or(serde_json::json!({ "list": [] })))
}

#[tauri::command]
pub async fn save_sidebar_config(config: serde_json::Value) -> Result<(), String> {
    let config_path = ql_core::LAUNCHER_DIR.join("config.json");
    let mut v: serde_json::Value = if config_path.exists() {
        let content = tokio::fs::read_to_string(&config_path)
            .await
            .map_err(|e| e.to_string())?;
        serde_json::from_str(&content).unwrap_or_default()
    } else {
        serde_json::json!({})
    };
    v["sidebar"] = config;
    let content = serde_json::to_string_pretty(&v).map_err(|e| e.to_string())?;
    tokio::fs::write(&config_path, content)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_changelog() -> Result<String, String> {
    let changelog_dir = std::path::Path::new(env!("CARGO_MANIFEST_DIR"))
        .join("../../changelogs");
    // Find the latest changelog file
    if let Ok(entries) = std::fs::read_dir(&changelog_dir) {
        let mut files: Vec<_> = entries
            .filter_map(|e| e.ok())
            .filter(|e| e.path().extension().map_or(false, |ext| ext == "md"))
            .collect();
        files.sort_by(|a, b| b.file_name().cmp(&a.file_name()));
        if let Some(first) = files.first() {
            return tokio::fs::read_to_string(first.path())
                .await
                .map_err(|e| e.to_string());
        }
    }
    Ok("No changelog available.".to_string())
}

#[tauri::command]
pub async fn get_launcher_version() -> Result<String, String> {
    Ok(ql_core::LAUNCHER_VERSION_NAME.to_string())
}

#[tauri::command]
pub async fn upload_log(log_content: String) -> Result<String, String> {
    // Upload to mclo.gs via their API
    let client = reqwest::Client::new();
    let resp = client
        .post("https://api.mclo.gs/1/log")
        .json(&serde_json::json!({ "content": log_content }))
        .send()
        .await
        .map_err(|e| e.to_string())?;
    let data: serde_json::Value = resp.json().await.map_err(|e| e.to_string())?;
    data.get("url")
        .and_then(|u| u.as_str())
        .map(|s| s.to_string())
        .ok_or_else(|| "Failed to get upload URL".to_string())
}
