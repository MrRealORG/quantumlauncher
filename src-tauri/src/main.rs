// PK Launcher - Tauri v2 Backend
// Rebranded from QuantumLauncher

mod commands;
mod events;
mod state;

use std::sync::Arc;

use state::AppState;

use tauri::{
    Manager,
    menu::{Menu, MenuItem, PredefinedMenuItem},
};

#[cfg_attr(mobile, tauri::mobile_entry_point)]
pub fn run() {
    let icon = tauri::image::Image::from_bytes(include_bytes!("../../assets/icon/ql_logo.ico"))
        .expect("Failed to load window icon");

    tauri::Builder::default()
        .plugin(tauri_plugin_shell::init())
        .plugin(tauri_plugin_dialog::init())
        .plugin(tauri_plugin_fs::init())
        .manage(Arc::new(AppState::new()))
        .setup(|app| {
            // Ensure the launcher directory exists on first run
            let _ = &*ql_core::LAUNCHER_DIR;
            Ok(())
        })
        .menu(|app| {
            let hide = MenuItem::with_id(app, "hide", "Hide", true, None::<&str>)?;
            let quit = MenuItem::with_id(app, "quit", "Quit", true, None::<&str>)?;
            let show = MenuItem::with_id(app, "show", "Show", true, None::<&str>)?;
            Menu::with_items(app, &[
                &show,
                &PredefinedMenuItem::separator(app)?,
                &hide,
                &quit,
            ]?)
        })
        .on_menu_event(|app, event| {
            match event.id().as_ref() {
                "quit" => {
                    app.exit(0);
                }
                "hide" => {
                    let _ = app.hide();
                }
                "show" => {
                    let _ = app.show();
                }
                _ => {}
            }
        })
        .invoke_handler(tauri::generate_handler![
            // Instance commands
            commands::instance::get_client_instances,
            commands::instance::get_server_instances,
            commands::instance::create_instance,
            commands::instance::delete_instance,
            commands::instance::rename_instance,
            commands::instance::get_instance_config,
            commands::instance::save_instance_config,
            commands::instance::launch_game,
            commands::instance::kill_game,
            commands::instance::get_instance_notes,
            commands::instance::save_instance_notes,
            commands::instance::get_version_list,
            // Auth commands
            commands::auth::get_accounts,
            commands::auth::login_microsoft,
            commands::auth::poll_microsoft_login,
            commands::auth::login_offline,
            commands::auth::login_yggdrasil,
            commands::auth::logout_account,
            commands::auth::refresh_account,
            // Mod commands
            commands::mods::search_mods,
            commands::mods::get_mod_info,
            commands::mods::get_mod_description,
            commands::mods::download_mod,
            commands::mods::download_mods_bulk,
            commands::mods::get_local_mods,
            commands::mods::delete_mod,
            commands::mods::toggle_mod,
            commands::mods::check_mod_updates,
            commands::mods::apply_mod_updates,
            commands::mods::install_modpack,
            commands::mods::get_categories,
            commands::mods::add_mod_files,
            // Loader commands
            commands::loader::install_loader,
            commands::loader::uninstall_loader,
            commands::loader::get_loader_versions,
            // Server commands
            commands::server::create_server,
            commands::server::delete_server,
            commands::server::run_server,
            commands::server::get_server_properties,
            commands::server::save_server_properties,
            commands::server::send_server_command,
            // Config commands
            commands::config::get_config,
            commands::config::save_config,
            commands::config::get_global_settings,
            commands::config::save_global_settings,
            commands::config::clear_java_installs,
            commands::config::clear_cache,
            commands::config::clean_assets,
            // Packager commands
            commands::packager::export_instance,
            commands::packager::import_instance,
            // Java commands
            commands::java::get_java_versions,
            commands::java::find_java_in_dir,
            commands::java::delete_java_installs,
            // Shortcut commands
            commands::shortcut::create_shortcut,
            // Utility commands
            commands::config::get_sidebar_config,
            commands::config::save_sidebar_config,
            commands::config::get_changelog,
            commands::config::get_launcher_version,
            commands::config::upload_log,
        ])
        .run(tauri::generate_context!())
        .expect("error while running PK Launcher");
}

fn main() {
    run();
}