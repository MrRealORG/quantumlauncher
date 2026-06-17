import { create } from "zustand";
import { listen, type UnlistenFn } from "@tauri-apps/api/event";
import type {
  Screen,
  Instance,
  InstanceConfigJson,
  InstanceKind,
  LauncherConfig,
  AccountData,
  InstanceLog,
  SidebarNode,
  SidebarConfig,
  GenericProgress,
} from "@/types";
import { tauriCommands } from "@/utils/tauri";

const OFFLINE_ACCOUNT_NAME = "(Offline)";
const NEW_ACCOUNT_NAME = "+ Add Account";

interface AppState {
  // Navigation
  screen: Screen;
  setScreen: (screen: Screen) => void;

  // Instances
  clientInstances: string[];
  serverInstances: string[];
  selectedInstance: Instance | null;
  instanceConfig: InstanceConfigJson | null;
  instanceNotes: string | null;
  sidebarConfig: SidebarConfig | null;

  loadInstances: () => Promise<void>;
  selectInstance: (name: string, kind: InstanceKind) => Promise<void>;
  createInstance: (name: string, version: string, kind: string) => Promise<void>;
  deleteInstance: (name: string, kind: string) => Promise<void>;
  renameInstance: (oldName: string, newName: string, kind: string) => Promise<void>;

  // Config
  config: LauncherConfig | null;
  loadConfig: () => Promise<void>;
  saveConfig: () => Promise<void>;
  updateConfig: (partial: Partial<LauncherConfig>) => void;

  // Accounts
  accounts: Record<string, AccountData>;
  accountsDropdown: string[];
  selectedAccount: string;
  loadAccounts: () => Promise<void>;
  setSelectedAccount: (account: string) => void;

  // Game
  isLaunching: boolean;
  launchProgress: GenericProgress | null;
  launchGame: () => Promise<void>;
  killGame: (name: string, kind: string) => Promise<void>;

  // Logs
  logs: Record<string, InstanceLog>;
  getLog: (name: string, kind: string) => InstanceLog | undefined;

  // Progress
  setLaunchProgress: (progress: GenericProgress | null) => void;

  // Sidebar
  updateSidebar: () => Promise<void>;
  saveSidebar: (config: SidebarConfig) => Promise<void>;

  // Notes
  saveNotes: (notes: string) => Promise<void>;

  // Instance Config
  updateInstanceConfig: (partial: Partial<InstanceConfigJson>) => Promise<void>;

  // Init
  initialize: () => Promise<void>;

  // Toast
  toasts: Array<{ id: string; message: string; type: "success" | "error" | "warning" | "info" }>;
  addToast: (message: string, type: "success" | "error" | "warning" | "info") => void;
  removeToast: (id: string) => void;
}

let unlisteners: UnlistenFn[] = [];

export const useAppStore = create<AppState>((set, get) => ({
  screen: { type: "main" },
  setScreen: (screen) => set({ screen }),

  clientInstances: [],
  serverInstances: [],
  selectedInstance: null,
  instanceConfig: null,
  instanceNotes: null,
  sidebarConfig: null,

  config: null,

  accounts: {},
  accountsDropdown: [OFFLINE_ACCOUNT_NAME, NEW_ACCOUNT_NAME],
  selectedAccount: OFFLINE_ACCOUNT_NAME,

  isLaunching: false,
  launchProgress: null,

  logs: {},
  toasts: [],

  setLaunchProgress: (progress) => set({ launchProgress: progress }),

  getLog: (name, kind) => {
    const key = `${kind}/${name}`;
    return get().logs[key];
  },

  addToast: (message, type) => {
    const id = Math.random().toString(36).substring(2, 9);
    set((s) => ({ toasts: [...s.toasts, { id, message, type }] }));
    setTimeout(() => {
      get().removeToast(id);
    }, 4000);
  },

  removeToast: (id) => {
    set((s) => ({ toasts: s.toasts.filter((t) => t.id !== id) }));
  },

  loadInstances: async () => {
    try {
      const [clients, servers] = await Promise.all([
        tauriCommands.get_client_instances(),
        tauriCommands.get_server_instances(),
      ]);
      set({ clientInstances: clients, serverInstances: servers });
    } catch (err) {
      console.error("Failed to load instances:", err);
    }
  },

  selectInstance: async (name, kind) => {
    const instance: Instance = { name, kind };
    set({ selectedInstance: instance, instanceNotes: null });

    try {
      const config = await tauriCommands.get_instance_config(name, kind);
      set({ instanceConfig: config });

      try {
        const notes = await tauriCommands.get_instance_notes(name, kind);
        set({ instanceNotes: notes });
      } catch {
        set({ instanceNotes: null });
      }
    } catch (err) {
      console.error("Failed to load instance config:", err);
    }
  },

  createInstance: async (name, version, kind) => {
    await tauriCommands.create_instance(name, version, kind);
    await get().loadInstances();
    get().addToast(`Instance "${name}" created`, "success");
  },

  deleteInstance: async (name, kind) => {
    await tauriCommands.delete_instance(name, kind);
    const state = get();
    if (state.selectedInstance?.name === name && state.selectedInstance?.kind === kind) {
      set({ selectedInstance: null, instanceConfig: null, instanceNotes: null });
    }
    await get().loadInstances();
    get().addToast(`Instance "${name}" deleted`, "info");
  },

  renameInstance: async (oldName, newName, kind) => {
    await tauriCommands.rename_instance(oldName, newName, kind);
    const state = get();
    if (state.selectedInstance?.name === oldName && state.selectedInstance?.kind === kind) {
      set({ selectedInstance: { name: newName, kind }, instanceConfig: null });
      await get().selectInstance(newName, kind);
    }
    await get().loadInstances();
    get().addToast(`Instance renamed to "${newName}"`, "success");
  },

  loadConfig: async () => {
    try {
      const config = await tauriCommands.get_config();
      set({ config });

      // Load accounts from config
      const accounts: Record<string, AccountData> = {};
      const dropdown: string[] = [OFFLINE_ACCOUNT_NAME, NEW_ACCOUNT_NAME];
      if (config.accounts) {
        for (const [username, accountData] of Object.entries(config.accounts)) {
          // We store basic info; full data loaded via refresh
          dropdown.splice(dropdown.length - 1, 0, username);
        }
      }
      const selectedAccount = config.account_selected || OFFLINE_ACCOUNT_NAME;
      set({ accounts, accountsDropdown: dropdown, selectedAccount });
    } catch (err) {
      console.error("Failed to load config:", err);
    }
  },

  saveConfig: async () => {
    const { config } = get();
    if (!config) return;
    try {
      await tauriCommands.save_config(config);
    } catch (err) {
      console.error("Failed to save config:", err);
    }
  },

  updateConfig: (partial) => {
    const { config } = get();
    if (!config) return;
    const updated = { ...config, ...partial };
    set({ config: updated });
    // Debounced save
    setTimeout(() => {
      const current = get().config;
      if (current) {
        tauriCommands.save_config(current).catch(console.error);
      }
    }, 300);
  },

  loadAccounts: async () => {
    // Accounts are loaded as part of loadConfig
    await get().loadConfig();
  },

  setSelectedAccount: (account) => {
    set({ selectedAccount: account });
    const { config } = get();
    if (config) {
      get().updateConfig({ account_selected: account });
    }
  },

  launchGame: async () => {
    const { selectedInstance, selectedAccount, accounts, config } = get();
    if (!selectedInstance) return;

    set({ isLaunching: true, launchProgress: null });

    const account = selectedAccount !== OFFLINE_ACCOUNT_NAME ? accounts[selectedAccount] : null;
    const username = config?.username || "Player";

    try {
      await tauriCommands.launch_game(selectedInstance, account, username);
    } catch (err) {
      console.error("Failed to launch game:", err);
      get().addToast("Failed to launch game", "error");
    } finally {
      set({ isLaunching: false });
    }
  },

  killGame: async (name, kind) => {
    try {
      await tauriCommands.kill_game(name, kind);
      get().addToast("Game process terminated", "info");
    } catch (err) {
      console.error("Failed to kill game:", err);
    }
  },

  updateSidebar: async () => {
    try {
      const config = await tauriCommands.get_sidebar_config();
      set({ sidebarConfig: config });
    } catch (err) {
      console.error("Failed to load sidebar config:", err);
    }
  },

  saveSidebar: async (config) => {
    try {
      await tauriCommands.save_sidebar_config(config);
      set({ sidebarConfig: config });
    } catch (err) {
      console.error("Failed to save sidebar config:", err);
    }
  },

  saveNotes: async (notes) => {
    const { selectedInstance } = get();
    if (!selectedInstance) return;
    try {
      await tauriCommands.save_instance_notes(selectedInstance.name, selectedInstance.kind, notes);
      set({ instanceNotes: notes });
    } catch (err) {
      console.error("Failed to save notes:", err);
    }
  },

  updateInstanceConfig: async (partial) => {
    const { selectedInstance, instanceConfig } = get();
    if (!selectedInstance || !instanceConfig) return;
    const updated = { ...instanceConfig, ...partial };
    set({ instanceConfig: updated });
    try {
      await tauriCommands.save_instance_config(selectedInstance.name, selectedInstance.kind, updated);
    } catch (err) {
      console.error("Failed to save instance config:", err);
    }
  },

  initialize: async () => {
    // Clean up previous listeners
    for (const unlisten of unlisteners) {
      unlisten();
    }
    unlisteners = [];

    // Load config
    await get().loadConfig();

    // Load instances
    await get().loadInstances();

    // Load sidebar
    await get().updateSidebar();

    // Listen for progress events
    try {
      const unlistenProgress = await listen<GenericProgress>("progress_event", (event) => {
        set({ launchProgress: event.payload });
      });
      unlisteners.push(unlistenProgress);
    } catch { /* event not available */ }

    // Listen for instance file system changes
    try {
      const unlistenFs = await listen("fs_change", () => {
        get().loadInstances();
        get().updateSidebar();
      });
      unlisteners.push(unlistenFs);
    } catch { /* event not available */ }

    // Listen for log events
    try {
      const unlistenLog = await listen<{ instance: string; kind: string; line: string }>("log_line", (event) => {
        const { instance, kind, line } = event.payload;
        const key = `${kind}/${instance}`;
        set((s) => {
          const existing = s.logs[key] || { lines: [], has_crashed: false, command: "" };
          return {
            logs: {
              ...s.logs,
              [key]: {
                ...existing,
                lines: [...existing.lines, line],
              },
            },
          };
        });
      });
      unlisteners.push(unlistenLog);
    } catch { /* event not available */ }

    // Listen for game exit
    try {
      const unlistenExit = await listen<{ instance: string; kind: string; crashed: boolean }>("game_exit", (event) => {
        const { instance, kind, crashed } = event.payload;
        const key = `${kind}/${instance}`;
        set((s) => ({
          isLaunching: false,
          launchProgress: null,
          logs: {
            ...s.logs,
            [key]: {
              ...s.logs[key],
              has_crashed: crashed,
            },
          },
        }));
        if (crashed) {
          get().addToast(`Game crashed`, "error");
        }
      });
      unlisteners.push(unlistenExit);
    } catch { /* event not available */ }
  },
}));