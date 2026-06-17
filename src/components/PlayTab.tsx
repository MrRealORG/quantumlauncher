import { useState, useEffect, useCallback } from "react";
import {
  Play,
  Settings,
  Plus,
  Loader2,
  Package,
  ChevronDown,
  ChevronUp,
  Puzzle,
  FolderOpen,
  Square,
  Download,
  Link2,
  MoreVertical,
  LogOut,
  RefreshCw,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import { tauriCommands } from "@/utils/tauri";
import type { ConfigAccount } from "@/types";

export default function PlayTab() {
  const {
    selectedInstance,
    instanceConfig,
    instanceNotes,
    config,
    accountsDropdown,
    selectedAccount,
    isLaunching,
    runningInstances,
    setSelectedAccount,
    launchGame,
    killGame,
    setScreen,
    updateConfig,
    saveNotes,
    addToast,
  } = useAppStore();

  const [notesExpanded, setNotesExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState("");
  const [showMoreMenu, setShowMoreMenu] = useState(false);

  const isGameRunning = selectedInstance
    ? runningInstances.has(selectedInstance.name)
    : false;

  useEffect(() => {
    setLocalNotes(instanceNotes || "");
  }, [instanceNotes]);

  // Close more menu on click outside
  useEffect(() => {
    if (!showMoreMenu) return;
    const handler = (e: MouseEvent) => {
      const target = e.target as HTMLElement;
      if (!target.closest("[data-more-menu]")) {
        setShowMoreMenu(false);
      }
    };
    window.addEventListener("mousedown", handler);
    return () => window.removeEventListener("mousedown", handler);
  }, [showMoreMenu]);

  const handleSaveNotes = useCallback(() => {
    saveNotes(localNotes);
  }, [localNotes, saveNotes]);

  const handleOpenFolder = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      const { appDataDir } = await import("@tauri-apps/api/path");
      // Get the launcher data directory and open the instance folder
      const dataDir = await appDataDir();
      const instancePath = `${dataDir}/${
        selectedInstance.kind === "Client" ? "clients" : "servers"
      }/${selectedInstance.name}`;
      await open(instancePath);
    } catch {
      // Shell plugin may not be available in all environments
    }
  }, [selectedInstance]);

  const isOffline = selectedAccount === "(Offline)";
  const accountConfig = isOffline
    ? null
    : (config?.accounts?.[selectedAccount] as ConfigAccount | undefined);

  const handleLogout = useCallback(async () => {
    if (isOffline || !accountConfig) return;
    try {
      const accountType = accountConfig.account_type || "Microsoft";
      await tauriCommands.logout_account(selectedAccount, accountType);
      // Remove from config
      const { accounts } = config || {};
      if (accounts) {
        const updated = { ...accounts };
        delete updated[selectedAccount];
        updateConfig({ accounts: updated, account_selected: "(Offline)" });
      }
      // Update store dropdown immediately
      const newDropdown = [
        "(Offline)",
        ...Object.keys(config?.accounts || {}).filter((k) => k !== selectedAccount).sort(),
        "+ Add Account",
      ];
      useAppStore.setState({
        accountsDropdown: newDropdown,
        selectedAccount: "(Offline)",
      });
      addToast(`Logged out ${selectedAccount}`, "info");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Logout failed", "error");
    }
  }, [selectedAccount, accountConfig, config, isOffline, updateConfig, addToast]);

  const handleRefresh = useCallback(async () => {
    if (isOffline || !accountConfig) return;
    try {
      const accountType = accountConfig.account_type || "Microsoft";
      await tauriCommands.refresh_account(selectedAccount, accountType);
      addToast(`Refreshed ${selectedAccount}`, "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Refresh failed", "error");
    }
  }, [selectedAccount, accountConfig, isOffline, addToast]);

  const accountOptions = accountsDropdown.map((a) => ({ value: a, label: a }));

  // No instance selected
  if (!selectedInstance) {
    return (
      <div className="flex-1 flex items-center justify-center p-8">
        <div className="text-center">
          <Package className="w-12 h-12 text-theme-text-muted/30 mx-auto mb-3" />
          <p className="text-sm text-theme-text-muted">Select an instance to play</p>
          <Button
            variant="secondary"
            className="mt-4"
            onClick={() => setScreen({ type: "create_instance" })}
            icon={<Plus className="w-4 h-4" />}
          >
            Create Instance
          </Button>
        </div>
      </div>
    );
  }

  const loaderInfo = instanceConfig?.mod_type_info;
  const loaderName = instanceConfig?.mod_type || "Vanilla";
  const loaderVersion = loaderInfo?.version || "";
  const isServer = selectedInstance.kind === "Server";

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Instance Name + Running Indicator */}
        <div>
          <div className="flex items-center gap-2">
            <h1
              className="text-lg font-semibold text-theme-text truncate font-mono"
              title={selectedInstance.name}
            >
              {selectedInstance.name}
            </h1>
            {isGameRunning && (
              <span className="flex items-center gap-1 text-xs text-theme-accent">
                <Play className="w-3 h-3" />
                Running...
              </span>
            )}
          </div>
          <div className="flex items-center gap-2 mt-1 text-xs text-theme-text-muted">
            <span className="px-1.5 py-0.5 bg-theme-second-dark/60 rounded text-[10px] uppercase font-medium">
              {selectedInstance.kind}
            </span>
            {loaderName !== "Vanilla" && (
              <span>
                {loaderName}
                {loaderVersion ? ` ${loaderVersion}` : ""}
              </span>
            )}
          </div>
        </div>

        {/* Account Selector */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1">
            Account
          </label>
          <div className="flex gap-1.5">
            <div className="flex-1">
              <Select
                options={accountOptions}
                value={selectedAccount}
                onChange={(v) => {
                  setSelectedAccount(v);
                  if (v === "+ Add Account") {
                    setScreen({ type: "login" });
                  }
                }}
              />
            </div>
            {!isOffline && (
              <>
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<RefreshCw className="w-3.5 h-3.5" />}
                  onClick={handleRefresh}
                  title="Refresh account"
                />
                <Button
                  variant="ghost"
                  size="sm"
                  icon={<LogOut className="w-3.5 h-3.5" />}
                  onClick={handleLogout}
                  title="Logout"
                />
              </>
            )}
          </div>
        </div>

        {/* Username Input */}
        {selectedAccount === "(Offline)" && (
          <div>
            <label className="block text-xs font-medium text-theme-text-muted mb-1">
              Username
            </label>
            <Input
              value={config?.username || ""}
              onChange={(e) => updateConfig({ username: e.target.value })}
              placeholder="Player"
            />
          </div>
        )}

        {/* Play/Kill and Settings Buttons */}
        <div className="flex gap-2 pt-1">
          {isGameRunning ? (
            <Button
              variant="danger"
              size="lg"
              className="flex-1"
              icon={<Square className="w-5 h-5" />}
              onClick={() => killGame(selectedInstance.name)}
            >
              {isServer ? "Stop" : "Kill"}
            </Button>
          ) : (
            <Button
              variant="primary"
              size="lg"
              className="flex-1"
              icon={<Play className="w-5 h-5" />}
              loading={isLaunching}
              onClick={launchGame}
            >
              {isServer ? "Start" : "Play"}
            </Button>
          )}
          <Button
            variant="secondary"
            size="lg"
            icon={<Settings className="w-5 h-5" />}
            onClick={() => setScreen({ type: "settings" })}
            title="Settings"
          />
        </div>

        {/* Action Buttons Row */}
        <div className="flex gap-2">
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            icon={<Puzzle className="w-4 h-4" />}
            onClick={() => setScreen({ type: "mods" })}
          >
            Mods
          </Button>
          <Button
            variant="ghost"
            size="sm"
            className="flex-1"
            icon={<FolderOpen className="w-4 h-4" />}
            onClick={handleOpenFolder}
          >
            Files
          </Button>
          <div className="relative" data-more-menu>
            <Button
              variant="ghost"
              size="sm"
              icon={<MoreVertical className="w-4 h-4" />}
              onClick={() => setShowMoreMenu(!showMoreMenu)}
            />
            {showMoreMenu && (
              <div className="absolute left-0 top-full mt-1 w-44 bg-theme-surface border border-theme-second-dark rounded-lg shadow-xl z-50 py-1">
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-theme-text hover:bg-theme-second-dark/60 transition-colors flex items-center gap-2"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setScreen({ type: "loader" });
                  }}
                >
                  <Loader2 className="w-3.5 h-3.5" />
                  Install Loader
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-theme-text hover:bg-theme-second-dark/60 transition-colors flex items-center gap-2"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setScreen({ type: "shortcut" });
                  }}
                >
                  <Link2 className="w-3.5 h-3.5" />
                  Create Shortcut
                </button>
                <button
                  className="w-full text-left px-3 py-1.5 text-xs text-theme-text hover:bg-theme-second-dark/60 transition-colors flex items-center gap-2"
                  onClick={() => {
                    setShowMoreMenu(false);
                    setScreen({ type: "export_instance" });
                  }}
                >
                  <Download className="w-3.5 h-3.5" />
                  Export Instance
                </button>
              </div>
            )}
          </div>
        </div>

        {/* Create Instance */}
        <Button
          variant="ghost"
          size="sm"
          className="w-full"
          icon={<Plus className="w-4 h-4" />}
          onClick={() => setScreen({ type: "create_instance" })}
        >
          Create Instance
        </Button>

        {/* Instance Notes */}
        <div className="border-t border-theme-second-dark pt-3">
          <button
            className="flex items-center gap-1.5 text-xs font-medium text-theme-text-muted hover:text-theme-text transition-colors"
            onClick={() => setNotesExpanded(!notesExpanded)}
          >
            {notesExpanded ? (
              <ChevronUp className="w-3.5 h-3.5" />
            ) : (
              <ChevronDown className="w-3.5 h-3.5" />
            )}
            Instance Notes
          </button>
          {notesExpanded && (
            <div className="mt-2">
              <textarea
                value={localNotes}
                onChange={(e) => setLocalNotes(e.target.value)}
                onBlur={handleSaveNotes}
                placeholder="Add notes for this instance..."
                className="w-full h-28 bg-theme-dark border border-theme-second-dark text-theme-text rounded-lg px-3 py-2 text-sm resize-none font-mono placeholder:text-theme-text-muted/40 focus:border-theme-mid outline-none transition-colors"
              />
            </div>
          )}
        </div>
      </div>
    </div>
  );
}