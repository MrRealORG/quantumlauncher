use std::collections::HashSet;
use std::sync::Arc;

use ql_core::{Instance, InstanceKind, Loader};
use ql_mod_manager::store::{
    ModError, ModId, ModIndex, Query, QueryType, SearchMod, SearchResult, StoreBackendType,
    add_files, check_for_updates, delete_mods, download_mod, download_mods_bulk,
    get_categories, get_description, get_info, search, toggle_mods,
    update::{apply_updates, ChangelogFile},
};
use ql_mod_manager::store::modpack::install_modpack;
use serde::{Deserialize, Serialize};
use tauri::{AppHandle, Emitter};

use crate::events::{EVENT_GENERIC_PROGRESS, GenericProgressPayload};

// ---------- Serializable types for frontend ----------

/// Serializable mod information for the frontend.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModInfoSerializable {
    pub title: Arc<str>,
    pub description: String,
    pub downloads: usize,
    pub internal_name: String,
    pub project_type: String,
    pub id: String,
    pub icon_url: Option<String>,
    pub backend: StoreBackendType,
    pub gallery: Vec<GalleryItemSerializable>,
}

impl From<SearchMod> for ModInfoSerializable {
    fn from(m: SearchMod) -> Self {
        Self {
            title: m.title,
            description: m.description,
            downloads: m.downloads,
            internal_name: m.internal_name,
            project_type: m.project_type,
            id: m.id.to_string(),
            icon_url: m.icon_url,
            backend: m.backend,
            gallery: m.gallery.into_iter().map(Into::into).collect(),
        }
    }
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct GalleryItemSerializable {
    pub url: String,
    pub title: Option<String>,
    pub description: Option<String>,
}

impl From<ql_mod_manager::store::GalleryItem> for GalleryItemSerializable {
    fn from(g: ql_mod_manager::store::GalleryItem) -> Self {
        Self {
            url: g.url,
            title: g.title,
            description: g.description,
        }
    }
}

/// Serializable mod from the local index.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct LocalModSerializable {
    pub id: String,
    pub name: Arc<str>,
    pub description: String,
    pub enabled: bool,
    pub installed_version: String,
    pub project_type: QueryType,
    pub project_source: StoreBackendType,
    pub icon_url: Option<String>,
}

/// Search query parameters.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchQueryParams {
    pub name: String,
    pub version: String,
    pub loader: Loader,
    pub server_side: bool,
    pub kind: QueryType,
    pub open_source: bool,
    pub categories: Vec<CategorySerializable>,
    pub categories_use_all: bool,
}

#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct CategorySerializable {
    pub name: String,
    pub slug: String,
    pub children: Vec<CategorySerializable>,
    pub internal_id: Option<i32>,
    pub is_usable: bool,
}

impl From<ql_mod_manager::store::Category> for CategorySerializable {
    fn from(c: ql_mod_manager::store::Category) -> Self {
        Self {
            name: c.name,
            slug: c.slug,
            children: c.children.into_iter().map(Into::into).collect(),
            internal_id: c.internal_id,
            is_usable: c.is_usable,
        }
    }
}

/// Search result serializable.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct SearchResultSerializable {
    pub mods: Vec<ModInfoSerializable>,
    pub backend: StoreBackendType,
    pub reached_end: bool,
}

/// Update entry.
#[derive(Debug, Clone, Serialize, Deserialize)]
pub struct ModUpdate {
    pub mod_id: String,
    pub new_version: String,
}

// ---------- Helpers ----------

fn parse_mod_id(id_str: &str) -> ModId {
    if let Some(rest) = id_str.strip_prefix("CF:") {
        ModId::Curseforge(Arc::from(rest))
    } else {
        ModId::Modrinth(Arc::from(id_str))
    }
}

fn make_instance(name: &str, kind: InstanceKind) -> Instance {
    match kind {
        InstanceKind::Client => Instance::client(name),
        InstanceKind::Server => Instance::server(name),
    }
}

fn parse_query(params: SearchQueryParams) -> Query {
    Query {
        name: params.name,
        version: params.version,
        loader: params.loader,
        server_side: params.server_side,
        kind: params.kind,
        open_source: params.open_source,
        categories: params.categories.into_iter().map(|c| ql_mod_manager::store::Category {
            name: c.name,
            slug: c.slug,
            children: c.children.into_iter().map(|cc| ql_mod_manager::store::Category {
                name: cc.name,
                slug: cc.slug,
                children: Vec::new(),
                internal_id: cc.internal_id,
                is_usable: cc.is_usable,
            }).collect(),
            internal_id: c.internal_id,
            is_usable: c.is_usable,
        }).collect(),
        categories_use_all: params.categories_use_all,
    }
}

// ---------- Tauri Commands ----------

#[tauri::command]
pub async fn search_mods(
    params: SearchQueryParams,
    offset: usize,
    backend: StoreBackendType,
) -> Result<SearchResultSerializable, String> {
    let query = parse_query(params);
    let result = search(query, offset, backend).await.map_err(|e| e.to_string())?;
    Ok(SearchResultSerializable {
        mods: result.mods.into_iter().map(Into::into).collect(),
        backend: result.backend,
        reached_end: result.reached_end,
    })
}

#[tauri::command]
pub async fn get_mod_info(
    id: String,
    backend: StoreBackendType,
) -> Result<ModInfoSerializable, String> {
    let mod_id = parse_mod_id(&id);
    let info = get_info(&mod_id).await.map_err(|e| e.to_string())?;
    Ok(ModInfoSerializable::from(info))
}

#[tauri::command]
pub async fn get_mod_description(
    id: String,
) -> Result<(String, String), String> {
    let mod_id = parse_mod_id(&id);
    let (returned_id, description) = get_description(mod_id).await.map_err(|e| e.to_string())?;
    Ok((returned_id.to_string(), description))
}

#[tauri::command]
pub async fn download_mod(
    app: AppHandle,
    id: String,
    instance_name: String,
    kind: InstanceKind,
    backend: StoreBackendType,
) -> Result<(), String> {
    let instance = make_instance(&instance_name, kind);
    let mod_id = parse_mod_id(&id);

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    download_mod(&mod_id, &instance, Some(sender)).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn download_mods_bulk(
    app: AppHandle,
    ids: Vec<String>,
    instance_name: String,
    kind: InstanceKind,
) -> Result<(), String> {
    let instance = make_instance(&instance_name, kind);
    let mod_ids: Vec<ModId> = ids.iter().map(|s| parse_mod_id(s)).collect();

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    download_mods_bulk(mod_ids, instance, Some(sender))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_local_mods(
    instance_name: String,
    kind: InstanceKind,
) -> Result<Vec<LocalModSerializable>, String> {
    let instance = make_instance(&instance_name, kind);
    let index = ModIndex::load(&instance).await.map_err(|e| e.to_string())?;

    let mods = index
        .mods
        .into_iter()
        .map(|(id, config)| LocalModSerializable {
            id: id.to_string(),
            name: config.name,
            description: config.description,
            enabled: config.enabled,
            installed_version: config.installed_version,
            project_type: config.project_type,
            project_source: config.project_source,
            icon_url: config.icon_url,
        })
        .collect();

    Ok(mods)
}

#[tauri::command]
pub async fn delete_mod(
    instance_name: String,
    kind: InstanceKind,
    ids: Vec<String>,
) -> Result<(), String> {
    let instance = make_instance(&instance_name, kind);
    let mod_ids: Vec<ModId> = ids.iter().map(|s| parse_mod_id(s)).collect();
    delete_mods(mod_ids, instance).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn toggle_mod(
    instance_name: String,
    kind: InstanceKind,
    ids: Vec<String>,
) -> Result<(), String> {
    let instance = make_instance(&instance_name, kind);
    let mod_ids: Vec<ModId> = ids.iter().map(|s| parse_mod_id(s)).collect();
    toggle_mods(mod_ids, instance).await.map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn check_mod_updates(
    instance_name: String,
    kind: InstanceKind,
) -> Result<Vec<ModUpdate>, String> {
    let instance = make_instance(&instance_name, kind);
    let updates = check_for_updates(instance).await.map_err(|e| e.to_string())?;

    Ok(updates
        .into_iter()
        .map(|(id, version)| ModUpdate {
            mod_id: id.to_string(),
            new_version: version,
        })
        .collect())
}

#[tauri::command]
pub async fn apply_mod_updates(
    app: AppHandle,
    instance_name: String,
    kind: InstanceKind,
    updates: Vec<ModUpdate>,
) -> Result<(), String> {
    let instance = make_instance(&instance_name, kind);
    let update_pairs: Vec<(ModId, String)> = updates
        .into_iter()
        .map(|u| (parse_mod_id(&u.mod_id), u.new_version))
        .collect();

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    apply_updates(instance, update_pairs, Some(sender), false)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn install_modpack(
    app: AppHandle,
    file_path: String,
    instance_name: String,
    kind: InstanceKind,
) -> Result<(), String> {
    let instance = make_instance(&instance_name, kind);
    let path = std::path::PathBuf::from(&file_path);

    let file = tokio::fs::read(&path)
        .await
        .map_err(|e| format!("Failed to read modpack file: {e}"))?;

    let filename = path
        .file_name()
        .and_then(|n| n.to_str())
        .map(str::to_owned);

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    install_modpack(file, filename, instance, Some(&sender))
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}

#[tauri::command]
pub async fn get_categories(
    query_type: QueryType,
    backend: StoreBackendType,
) -> Result<Vec<CategorySerializable>, String> {
    let categories = get_categories(query_type, backend)
        .await
        .map_err(|e| e.to_string())?;
    Ok(categories.into_iter().map(Into::into).collect())
}

#[tauri::command]
pub async fn add_mod_files(
    app: AppHandle,
    paths: Vec<String>,
    instance_name: String,
    kind: InstanceKind,
    project_type: QueryType,
) -> Result<(), String> {
    let instance = make_instance(&instance_name, kind);
    let file_paths: Vec<std::path::PathBuf> = paths.iter().map(std::path::PathBuf::from).collect();

    let (sender, receiver) = std::sync::mpsc::channel();
    let app_clone = app.clone();
    tokio::spawn(async move {
        while let Ok(progress) = receiver.recv() {
            let _ = app_clone.emit(EVENT_GENERIC_PROGRESS, GenericProgressPayload::from(progress));
        }
    });

    add_files(instance, file_paths, Some(sender), project_type)
        .await
        .map_err(|e| e.to_string())?;
    Ok(())
}
