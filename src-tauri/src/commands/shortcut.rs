use ezshortcut::Shortcut;
use serde::{Deserialize, Serialize};

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn create_shortcut(
    name: String,
    description: String,
    exec: String,
    exec_args: Vec<String>,
    icon_path: String,
    target_path: Option<String>,
) -> Result<(), String> {
    let shortcut = Shortcut {
        name,
        description,
        exec,
        exec_args,
        icon: icon_path,
    };

    if let Some(target) = target_path {
        let path = std::path::Path::new(&target);
        shortcut.generate(path).await.map_err(|e| e.to_string())?;
    } else {
        shortcut
            .generate_to_applications()
            .await
            .map_err(|e| e.to_string())?;
    }

    Ok(())
}
