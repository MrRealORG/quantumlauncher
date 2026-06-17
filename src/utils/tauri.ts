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

// ===== Instance Commands =====

export const tauriCommands = {
  // Instance listing
  get_client_instances: () => handleInvoke<string[]>("get_client_instances"),
  get_server_instances: () => handleInvoke<string[]>("get_server_instances"),

  // Instance management
  create_instance: (name: string, version: string, kind: string) =>
    handleInvoke<void>("create_instance", { name, version, kind }),
  delete_instance: (name: string, kind: string) =>
    handleInvoke<void>("delete_instance", { name, kind }),
  rename_instance: (oldName: string, newName: string, kind: string) =>
    handleInvoke<void>("rename_instance", { oldName, newName, kind }),

  // Instance config
  get_instance_config: (name: string, kind: string) =>
    handleInvoke<InstanceConfigJson>("get_instance_config", { name, kind }),
  save_instance_config: (name: string, kind: string, config: InstanceConfigJson) =>
    handleInvoke<void>("save_instance_config", { name, kind, config }),

  // Instance notes
  get_instance_notes: (name: string, kind: string) =>
    handleInvoke<string | null>("get_instance_notes", { name, kind }),
  save_instance_notes: (name: string, kind: string, notes: string) =>
    handleInvoke<void>("save_instance_notes", { name, kind, notes }),

  // Version list
  get_version_list: () => handleInvoke<ListEntry[]>("get_version_list"),

  // Game launch
  launch_game: (instance: Instance, account: AccountData | null, username: string) =>
    handleInvoke<void>("launch_game", { instance, account, username }),
  kill_game: (name: string, kind: string) =>
    handleInvoke<void>("kill_game", { name, kind }),

  // Launcher config
  get_config: () => handleInvoke<LauncherConfig>("get_config"),
  save_config: (config: LauncherConfig) =>
    handleInvoke<void>("save_config", { config }),

  // Accounts
  login_microsoft: () => handleInvoke<{ user_code: string; verification_uri: string }>("login_microsoft"),
  poll_microsoft_login: (userCode: string) => handleInvoke<AccountData | null>("poll_microsoft_login", { userCode }),
  login_yggdrasil: (username: string, password: string, authType: string, authUrl?: string) =>
    handleInvoke<{ account: AccountData; is_needs_otp: boolean }>("login_yggdrasil", { username, password, authType, authUrl }),
  logout_account: (username: string, accountType: string) =>
    handleInvoke<void>("logout_account", { username, accountType }),
  refresh_account: (username: string, accountType: string) =>
    handleInvoke<AccountData>("refresh_account", { username, accountType }),

  // Mod Store
  search_mods: (
    query: string,
    version: string,
    loader: Loader,
    backend: StoreBackendType,
    queryType: QueryType,
    offset: number,
    categories: string[],
    categoriesUseAll: boolean,
    openSource: boolean,
    serverSide: boolean
  ) =>
    handleInvoke<SearchResult>("search_mods", {
      query,
      version,
      loader,
      backend,
      queryType,
      offset,
      categories,
      categoriesUseAll,
      openSource,
      serverSide,
    }),

  get_mod_description: (modId: ModId) =>
    handleInvoke<{ description: string; mod: SearchMod }>("get_mod_description", { modId }),

  download_mod: (instance: Instance, modId: ModId) =>
    handleInvoke<void>("download_mod", { instance, modId }),

  get_local_mods: (instance: Instance) =>
    handleInvoke<LocalMod[]>("get_local_mods", { instanceName: instance.name, kind: instance.kind }),

  toggle_mod: (instance: Instance, modIds: string[]) =>
    handleInvoke<void>("toggle_mod", { instanceName: instance.name, kind: instance.kind, ids: modIds }),

  delete_mod: (instance: Instance, modName: string, queryType: QueryType) =>
    handleInvoke<void>("delete_mod", { instance, modName, queryType }),

  get_categories: (backend: StoreBackendType, queryType: QueryType) =>
    handleInvoke<Category[]>("get_categories", { backend, queryType }),

  // Loader
  get_loader_versions: (loader: string, version: string) =>
    handleInvoke<string[]>("get_loader_versions", { loader, version }),
  install_loader: (instance: Instance, loader: string, loaderVersion: string) =>
    handleInvoke<void>("install_loader", { instance, loader, loaderVersion }),
  uninstall_loader: (instance: Instance) =>
    handleInvoke<void>("uninstall_loader", { instance }),

  // Logs
  upload_log: (log: string) => handleInvoke<string>("upload_log", { log }),

  // Shortcuts
  create_shortcut: (config: ShortcutConfig) =>
    handleInvoke<void>("create_shortcut", { config }),

  // Export/Import
  export_instance: (name: string, kind: string, path: string, exceptions: string[]) =>
    handleInvoke<void>("export_instance", { name, kind, path, exceptions }),
  import_instance: (path: string) =>
    handleInvoke<string>("import_instance", { path }),

  // Java
  get_java_versions: () => handleInvoke<number[]>("get_java_versions"),
  clear_java_installs: () => handleInvoke<void>("clear_java_installs"),

  // Maintenance
  clear_cache: () => handleInvoke<void>("clear_cache"),
  clean_assets: () => handleInvoke<void>("clean_assets"),

  // Sidebar
  get_sidebar_config: () =>
    handleInvoke<{ list: import("@/types").SidebarNode[] }>("get_sidebar_config"),
  save_sidebar_config: (config: { list: import("@/types").SidebarNode[] }) =>
    handleInvoke<void>("save_sidebar_config", { config }),

  // Changelog
  get_changelog: () => handleInvoke<string>("get_changelog"),

  // Server
  send_server_command: (name: string, command: string) =>
    handleInvoke<boolean>("send_server_command", { name, command }),

  // Launcher info
  get_launcher_version: () => handleInvoke<string>("get_launcher_version"),
};