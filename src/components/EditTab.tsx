import { useState, useEffect, useCallback, useRef } from "react";
import { Save, RotateCcw, Info } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import type { InstanceConfigJson, PreLaunchPrefixMode } from "@/types";

export default function EditTab() {
  const { selectedInstance, instanceConfig, updateInstanceConfig, addToast } = useAppStore();
  const [localConfig, setLocalConfig] = useState<InstanceConfigJson | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    if (instanceConfig) {
      setLocalConfig({ ...instanceConfig });
      setHasChanges(false);
    }
  }, [instanceConfig]);

  const updateLocal = useCallback(
    (partial: Partial<InstanceConfigJson>) => {
      setLocalConfig((prev) => {
        if (!prev) return prev;
        const updated = { ...prev, ...partial };
        setHasChanges(true);

        // Debounced save
        if (debounceRef.current) clearTimeout(debounceRef.current);
        debounceRef.current = setTimeout(() => {
          updateInstanceConfig(partial);
          setHasChanges(false);
        }, 500);

        return updated;
      });
    },
    [updateInstanceConfig]
  );

  const handleManualSave = useCallback(() => {
    if (localConfig && hasChanges) {
      updateInstanceConfig(localConfig);
      setHasChanges(false);
      addToast("Configuration saved", "success");
    }
  }, [localConfig, hasChanges, updateInstanceConfig, addToast]);

  if (!selectedInstance || !localConfig) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-theme-text-muted">Select an instance to edit</p>
      </div>
    );
  }

  const ramStr = localConfig.ram_in_mb.toString();

  const prefixModeOptions: { value: string; label: string }[] = [
    { value: "combine_global_local", label: "Global + instance" },
    { value: "combine_local_global", label: "Instance + global" },
    { value: "disable", label: "Disable" },
  ];

  const globalSettings = localConfig.global_settings;

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-lg mx-auto space-y-4">
        <div className="flex items-center justify-between mb-2">
          <h2 className="text-sm font-semibold text-theme-text">
            Instance Configuration
          </h2>
          <div className="flex gap-1.5">
            <Button
              variant="ghost"
              size="sm"
              icon={<RotateCcw className="w-3.5 h-3.5" />}
              onClick={() => {
                if (instanceConfig) {
                  setLocalConfig({ ...instanceConfig });
                  setHasChanges(false);
                }
              }}
            >
              Reset
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Save className="w-3.5 h-3.5" />}
              disabled={!hasChanges}
              onClick={handleManualSave}
            >
              Save
            </Button>
          </div>
        </div>

        {/* RAM Allocation */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Memory Allocation (RAM)
          </label>
          <div className="flex items-center gap-3">
            <input
              type="range"
              min={256}
              max={16384}
              step={256}
              value={localConfig.ram_in_mb}
              onChange={(e) => updateLocal({ ram_in_mb: parseInt(e.target.value) })}
              className="flex-1 h-1.5 bg-theme-second-dark rounded-full appearance-none cursor-pointer
                [&::-webkit-slider-thumb]:appearance-none [&::-webkit-slider-thumb]:w-3.5 [&::-webkit-slider-thumb]:h-3.5
                [&::-webkit-slider-thumb]:bg-theme-mid [&::-webkit-slider-thumb]:rounded-full [&::-webkit-slider-thumb]:cursor-pointer"
            />
            <div className="flex items-center gap-1">
              <Input
                type="number"
                value={ramStr}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  if (!isNaN(val) && val >= 256 && val <= 16384) {
                    updateLocal({ ram_in_mb: val });
                  }
                }}
                className="w-20 text-center"
              />
              <span className="text-xs text-theme-text-muted">MB</span>
            </div>
          </div>
        </div>

        {/* Java Override Version */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Java Version Override
          </label>
          <Select
            options={[
              { value: "", label: "Automatic" },
              { value: "8", label: "Java 8" },
              { value: "16", label: "Java 16" },
              { value: "17", label: "Java 17" },
              { value: "21", label: "Java 21" },
              { value: "25", label: "Java 25" },
            ]}
            value={localConfig.java_override_version?.toString() || ""}
            onChange={(v) =>
              updateLocal({
                java_override_version: v ? parseInt(v) : null,
              })
            }
          />
        </div>

        {/* Java Override Path */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Custom Java Path
          </label>
          <Input
            value={localConfig.java_override || ""}
            onChange={(e) =>
              updateLocal({
                java_override: e.target.value || null,
              })
            }
            placeholder="Leave empty for automatic"
          />
        </div>

        {/* Java Args */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Extra Java Arguments
          </label>
          <Input
            value={localConfig.java_args?.join(" ") || ""}
            onChange={(e) =>
              updateLocal({
                java_args: e.target.value.trim()
                  ? e.target.value.trim().split(/\s+/)
                  : null,
              })
            }
            placeholder="-XX:+UseG1GC -XX:+UnlockExperimentalVMOptions"
          />
        </div>

        {/* Game Args */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Extra Game Arguments
          </label>
          <Input
            value={localConfig.game_args?.join(" ") || ""}
            onChange={(e) =>
              updateLocal({
                game_args: e.target.value.trim()
                  ? e.target.value.trim().split(/\s+/)
                  : null,
              })
            }
            placeholder="--width 1280 --height 720"
          />
        </div>

        {/* Window Size */}
        {selectedInstance.kind === "Client" && (
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
                Window Width
              </label>
              <Input
                type="number"
                value={globalSettings?.window_width?.toString() || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateLocal({
                    global_settings: {
                      ...globalSettings,
                      window_width: isNaN(val) ? null : val,
                    },
                  });
                }}
                placeholder="Auto"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
                Window Height
              </label>
              <Input
                type="number"
                value={globalSettings?.window_height?.toString() || ""}
                onChange={(e) => {
                  const val = parseInt(e.target.value);
                  updateLocal({
                    global_settings: {
                      ...globalSettings,
                      window_height: isNaN(val) ? null : val,
                    },
                  });
                }}
                placeholder="Auto"
              />
            </div>
          </div>
        )}

        {/* Pre-launch Prefix Mode */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Pre-launch Prefix Mode
          </label>
          <Select
            options={prefixModeOptions}
            value={localConfig.pre_launch_prefix_mode || "combine_global_local"}
            onChange={(v) =>
              updateLocal({ pre_launch_prefix_mode: v as PreLaunchPrefixMode })
            }
          />
        </div>

        {/* Pre-launch Prefix */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Pre-launch Commands
          </label>
          <Input
            value={globalSettings?.pre_launch_prefix?.join(" ") || ""}
            onChange={(e) =>
              updateLocal({
                global_settings: {
                  ...globalSettings,
                  pre_launch_prefix: e.target.value.trim()
                    ? e.target.value.trim().split(/\s+/)
                    : null,
                },
              })
            }
            placeholder="prime-run"
          />
          <p className="text-[10px] text-theme-text-muted mt-1 flex items-center gap-1">
            <Info className="w-3 h-3" />
            Commands prepended to the launch command (e.g., for GPU selection)
          </p>
        </div>

        {/* Global Java Args Toggle */}
        <div className="flex items-center justify-between py-2">
          <label className="text-xs font-medium text-theme-text-muted">
            Use Global Java Arguments
          </label>
          <button
            onClick={() =>
              updateLocal({
                global_java_args_enable: !localConfig.global_java_args_enable,
              })
            }
            className={`
              w-9 h-5 rounded-full transition-colors relative
              ${localConfig.global_java_args_enable !== false ? "bg-theme-mid" : "bg-theme-second-dark"}
            `}
          >
            <div
              className={`
                w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform
                ${localConfig.global_java_args_enable !== false ? "translate-x-4.5 left-0" : "left-0.5"}
              `}
            />
          </button>
        </div>

        {/* Enable Logger Toggle */}
        <div className="flex items-center justify-between py-2">
          <label className="text-xs font-medium text-theme-text-muted">
            Enable In-Game Logger
          </label>
          <button
            onClick={() =>
              updateLocal({ enable_logger: !localConfig.enable_logger })
            }
            className={`
              w-9 h-5 rounded-full transition-colors relative
              ${localConfig.enable_logger !== false ? "bg-theme-mid" : "bg-theme-second-dark"}
            `}
          >
            <div
              className={`
                w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform
                ${localConfig.enable_logger !== false ? "translate-x-4.5 left-0" : "left-0.5"}
              `}
            />
          </button>
        </div>
      </div>
    </div>
  );
}