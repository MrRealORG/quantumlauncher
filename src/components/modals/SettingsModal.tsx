import { useState, useEffect, useCallback } from "react";
import { RotateCcw } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import { useThemeStore } from "@/stores/themeStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import TabBar from "@/components/common/TabBar";
import { tauriCommands } from "@/utils/tauri";
import type { ThemeColor, ThemeLightness, AfterLaunchBehavior, PresenceStatusDisplayType, LauncherConfig } from "@/types";

const THEME_COLORS: ThemeColor[] = ["Purple", "Brown", "Sky Blue", "Catppuccin", "Teal", "Halloween", "Adwaita"];

const THEME_LIGHTNESS: { value: ThemeLightness; label: string }[] = [
  { value: "Dark", label: "Dark" },
  { value: "Light", label: "Light" },
  { value: "Auto", label: "Auto" },
];

const AFTER_LAUNCH: { value: AfterLaunchBehavior; label: string }[] = [
  { value: "do_nothing", label: "Do nothing" },
  { value: "minimize_launcher", label: "Minimize launcher" },
  { value: "close_launcher", label: "Close launcher" },
];

const STATUS_DISPLAY: { value: PresenceStatusDisplayType; label: string }[] = [
  { value: "Name", label: "App Name" },
  { value: "Details", label: "Top Text" },
  { value: "State", label: "Bottom Text" },
];

const settingsTabs = [
  { id: "appearance", label: "Appearance" },
  { id: "game", label: "Game" },
  { id: "launcher", label: "Launcher" },
  { id: "discord", label: "Discord RPC" },
  { id: "about", label: "About" },
];

/** Reusable toggle component matching the iced UI style. */
function Toggle({
  checked,
  onChange,
}: {
  checked: boolean;
  onChange: () => void;
}) {
  return (
    <button
      onClick={onChange}
      className={`w-9 h-5 rounded-full transition-colors duration-200 relative cursor-pointer ${
        checked ? "bg-theme-mid" : "bg-theme-second-dark"
      }`}
    >
      <div
        className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all duration-200 ${
          checked ? "left-[18px]" : "left-0.5"
        }`}
      />
    </button>
  );
}

/** Helper to create a settings section with label + description. */
function SettingRow({
  label,
  description,
  children,
}: {
  label: string;
  description?: string;
  children: React.ReactNode;
}) {
  return (
    <div className="flex items-center justify-between py-2">
      <div className="flex-1 mr-3">
        <label className="text-xs font-medium text-theme-text-muted block">{label}</label>
        {description && (
          <p className="text-[10px] text-theme-text-muted/70 mt-0.5">{description}</p>
        )}
      </div>
      {children}
    </div>
  );
}

export default function SettingsModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const config = useAppStore((s) => s.config);
  const storeUpdateConfig = useAppStore((s) => s.updateConfig);
  const addToast = useAppStore((s) => s.addToast);
  const themeColor = useThemeStore((s) => s.themeColor);
  const lightnessMode = useThemeStore((s) => s.lightnessMode);
  const setThemeColor = useThemeStore((s) => s.setThemeColor);
  const setLightnessMode = useThemeStore((s) => s.setLightnessMode);
  const setUiScale = useThemeStore((s) => s.setUiScale);

  const [activeTab, setActiveTab] = useState("appearance");

  const open = screen.type === "settings";
  const handleClose = useCallback(() => setScreen({ type: "main" }), [setScreen]);

  /** Wrapper for uc that allows partial nested objects.
   *  The runtime deep merge handles missing fields correctly. */
  const uc = useCallback(
    (partial: Record<string, unknown>) => storeUpdateConfig(partial as Partial<LauncherConfig>),
    [storeUpdateConfig]
  );

  const handleThemeColor = useCallback(
    (color: string) => {
      const tc = color as ThemeColor;
      setThemeColor(tc);
      uc({ ui_theme: tc });
    },
    [setThemeColor, uc]
  );

  const handleLightness = useCallback(
    (mode: string) => {
      const m = mode as ThemeLightness;
      setLightnessMode(m);
      uc({ ui_mode: m });
    },
    [setLightnessMode, uc]
  );

  const handleScale = useCallback(
    (val: string) => {
      const scale = parseFloat(val);
      if (!isNaN(scale) && scale >= 0.5 && scale <= 2.0) {
        setUiScale(scale);
        uc({ ui_scale: scale });
      }
    },
    [setUiScale, uc]
  );

  const renderAppearance = () => (
    <div className="space-y-5">
      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-2">Theme Color</label>
        <div className="flex flex-wrap gap-2">
          {THEME_COLORS.map((color) => (
            <button
              key={color}
              onClick={() => handleThemeColor(color)}
              className={`
                px-3 py-1.5 text-xs rounded-lg border transition-all
                ${
                  themeColor === color
                    ? "border-theme-mid bg-theme-mid/20 text-theme-accent font-medium"
                    : "border-theme-second-dark text-theme-text-muted hover:border-theme-mid hover:text-theme-text"
                }
              `}
            >
              {color}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-2">Theme Mode</label>
        <Select
          options={THEME_LIGHTNESS.map((l) => ({ value: l.value, label: l.label }))}
          value={lightnessMode}
          onChange={handleLightness}
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
          UI Scale: {config?.ui_scale?.toFixed(2) || "1.00"}
        </label>
        <input
          type="range"
          min={0.5}
          max={2.0}
          step={0.05}
          value={config?.ui_scale || 1.0}
          onChange={(e) => handleScale(e.target.value)}
          className="w-full h-1.5 bg-theme-second-dark rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:bg-theme-mid [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
          Window Opacity: {config?.ui?.window_opacity?.toFixed(2) || "0.90"}
        </label>
        <input
          type="range"
          min={0.3}
          max={1.0}
          step={0.05}
          value={config?.ui?.window_opacity || 0.9}
          onChange={(e) =>
            uc({
              ui: { window_opacity: parseFloat(e.target.value) },
            })
          }
          className="w-full h-1.5 bg-theme-second-dark rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:bg-theme-mid [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <p className="text-[10px] text-theme-text-muted mt-1">
          Requires window decorations to be enabled.
        </p>
      </div>

      <SettingRow
        label="UI Antialiasing"
        description="Smoothes text and UI elements (requires restart)"
      >
        <Toggle
          checked={config?.ui_antialiasing !== false}
          onChange={() => uc({ ui_antialiasing: !config?.ui_antialiasing })}
        />
      </SettingRow>

      <SettingRow
        label="Remember Window Size"
        description="Save and restore the launcher window size on startup"
      >
        <Toggle
          checked={config?.window?.save_window_size !== false}
          onChange={() =>
            uc({
              window: { save_window_size: !(config?.window?.save_window_size !== false) },
            })
          }
        />
      </SettingRow>

      <SettingRow
        label="Remember Last Selected Instance"
        description="Auto-select the last used instance on startup"
      >
        <Toggle
          checked={config?.persistent?.selected_remembered !== false}
          onChange={() =>
            uc({
              persistent: { selected_remembered: !(config?.persistent?.selected_remembered !== false) },
            })
          }
        />
      </SettingRow>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-2">After Game Opens</label>
        <Select
          options={AFTER_LAUNCH.map((a) => ({ value: a.value, label: a.label }))}
          value={config?.ui?.after_game_opens || "do_nothing"}
          onChange={(v) =>
            uc({
              ui: { after_game_opens: v as AfterLaunchBehavior },
            })
          }
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
          UI Idle FPS: {config?.ui?.idle_fps || 2}
        </label>
        <input
          type="range"
          min={2}
          max={20}
          step={1}
          value={config?.ui?.idle_fps || 2}
          onChange={(e) =>
            uc({
              ui: { idle_fps: parseInt(e.target.value) },
            })
          }
          className="w-full h-1.5 bg-theme-second-dark rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:bg-theme-mid [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
        />
        <p className="text-[10px] text-theme-text-muted mt-1">
          Lower values save CPU when the launcher is idle.
        </p>
      </div>
    </div>
  );

  const renderGame = () => (
    <div className="space-y-5">
      <div className="grid grid-cols-2 gap-3">
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Default Window Width</label>
          <Input
            type="number"
            value={config?.global_settings?.window_width?.toString() || ""}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              uc({
                global_settings: { window_width: isNaN(val) ? null : val },
              });
            }}
            placeholder="Auto"
          />
        </div>
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Default Window Height</label>
          <Input
            type="number"
            value={config?.global_settings?.window_height?.toString() || ""}
            onChange={(e) => {
              const val = parseInt(e.target.value);
              uc({
                global_settings: { window_height: isNaN(val) ? null : val },
              });
            }}
            placeholder="Auto"
          />
        </div>
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Global Java Arguments</label>
        <Input
          value={config?.extra_java_args?.join(" ") || ""}
          onChange={(e) =>
            uc({
              extra_java_args: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : null,
            })
          }
          placeholder="-XX:+UseG1GC"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Global Pre-launch Commands</label>
        <Input
          value={config?.global_settings?.pre_launch_prefix?.join(" ") || ""}
          onChange={(e) =>
            uc({
              global_settings: {
                pre_launch_prefix: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : null,
              },
            })
          }
          placeholder="prime-run"
        />
        <p className="text-[10px] text-theme-text-muted mt-1">
          Commands prepended to the launch command (e.g., for GPU selection via prime-run).
        </p>
      </div>

      <SettingRow
        label="Write Mod Update Changelog"
        description="Write a changelog.txt when mods are updated"
      >
        <Toggle
          checked={config?.persistent?.write_mod_update_changelog !== false}
          onChange={() =>
            uc({
              persistent: { write_mod_update_changelog: !(config?.persistent?.write_mod_update_changelog !== false) },
            })
          }
        />
      </SettingRow>
    </div>
  );

  const renderLauncher = () => (
    <div className="space-y-5">
      <SettingRow
        label="Cache Downloaded Files"
        description="Save downloaded files to disk (requires restart)"
      >
        <Toggle
          checked={config?.do_cache !== false}
          onChange={() => uc({ do_cache: !config?.do_cache })}
        />
      </SettingRow>

      <Button
        variant="secondary"
        size="sm"
        className="w-full justify-start"
        onClick={async () => {
          try {
            const { open } = await import("@tauri-apps/plugin-shell");
            const { appDataDir } = await import("@tauri-apps/api/path");
            const dataDir = await appDataDir();
            await open(`${dataDir}QuantumLauncher`);
          } catch {
            addToast("Failed to open launcher folder", "error");
          }
        }}
      >
        Open Launcher Folder
      </Button>

      <div className="space-y-2">
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          onClick={async () => {
            try {
              await tauriCommands.clear_java_installs();
              addToast("Java installs cleared", "success");
            } catch {
              addToast("Failed to clear Java installs", "error");
            }
          }}
        >
          Clear Java Installs
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          onClick={async () => {
            try {
              await tauriCommands.clear_cache();
              addToast("Cache cleared", "success");
            } catch {
              addToast("Failed to clear cache", "error");
            }
          }}
        >
          Clear Download Cache
        </Button>
        <Button
          variant="secondary"
          size="sm"
          className="w-full justify-start"
          onClick={async () => {
            try {
              await tauriCommands.clean_assets();
              addToast("Assets cleaned", "success");
            } catch {
              addToast("Failed to clean assets", "error");
            }
          }}
        >
          Clean Unused Assets
        </Button>
      </div>
    </div>
  );

  const renderDiscord = () => {
    const rpc = config?.discord_rpc;
    const handleResetRpc = () => {
      uc({ discord_rpc: { enable: false, name: null, status_display_type: "Name", update_on_game_open: true, competing: false, basic: { top_text: null, top_text_url: null, bottom_text: null, bottom_text_url: null }, on_gameopen: { top_text: null, top_text_url: null, bottom_text: null, bottom_text_url: null }, on_gameexit: { top_text: null, top_text_url: null, bottom_text: null, bottom_text_url: null } } });
      addToast("Discord RPC reset to defaults", "info");
    };

    return (
    <div className="space-y-5">
      <div className="flex items-center justify-between">
        <div />
        <Button
          variant="ghost"
          size="sm"
          icon={<RotateCcw className="w-3.5 h-3.5" />}
          onClick={handleResetRpc}
        >
          Reset to Defaults
        </Button>
      </div>

      <SettingRow
        label="Enable Discord Rich Presence"
        description="Show current activity in Discord status"
      >
        <Toggle
          checked={rpc?.enable === true}
          onChange={() =>
            uc({ discord_rpc: { enable: !rpc?.enable } })
          }
        />
      </SettingRow>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Custom Activity Name</label>
        <Input
          value={rpc?.name || ""}
          onChange={(e) =>
            uc({ discord_rpc: { name: e.target.value || null } })
          }
          placeholder="QuantumLauncher"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Status Display Type</label>
        <Select
          options={STATUS_DISPLAY.map((s) => ({ value: s.value, label: s.label }))}
          value={rpc?.status_display_type || "Name"}
          onChange={(v) =>
            uc({ discord_rpc: { status_display_type: v as PresenceStatusDisplayType } })
          }
        />
      </div>

      <SettingRow
        label="Update on Game Open"
        description="Change presence when game launches or exits"
      >
        <Toggle
          checked={rpc?.update_on_game_open !== false}
          onChange={() =>
            uc({ discord_rpc: { update_on_game_open: !rpc?.update_on_game_open } })
          }
        />
      </SettingRow>

      <SettingRow
        label="Competing Mode"
        description="Show as 'competing' instead of 'playing' in Discord"
      >
        <Toggle
          checked={rpc?.competing === true}
          onChange={() =>
            uc({ discord_rpc: { competing: !rpc?.competing } })
          }
        />
      </SettingRow>

      {/* Basic presence */}
      <div className="border-t border-theme-second-dark pt-4">
        <h3 className="text-xs font-semibold text-theme-text mb-3">Basic Presence</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Top Text</label>
            <Input
              value={rpc?.basic?.top_text || ""}
              onChange={(e) =>
                uc({ discord_rpc: { basic: { top_text: e.target.value || null } } })
              }
              placeholder="Opened Launcher"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Top Text URL</label>
            <Input
              value={rpc?.basic?.top_text_url || ""}
              onChange={(e) =>
                uc({ discord_rpc: { basic: { top_text_url: e.target.value || null } } })
              }
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Bottom Text</label>
            <Input
              value={rpc?.basic?.bottom_text || ""}
              onChange={(e) =>
                uc({ discord_rpc: { basic: { bottom_text: e.target.value || null } } })
              }
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Bottom Text URL</label>
            <Input
              value={rpc?.basic?.bottom_text_url || ""}
              onChange={(e) =>
                uc({ discord_rpc: { basic: { bottom_text_url: e.target.value || null } } })
              }
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* On Game Open event */}
      <div className="border-t border-theme-second-dark pt-4">
        <h3 className="text-xs font-semibold text-theme-text mb-1">On Game Open</h3>
        <p className="text-[10px] text-theme-text-muted/70 mb-3">Use {'{'}instance{'}'} and {'{'}version{'}'} as placeholders</p>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Top Text</label>
            <Input
              value={rpc?.on_gameopen?.top_text || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameopen: { top_text: e.target.value || null } } })
              }
              placeholder="Playing {'{'}instance{'}'}"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Top Text URL</label>
            <Input
              value={rpc?.on_gameopen?.top_text_url || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameopen: { top_text_url: e.target.value || null } } })
              }
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Bottom Text</label>
            <Input
              value={rpc?.on_gameopen?.bottom_text || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameopen: { bottom_text: e.target.value || null } } })
              }
              placeholder="{'{'}version{'}'}"
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Bottom Text URL</label>
            <Input
              value={rpc?.on_gameopen?.bottom_text_url || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameopen: { bottom_text_url: e.target.value || null } } })
              }
              placeholder="https://..."
            />
          </div>
        </div>
      </div>

      {/* On Game Exit event */}
      <div className="border-t border-theme-second-dark pt-4">
        <h3 className="text-xs font-semibold text-theme-text mb-3">On Game Exit</h3>
        <div className="space-y-3">
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Top Text</label>
            <Input
              value={rpc?.on_gameexit?.top_text || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameexit: { top_text: e.target.value || null } } })
              }
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Top Text URL</label>
            <Input
              value={rpc?.on_gameexit?.top_text_url || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameexit: { top_text_url: e.target.value || null } } })
              }
              placeholder="https://..."
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Bottom Text</label>
            <Input
              value={rpc?.on_gameexit?.bottom_text || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameexit: { bottom_text: e.target.value || null } } })
              }
              placeholder=""
            />
          </div>
          <div>
            <label className="block text-[11px] font-medium text-theme-text-muted mb-1">Bottom Text URL</label>
            <Input
              value={rpc?.on_gameexit?.bottom_text_url || ""}
              onChange={(e) =>
                uc({ discord_rpc: { on_gameexit: { bottom_text_url: e.target.value || null } } })
              }
              placeholder="https://..."
            />
          </div>
        </div>
      </div>
    </div>
  );
  };

  const renderAbout = () => (
    <div className="space-y-4 text-sm">
      <div className="text-center py-4">
        <h2 className="text-xl font-bold text-theme-text">PK Launcher</h2>
        <p className="text-theme-text-muted text-xs mt-1">
          Version {config?.version || "unknown"}
        </p>
      </div>
      <p className="text-theme-text-muted text-xs leading-relaxed">
        A Minecraft launcher with mod management, multi-instance support, and a beautiful themed
        interface. Migrated from QuantumLauncher by Mrmayman.
      </p>
      <div className="flex flex-col gap-1.5">
        <a
          href="https://github.com/MrRealORG/quantumlauncher"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-theme-mid hover:text-theme-accent transition-colors"
        >
          GitHub Repository (Fork)
        </a>
        <a
          href="https://github.com/mrmayman/quantumlauncher"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-theme-mid hover:text-theme-accent transition-colors"
        >
          Upstream: QuantumLauncher
        </a>
        <a
          href="https://mrmayman.github.io/quantumlauncher"
          target="_blank"
          rel="noreferrer"
          className="text-xs text-theme-mid hover:text-theme-accent transition-colors"
        >
          Documentation
        </a>
      </div>
      <p className="text-[10px] text-theme-text-muted">
        Licensed under the GNU General Public License v3.0
      </p>
    </div>
  );

  const renderContent = () => {
    switch (activeTab) {
      case "appearance":
        return renderAppearance();
      case "game":
        return renderGame();
      case "launcher":
        return renderLauncher();
      case "discord":
        return renderDiscord();
      case "about":
        return renderAbout();
      default:
        return null;
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Settings" wide>
      <div>
        <div className="border-b border-theme-second-dark px-4 pt-3">
          <TabBar
            tabs={settingsTabs}
            activeTab={activeTab}
            onTabChange={setActiveTab}
          />
        </div>
        <div className="p-4 max-h-[500px] overflow-y-auto">{renderContent()}</div>
      </div>
    </Modal>
  );
}