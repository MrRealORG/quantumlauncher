import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { useThemeStore } from "@/stores/themeStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import TabBar from "@/components/common/TabBar";
import { tauriCommands } from "@/utils/tauri";
import type { ThemeColor, ThemeLightness, AfterLaunchBehavior, PresenceStatusDisplayType } from "@/types";

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

export default function SettingsModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const config = useAppStore((s) => s.config);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const addToast = useAppStore((s) => s.addToast);
  const themeColor = useThemeStore((s) => s.themeColor);
  const lightnessMode = useThemeStore((s) => s.lightnessMode);
  const setThemeColor = useThemeStore((s) => s.setThemeColor);
  const setLightnessMode = useThemeStore((s) => s.setLightnessMode);
  const setUiScale = useThemeStore((s) => s.setUiScale);

  const [activeTab, setActiveTab] = useState("appearance");

  const open = screen.type === "settings";
  const handleClose = useCallback(() => setScreen({ type: "main" }), [setScreen]);

  const handleThemeColor = useCallback(
    (color: string) => {
      const tc = color as ThemeColor;
      setThemeColor(tc);
      updateConfig({ ui_theme: tc });
    },
    [setThemeColor, updateConfig]
  );

  const handleLightness = useCallback(
    (mode: string) => {
      const m = mode as ThemeLightness;
      setLightnessMode(m);
      updateConfig({ ui_mode: m });
    },
    [setLightnessMode, updateConfig]
  );

  const handleScale = useCallback(
    (val: string) => {
      const scale = parseFloat(val);
      if (!isNaN(scale) && scale >= 0.5 && scale <= 2.0) {
        setUiScale(scale);
        updateConfig({ ui_scale: scale });
      }
    },
    [setUiScale, updateConfig]
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
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">UI Scale: {config?.ui_scale?.toFixed(2) || "1.00"}</label>
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
            updateConfig({
              ui: { ...(config?.ui || { window_decorations: "system" as const, window_opacity: 0.9, after_game_opens: "do_nothing" as const }), window_opacity: parseFloat(e.target.value) },
            })
          }
          className="w-full h-1.5 bg-theme-second-dark rounded-full appearance-none cursor-pointer
            [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
            [&::-webkit-slider-thumb]:bg-theme-mid [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <label className="text-xs font-medium text-theme-text-muted">Antialiasing</label>
        <button
          onClick={() => updateConfig({ ui_antialiasing: !config?.ui_antialiasing })}
          className={`w-9 h-5 rounded-full transition-colors relative ${config?.ui_antialiasing !== false ? "bg-theme-mid" : "bg-theme-second-dark"}`}
        >
          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${config?.ui_antialiasing !== false ? "translate-x-4.5 left-0" : "left-0.5"}`} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-2">After Game Opens</label>
        <Select
          options={AFTER_LAUNCH.map((a) => ({ value: a.value, label: a.label }))}
          value={config?.ui?.after_game_opens || "do_nothing"}
          onChange={(v) =>
            updateConfig({
              ui: { ...(config?.ui || { window_decorations: "system" as const, window_opacity: 0.9, after_game_opens: "do_nothing" as const }), after_game_opens: v as AfterLaunchBehavior },
            })
          }
        />
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
              updateConfig({
                global_settings: { ...(config?.global_settings || {}), window_width: isNaN(val) ? null : val },
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
              updateConfig({
                global_settings: { ...(config?.global_settings || {}), window_height: isNaN(val) ? null : val },
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
            updateConfig({
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
            updateConfig({
              global_settings: { ...(config?.global_settings || {}), pre_launch_prefix: e.target.value.trim() ? e.target.value.trim().split(/\s+/) : null },
            })
          }
          placeholder="prime-run"
        />
      </div>
    </div>
  );

  const renderLauncher = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between py-2">
        <label className="text-xs font-medium text-theme-text-muted">Enable Caching</label>
        <button
          onClick={() => updateConfig({ do_cache: !config?.do_cache })}
          className={`w-9 h-5 rounded-full transition-colors relative ${config?.do_cache !== false ? "bg-theme-mid" : "bg-theme-second-dark"}`}
        >
          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${config?.do_cache !== false ? "translate-x-4.5 left-0" : "left-0.5"}`} />
        </button>
      </div>

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
          Clear Cache
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
          Clean Assets
        </Button>
      </div>
    </div>
  );

  const renderDiscord = () => (
    <div className="space-y-5">
      <div className="flex items-center justify-between py-2">
        <label className="text-xs font-medium text-theme-text-muted">Enable Discord Rich Presence</label>
        <button
          onClick={() =>
            updateConfig({
              discord_rpc: { ...(config?.discord_rpc || { enable: false, basic: {}, on_gameopen: {}, on_gameexit: {}, status_display_type: "Name" as const, update_on_game_open: true, competing: false }), enable: !config?.discord_rpc?.enable },
            })
          }
          className={`w-9 h-5 rounded-full transition-colors relative ${config?.discord_rpc?.enable ? "bg-theme-mid" : "bg-theme-second-dark"}`}
        >
          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${config?.discord_rpc?.enable ? "translate-x-4.5 left-0" : "left-0.5"}`} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Status Display Type</label>
        <Select
          options={STATUS_DISPLAY.map((s) => ({ value: s.value, label: s.label }))}
          value={config?.discord_rpc?.status_display_type || "Name"}
          onChange={(v) =>
            updateConfig({
              discord_rpc: { ...(config?.discord_rpc || { enable: false, basic: {}, on_gameopen: {}, on_gameexit: {}, status_display_type: "Name" as const, update_on_game_open: true, competing: false }), status_display_type: v as PresenceStatusDisplayType },
            })
          }
        />
      </div>

      <div className="flex items-center justify-between py-2">
        <label className="text-xs font-medium text-theme-text-muted">Update on Game Open</label>
        <button
          onClick={() =>
            updateConfig({
              discord_rpc: { ...(config?.discord_rpc || { enable: false, basic: {}, on_gameopen: {}, on_gameexit: {}, status_display_type: "Name" as const, update_on_game_open: true, competing: false }), update_on_game_open: !config?.discord_rpc?.update_on_game_open },
            })
          }
          className={`w-9 h-5 rounded-full transition-colors relative ${config?.discord_rpc?.update_on_game_open !== false ? "bg-theme-mid" : "bg-theme-second-dark"}`}
        >
          <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${config?.discord_rpc?.update_on_game_open !== false ? "translate-x-4.5 left-0" : "left-0.5"}`} />
        </button>
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Basic Top Text</label>
        <Input
          value={config?.discord_rpc?.basic?.top_text || ""}
          onChange={(e) =>
            updateConfig({
              discord_rpc: {
                ...(config?.discord_rpc || { enable: false, basic: {}, on_gameopen: {}, on_gameexit: {}, status_display_type: "Name" as const, update_on_game_open: true, competing: false }),
                basic: { ...(config?.discord_rpc?.basic || {}), top_text: e.target.value || null },
              },
            })
          }
          placeholder="Opened Launcher"
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Basic Top Text URL</label>
        <Input
          value={config?.discord_rpc?.basic?.top_text_url || ""}
          onChange={(e) =>
            updateConfig({
              discord_rpc: {
                ...(config?.discord_rpc || { enable: false, basic: {}, on_gameopen: {}, on_gameexit: {}, status_display_type: "Name" as const, update_on_game_open: true, competing: false }),
                basic: { ...(config?.discord_rpc?.basic || {}), top_text_url: e.target.value || null },
              },
            })
          }
          placeholder="https://..."
        />
      </div>

      <div>
        <label className="block text-xs font-medium text-theme-text-muted mb-1.5">Basic Bottom Text</label>
        <Input
          value={config?.discord_rpc?.basic?.bottom_text || ""}
          onChange={(e) =>
            updateConfig({
              discord_rpc: {
                ...(config?.discord_rpc || { enable: false, basic: {}, on_gameopen: {}, on_gameexit: {}, status_display_type: "Name" as const, update_on_game_open: true, competing: false }),
                basic: { ...(config?.discord_rpc?.basic || {}), bottom_text: e.target.value || null },
              },
            })
          }
        />
      </div>
    </div>
  );

  const renderAbout = () => (
    <div className="space-y-4 text-sm">
      <div className="text-center py-4">
        <h2 className="text-xl font-bold text-theme-text">PK Launcher</h2>
        <p className="text-theme-text-muted text-xs mt-1">Version {config?.version || "unknown"}</p>
      </div>
      <p className="text-theme-text-muted text-xs leading-relaxed">
        A Minecraft launcher with mod management, multi-instance support, and a beautiful themed interface.
        Migrated from QuantumLauncher.
      </p>
      <div className="flex flex-col gap-1.5">
        <a href="https://github.com/mrmayman/quantumlauncher" target="_blank" rel="noreferrer" className="text-xs text-theme-mid hover:text-theme-accent transition-colors">
          GitHub Repository
        </a>
        <a href="https://mrmayman.github.io/quantumlauncher" target="_blank" rel="noreferrer" className="text-xs text-theme-mid hover:text-theme-accent transition-colors">
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
      case "appearance": return renderAppearance();
      case "game": return renderGame();
      case "launcher": return renderLauncher();
      case "discord": return renderDiscord();
      case "about": return renderAbout();
      default: return null;
    }
  };

  return (
    <Modal open={open} onClose={handleClose} title="Settings" wide>
      <div>
        <div className="border-b border-theme-second-dark px-4 pt-3">
          <TabBar tabs={settingsTabs} activeTab={activeTab} onTabChange={setActiveTab} />
        </div>
        <div className="p-4 max-h-[500px] overflow-y-auto">
          {renderContent()}
        </div>
      </div>
    </Modal>
  );
}