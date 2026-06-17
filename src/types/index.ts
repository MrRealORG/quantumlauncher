// ===== Instance Types =====

export type InstanceKind = "Client" | "Server";

export interface Instance {
  name: string;
  kind: InstanceKind;
}

export type ListEntryKind =
  | "Release"
  | "Snapshot"
  | "Preclassic"
  | "Classic"
  | "Indev"
  | "Infdev"
  | "Alpha"
  | "Beta"
  | "AprilFools"
  | "Special";

export interface ListEntry {
  name: string;
  supports_server: boolean;
  kind: ListEntryKind;
}

// ===== Loader Types =====

export type Loader =
  | "Fabric"
  | "Quilt"
  | "Forge"
  | "NeoForge"
  | "OptiFine"
  | "Paper"
  | "Liteloader"
  | "Modloader"
  | "Rift"
  | "Vanilla";

export type JavaVersion = 8 | 16 | 17 | 21 | 25;

// ===== Instance Config =====

export interface ModTypeInfo {
  version?: string | null;
  backend_implementation?: string | null;
  optifine_jar?: string | null;
  [key: string]: unknown;
}

export interface CustomJarConfig {
  name: string;
  autoset_main_class: boolean;
  [key: string]: unknown;
}

export type PreLaunchPrefixMode = "disable" | "combine_local_global" | "combine_global_local";

export interface WindowProperties {
  window_width?: number | null;
  window_height?: number | null;
  pre_launch_prefix?: string[] | null;
  [key: string]: unknown;
}

export interface VersionInfo {
  is_special_lwjgl3: boolean;
  [key: string]: unknown;
}

export interface InstanceConfigJson {
  ram_in_mb: number;
  mod_type: Loader;
  mod_type_info?: ModTypeInfo | null;
  java_override_version?: number | null;
  java_override?: string | null;
  enable_logger?: boolean | null;
  java_args?: string[] | null;
  game_args?: string[] | null;
  is_classic_server?: boolean | null;
  is_server?: boolean | null;
  global_settings?: WindowProperties | null;
  global_java_args_enable?: boolean | null;
  pre_launch_prefix_mode?: PreLaunchPrefixMode | null;
  custom_jar?: CustomJarConfig | null;
  version_info?: VersionInfo | null;
  main_class_override?: string | null;
  [key: string]: unknown;
}

// ===== Global Settings =====

export interface GlobalSettings {
  window_width?: number | null;
  window_height?: number | null;
  pre_launch_prefix?: string[] | null;
  [key: string]: unknown;
}

// ===== Launcher Config =====

export type ThemeColor = "Purple" | "Brown" | "Sky Blue" | "Catppuccin" | "Teal" | "Halloween" | "Adwaita";

export type ThemeLightness = "Dark" | "Light" | "Auto";

export type AfterLaunchBehavior = "close_launcher" | "minimize_launcher" | "do_nothing";

export type UiWindowDecorations = "left" | "right" | "system";

export type PresenceStatusDisplayType = "Name" | "Details" | "State";

export interface RpcText {
  top_text?: string | null;
  top_text_url?: string | null;
  bottom_text?: string | null;
  bottom_text_url?: string | null;
  [key: string]: unknown;
}

export interface RpcConfig {
  enable: boolean;
  name?: string | null;
  basic: RpcText;
  status_display_type: PresenceStatusDisplayType;
  update_on_game_open: boolean;
  on_gameopen: RpcText;
  on_gameexit: RpcText;
  competing: boolean;
  [key: string]: unknown;
}

export interface WindowConfig {
  save_window_size: boolean;
  width?: number | null;
  height?: number | null;
  [key: string]: unknown;
}

export interface UiSettings {
  window_decorations: UiWindowDecorations;
  window_opacity: number;
  idle_fps?: number | null;
  after_game_opens: AfterLaunchBehavior;
  [key: string]: unknown;
}

export interface PersistentSettings {
  selected_instance?: string | null;
  selected_instance_kind?: InstanceKind | null;
  selected_remembered: boolean;
  write_mod_update_changelog: boolean;
  create_instance_filters?: ListEntryKind[] | null;
  [key: string]: unknown;
}

export interface ConfigAccount {
  uuid: string;
  skin?: string | null;
  account_type?: AccountType | null;
  keyring_identifier?: string | null;
  username_nice?: string | null;
  [key: string]: unknown;
}

export interface LauncherConfig {
  username: string;
  ui_mode?: ThemeLightness | null;
  ui_theme?: ThemeColor | null;
  version?: string | null;
  do_cache: boolean;
  accounts?: Record<string, ConfigAccount> | null;
  account_selected?: string | null;
  ui_scale?: number | null;
  ui_antialiasing?: boolean | null;
  window?: WindowConfig | null;
  global_settings?: GlobalSettings | null;
  extra_java_args?: string[] | null;
  ui?: UiSettings | null;
  persistent?: PersistentSettings | null;
  sidebar?: SidebarConfig | null;
  discord_rpc?: RpcConfig | null;
  [key: string]: unknown;
}

// ===== Account Types =====

export type AccountType = "Microsoft" | "ElyBy" | "LittleSkin";

export interface AccountData {
  access_token?: string | null;
  uuid: string;
  refresh_token: string;
  needs_refresh: boolean;
  username: string;
  nice_username: string;
  account_type: AccountType;
}

// ===== Mod Store Types =====

export type StoreBackendType = "curseforge" | "modrinth";

export type QueryType = "Mods" | "Shaders" | "ModPacks" | "DataPacks" | "ResourcePacks";

export interface Category {
  name: string;
  slug: string;
  children: Category[];
  internal_id?: number | null;
  is_usable: boolean;
}

export interface GalleryItem {
  url: string;
  title?: string | null;
  description?: string | null;
}

export type UrlKind =
  | { type: "Issues"; url: string }
  | { type: "Source"; url: string }
  | { type: "Wiki"; url: string }
  | { type: "Website"; url: string }
  | { type: "Discord"; url: string }
  | { type: "Donation"; url: string; service: string };

export interface SearchMod {
  title: string;
  description: string;
  downloads: number;
  internal_name: string;
  project_type: string;
  id: string;
  icon_url?: string | null;
  backend: StoreBackendType;
  gallery: GalleryItem[];
  urls: UrlKind[];
}

export interface SearchResult {
  mods: SearchMod[];
  backend: StoreBackendType;
  offset: number;
  reached_end: boolean;
}

export type ModId =
  | { type: "modrinth"; id: string }
  | { type: "curseforge"; id: string };

export interface LocalMod {
  id: string;
  name: string;
  description: string;
  enabled: boolean;
  installed_version: string;
  project_type: QueryType;
  project_source: StoreBackendType;
  icon_url?: string | null;
}

export interface ModConfig {
  enabled: boolean;
  [key: string]: unknown;
}

// ===== Server Types =====

export interface ServerProperties {
  entries: Record<string, string>;
}

// ===== Shortcut Types =====

export interface ShortcutConfig {
  name: string;
  description: string;
  instance: string;
  account?: string | null;
  save_to_applications: boolean;
}

// ===== Progress Types =====

export type DownloadProgressStage =
  | { type: "DownloadingJsonManifest" }
  | { type: "DownloadingVersionJson" }
  | { type: "DownloadingAssets"; progress: number; out_of: number }
  | { type: "DownloadingLibraries"; progress: number; out_of: number }
  | { type: "DownloadingJar" };

export interface GenericProgress {
  done: number;
  total: number;
  message?: string | null;
  has_finished: boolean;
}

export type ProgressEvent =
  | { type: "download"; progress: DownloadProgressStage; num: number }
  | { type: "generic"; progress: GenericProgress; num: number }
  | { type: "java"; progress: GenericProgress; num: number };

// ===== Sidebar Types =====

export interface SidebarFolder {
  id: string;
  children: SidebarNode[];
  is_expanded: boolean;
  [key: string]: unknown;
}

export type SidebarNodeKind =
  | { type: "instance"; kind: InstanceKind }
  | { type: "folder"; folder: SidebarFolder };

export interface SidebarNode {
  name: string;
  kind: SidebarNodeKind;
}

export interface SidebarConfig {
  list: SidebarNode[];
  [key: string]: unknown;
}

// ===== Theme Types =====

export interface ThemePalette {
  extraDark: string;
  dark: string;
  secondDark: string;
  mid: string;
  secondLight: string;
  light: string;
  white: string;
  background: string;
  surface: string;
  text: string;
  textMuted: string;
  accent: string;
  success: string;
  error: string;
  warning: string;
}

export interface Theme {
  color: ThemeColor;
  lightness: ThemeLightness;
  palette: ThemePalette;
}

// ===== Game Process / Log =====

export interface GameProcess {
  pid: number;
  is_running: boolean;
}

export interface LogLine {
  text: string;
  level: "info" | "warn" | "error" | "debug";
  timestamp?: number;
}

export interface InstanceLog {
  lines: string[];
  has_crashed: boolean;
  command: string;
}

// ===== Screen / Navigation =====

export type Screen =
  | { type: "main" }
  | { type: "create_instance" }
  | { type: "settings" }
  | { type: "login" }
  | { type: "mods" }
  | { type: "loader" }
  | { type: "mod_description"; mod: import("@/utils/tauri").ModInfoSerializable }
  | { type: "export_instance" }
  | { type: "shortcut" }
  | { type: "onboarding"; step: number }
  | { type: "changelog"; content?: string }
  | { type: "error"; message: string };