use std::sync::Arc;

use ql_core::{Instance, InstanceKind, Loader};
use ql_mod_manager::loaders;
use ql_mod_manager::loaders::LoaderInstallResult;
use serde::{Deserialize, Serialize};
use tauri::AppHandle;

use crate::events::{EVENT_GENERIC_PROGRESS, GenericProgressPayload};

// ---------- Serializable types ----------

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LoaderVersion {
    pub version: String,
    pub stable: Option<bool>,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub enum LoaderInstallStatus {
    Ok,
    NeedsOptifine,
    Unsupported,
}

impl From<LoaderInstallResult> for LoaderInstallStatus {
    fn from(r: LoaderInstallResult) -> Self {
        match r {
            LoaderInstallResult::Ok => Self::Ok,
            LoaderInstallResult::NeedsOptifine => Self::NeedsOptifine,
            LoaderInstallResult::Unsupported => Self::Unsupported,
        }
    }
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn install_loader(
    app: AppHandle,
    instance_name: String,
    kind: InstanceKind,
    loader: Loader,
    version: Option<String>,
) -> Result<LoaderInstallStatus, String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&instance_name),
        InstanceKind::Server => Instance::server(&instance_name),
    };

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    let result = loaders::install_specified_loader(
        instance,
        loader,
        Some(Arc::new(sender)),
        version,
    )
    .await?;

    Ok(LoaderInstallStatus::from(result))
}

#[tauri::command]
pub async fn uninstall_loader(
    instance_name: String,
    kind: InstanceKind,
) -> Result<(), String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&instance_name),
        InstanceKind::Server => Instance::server(&instance_name),
    };

    loaders::uninstall_loader(instance)
        .await?;
    Ok(())
}

#[tauri::command]
pub async fn get_loader_versions(
    instance_name: String,
    kind: InstanceKind,
    loader: Loader,
) -> Result<Vec<LoaderVersion>, String> {
    let instance = match kind {
        InstanceKind::Client => Instance::client(&instance_name),
        InstanceKind::Server => Instance::server(&instance_name),
    };

    let is_quilt = matches!(loader, Loader::Quilt);

    let version_list = ql_mod_manager::loaders::fabric::version_list::get_list_of_versions(
        instance,
        is_quilt,
    )
    .await
    .map_err(|e| e.to_string())?;

    let versions = match version_list {
        ql_mod_manager::loaders::fabric::version_list::FabricVersionList::Fabric(list)
        | ql_mod_manager::loaders::fabric::version_list::FabricVersionList::Quilt(list)
        | ql_mod_manager::loaders::fabric::version_list::FabricVersionList::LegacyFabric(list)
        | ql_mod_manager::loaders::fabric::version_list::FabricVersionList::OrnitheMCFabric(list)
        | ql_mod_manager::loaders::fabric::version_list::FabricVersionList::OrnitheMCQuilt(list) => {
            list
        }
        ql_mod_manager::loaders::fabric::version_list::FabricVersionList::Beta173 { babric, .. }
        | ql_mod_manager::loaders::fabric::version_list::FabricVersionList::Both { legacy_fabric: babric, .. } => {
            babric
        }
        ql_mod_manager::loaders::fabric::version_list::FabricVersionList::Unsupported => {
            Vec::new()
        }
    };

    Ok(versions
        .into_iter()
        .map(|v| LoaderVersion {
            version: v.loader.version,
            stable: None,
        })
        .collect())
}
