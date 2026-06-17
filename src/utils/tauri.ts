import { invoke } from "@tauri-apps/api/core";
import type {
  Instance,
  InstanceConfigJson,
  LauncherConfig,
  ListEntry,
  AccountData,
  SearchResult,
  SearchMod,
  QueryType,
  StoreBackendType,
  Category,
  Loader,
  GenericProgress,
  ShortcutConfig,
  ModId,
  LocalMod,
  InstanceKind,
  ListEntryKind,
  ServerProperties,
  GlobalSettings,
  SidebarConfig,
} from "@/types";

// ===== Error Handling =====

export class TauriError extends Error {
  constructor(
    message: string,
    public code?: string
  ) {
    super(message);
    this.name = "TauriError";
  }
}

async function handleInvoke<T>(command: string, args?: Record<string, unknown>): Promise<T> {
  try {
    return await invoke<T>(command, args);
  } catch (err) {
    const msg = err instanceof Error ? err.message : String(err);
    throw new TauriError(msg);
  }
}

// ===== Backend serializable types (mirror Rust structs) =====

/** Account info returned from backend auth commands. */
export interface AccountInfo {
  access_token?: string | null;
  uuid: string;
  username: string;
  nice_username: string;
  account_type: string;
  needs_refresh: boolean;
}

/** Result of login_yggdrasil. */
export interface LoginResult {
  account: AccountInfo;
  is_needs_otp: boolean;
}

/** Mod info from store (search results / mod info). */
export interface ModInfoSerializable {
  title: string;
  description: string;
  downloads: number;
  internal_name: string;
  project_type: string;
  id: string;
  icon_url?: string | null;
  backend: StoreBackendType;
  gallery: Array<{ url: string; title?: string | null; description?: string | null }>;
}

/** Search result from backend. */
export interface SearchResultSerializable {
  mods: ModInfoSerializable[];
  backend: StoreBackendType;
  reached_end: boolean;
}

/** Category from backend. */
export interface CategorySerializable {
  name: string;
  slug: string;
  children: CategorySerializable[];
  internal_id?: number | null;
  is_usable: boolean;
}

/** Mod update entry. */
export interface ModUpdate {
  mod_id: string;
  new_version: string;
}

/** Export result with base64 zip data. */
export interface ExportResult {
  data: string;
  size: number;
}

/** Import result. */
export interface ImportResult {
  instance_name: string;
  is_server: boolean;
}

/** Version entry from backend version list. */
export interface VersionListResult {
  versions: ListEntry[];
  latest_release: string;
}

/** Launch result. */
export interface LaunchResult {
  instance_name: string;
  pid?: number | null;
  is_classic_server: boolean;
}

/** Loader version from backend. */
export interface LoaderVersion {
  version: string;
  stable?: boolean | null;
}

// ===== Instance Commands =====

export const tauriCommands = {
  // Instance listing
  get_client_instances: () => handleInvoke<string[]>("get_client_instances"),
  get_server_instances: () => handleInvoke<string[]>("get_server_instances"),

  // Instance management
  create_instance: (name: string, version: string, kind: InstanceKind, listEntryKind: ListEntryKind, supportsServer: boolean) =>
    handleInvoke<string>("create_instance", { name, version, kind, listEntryKind, supportsServer }),
  delete_instance: (name: string, kind: InstanceKind) =>
    handleInvoke<void>("delete_instance", { name, kind }),
  rename_instance: (oldName: string, newName: string, kind: InstanceKind) =>
    handleInvoke<void>("rename_instance", { oldName, newName, kind }),

  // Instance config
  get_instance_config: (name: string, kind: InstanceKind) =>
    handleInvoke<InstanceConfigJson>("get_instance_config", { name, kind }),
  save_instance_config: (name: string, kind: InstanceKind, config: InstanceConfigJson) =>
    handleInvoke<void>("save_instance_config", { name, kind, config }),

  // Instance notes
  get_instance_notes: (name: string, kind: InstanceKind) =>
    handleInvoke<string | null>("get_instance_notes", { name, kind }),
  save_instance_notes: (name: string, kind: InstanceKind, notes: string) =>
    handleInvoke<void>("save_instance_notes", { name, kind, notes }),

  // Version list
  get_version_list: () => handleInvoke<VersionListResult>("get_version_list"),

  // Re-download stage (libraries/assets)
  redownload_instance_stage: (name: string, stage: "libraries" | "assets") =>
    handleInvoke<void>("redownload_instance_stage", { name, stage }),

  // Game launch
  launch_game: (
    name: string,
    kind: InstanceKind,
    accountData: AccountInfo | null,
    globalSettingsJson: GlobalSettings | null,
  ) =>
    handleInvoke<LaunchResult>("launch_game", { name, kind, accountData, globalSettingsJson }),
  kill_game: (name: string) =>
    handleInvoke<boolean>("kill_game", { name }),

  // Launcher config
  get_config: () => handleInvoke<LauncherConfig>("get_config"),
  save_config: (config: LauncherConfig) =>
    handleInvoke<void>("save_config", { config }),

  // Global settings
  get_global_settings: () => handleInvoke<GlobalSettings>("get_global_settings"),
  save_global_settings: (settings: GlobalSettings) =>
    handleInvoke<void>("save_global_settings", { settings }),

  // Accounts
  get_accounts: () => handleInvoke<Record<string, AccountInfo>>("get_accounts"),
  login_microsoft: () => handleInvoke<{ user_code: string; verification_uri: string; message: string; expires_in: number }>("login_microsoft"),
  poll_microsoft_login: (userCode: string) => handleInvoke<AccountInfo | null>("poll_microsoft_login", { userCode }),
  login_offline: (username: string) => handleInvoke<AccountInfo>("login_offline", { username }),
  login_yggdrasil: (username: string, password: string, authType: string, authUrl?: string) =>
    handleInvoke<LoginResult>("login_yggdrasil", { username, password, authType, authUrl }),
  logout_account: (username: string, accountType: string) =>
    handleInvoke<void>("logout_account", { username, accountType }),
  refresh_account: (username: string, accountType: string) =>
    handleInvoke<AccountInfo>("refresh_account", { username, accountType }),

  // Mod Store
  search_mods: (
    params: {
      name: string;
      version: string;
      loader: Loader;
      server_side: boolean;
      kind: QueryType;
      open_source: boolean;
      categories: CategorySerializable[];
      categories_use_all: boolean;
    },
    offset: number,
    backend: StoreBackendType,
  ) =>
    handleInvoke<SearchResultSerializable>("search_mods", { params, offset, backend }),

  get_mod_info: (id: string, backend: StoreBackendType) =>
    handleInvoke<ModInfoSerializable>("get_mod_info", { id, backend }),

  get_mod_description: (id: string) =>
    handleInvoke<[string, string]>("get_mod_description", { id }),

  download_mod: (
    id: string,
    instanceName: string,
    kind: InstanceKind,
    backend: StoreBackendType,
  ) =>
    handleInvoke<void>("download_mod", { id, instanceName, kind, backend }),

  download_mods_bulk: (
    ids: string[],
    instanceName: string,
    kind: InstanceKind,
  ) =>
    handleInvoke<void>("download_mods_bulk", { ids, instanceName, kind }),

  get_local_mods: (instanceName: string, kind: InstanceKind) =>
    handleInvoke<LocalMod[]>("get_local_mods", { instanceName, kind }),

  toggle_mod: (instanceName: string, kind: InstanceKind, ids: string[]) =>
    handleInvoke<void>("toggle_mod", { instanceName, kind, ids }),

  delete_mod: (instanceName: string, kind: InstanceKind, ids: string[]) =>
    handleInvoke<void>("delete_mod", { instanceName, kind, ids }),

  check_mod_updates: (instanceName: string, kind: InstanceKind) =>
    handleInvoke<ModUpdate[]>("check_mod_updates", { instanceName, kind }),

  apply_mod_updates: (instanceName: string, kind: InstanceKind, updates: ModUpdate[]) =>
    handleInvoke<void>("apply_mod_updates", { instanceName, kind, updates }),

  install_modpack: (filePath: string, instanceName: string, kind: InstanceKind) =>
    handleInvoke<void>("install_modpack", { filePath, instanceName, kind }),

  add_mod_files: (paths: string[], instanceName: string, kind: InstanceKind, projectType: QueryType) =>
    handleInvoke<void>("add_mod_files", { paths, instanceName, kind, projectType }),

  get_categories: (queryType: QueryType, backend: StoreBackendType) =>
    handleInvoke<CategorySerializable[]>("get_categories", { queryType, backend }),

  // Loader
  get_loader_versions: (instanceName: string, kind: InstanceKind, loader: Loader) =>
    handleInvoke<LoaderVersion[]>("get_loader_versions", { instanceName, kind, loader }),
  install_loader: (instanceName: string, kind: InstanceKind, loader: Loader, version?: string | null) =>
    handleInvoke<string>("install_loader", { instanceName, kind, loader, version }),
  uninstall_loader: (instanceName: string, kind: InstanceKind) =>
    handleInvoke<void>("uninstall_loader", { instanceName, kind }),

  // Server
  create_server: (name: string, version: string, listEntryKind: string, supportsServer: boolean) =>
    handleInvoke<{ name: string }>("create_server", { name, version, listEntryKind, supportsServer }),
  delete_server: (name: string) =>
    handleInvoke<void>("delete_server", { name }),
  run_server: (name: string) =>
    handleInvoke<{ server_name: string; pid?: number | null; is_classic_server: boolean }>("run_server", { name }),
  get_server_properties: (name: string) =>
    handleInvoke<Record<string, string>>("get_server_properties", { name }),
  save_server_properties: (name: string, entries: Record<string, string>) =>
    handleInvoke<void>("save_server_properties", { name, entries }),
  send_server_command: (name: string, command: string) =>
    handleInvoke<boolean>("send_server_command", { name, command }),

  // Export/Import
  export_instance: (name: string, kind: InstanceKind, exceptions: string[]) =>
    handleInvoke<ExportResult>("export_instance", { name, kind, exceptions }),
  import_instance: (filePath: string) =>
    handleInvoke<ImportResult | null>("import_instance", { filePath }),

  // Java
  get_java_versions: (version: number, instanceName?: string | null) =>
    handleInvoke<string>("get_java_versions", { version, instanceName }),
  find_java_in_dir: (name: string, dir: string) =>
    handleInvoke<string>("find_java_in_dir", { name, dir }),
  clear_java_installs: () => handleInvoke<void>("clear_java_installs"),
  delete_java_installs: () => handleInvoke<void>("delete_java_installs"),

  // Logs
  upload_log: (log: string) => handleInvoke<string>("upload_log", { log }),

  // Shortcuts
  create_shortcut: (config: ShortcutConfig) =>
    handleInvoke<void>("create_shortcut", { config }),

  // Maintenance
  clear_cache: () => handleInvoke<void>("clear_cache"),
  clean_assets: () => handleInvoke<void>("clean_assets"),

  // Sidebar
  get_sidebar_config: () =>
    handleInvoke<SidebarConfig>("get_sidebar_config"),
  save_sidebar_config: (config: SidebarConfig) =>
    handleInvoke<void>("save_sidebar_config", { config }),

  // Changelog
  get_changelog: () => handleInvoke<string>("get_changelog"),

  // Launcher info
  get_launcher_version: () => handleInvoke<string>("get_launcher_version"),
};