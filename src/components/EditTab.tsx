import { useState, useEffect, useCallback, useRef } from "react";
import { Save, RotateCcw, Info, FolderOpen, Trash2, Pencil, Check, X, Download, RefreshCw, AlertTriangle, FileText, Loader2, Plus, Package } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import ConfirmModal from "@/components/modals/ConfirmModal";
import { tauriCommands } from "@/utils/tauri";
import type { InstanceConfigJson, PreLaunchPrefixMode, CustomJarConfig } from "@/types";

export default function EditTab() {
  const {
    selectedInstance,
    instanceConfig,
    updateInstanceConfig,
    deleteInstance,
    renameInstance,
    addToast,
  } = useAppStore();
  const [localConfig, setLocalConfig] = useState<InstanceConfigJson | null>(null);
  const [hasChanges, setHasChanges] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [isRenaming, setIsRenaming] = useState(false);
  const [renameValue, setRenameValue] = useState("");
  const debounceRef = useRef<ReturnType<typeof setTimeout>>();
  const [redownloading, setRedownloading] = useState<string | null>(null);
  const [showServerProps, setShowServerProps] = useState(false);
  const [serverProps, setServerProps] = useState<Record<string, string>>({});
  const [serverPropsLoading, setServerPropsLoading] = useState(false);

  // Custom JAR state
  const [customJarFiles, setCustomJarFiles] = useState<string[]>([]);
  const [customJarLoading, setCustomJarLoading] = useState(false);
  const [mainClassMode, setMainClassMode] = useState<"default" | "safefallback" | "custom">("default");
  const [customMainClass, setCustomMainClass] = useState("");

  useEffect(() => {
    if (instanceConfig) {
      setLocalConfig({ ...instanceConfig });
      setHasChanges(false);
      // Sync main class mode from config
      if (instanceConfig.custom_jar?.autoset_main_class) {
        setMainClassMode("safefallback");
      } else if (instanceConfig.main_class_override) {
        setMainClassMode("custom");
        setCustomMainClass(instanceConfig.main_class_override);
      } else {
        setMainClassMode("default");
        setCustomMainClass("");
      }
    }
  }, [instanceConfig]);

  useEffect(() => {
    if (selectedInstance) {
      setRenameValue(selectedInstance.name);
    }
    setIsRenaming(false);
  }, [selectedInstance]);

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

  const handleBrowseJava = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const selected = await open({
        title: "Select Java Executable",
        filters: [
          {
            name: "Java",
            extensions: ["exe", "bat", "cmd", "sh"],
          },
        ],
        multiple: false,
      });
      if (selected) {
        const path = Array.isArray(selected) ? selected[0] : selected;
        updateLocal({ java_override: path });
      }
    } catch (err) {
      addToast("Failed to open file dialog", "error");
    }
  }, [updateLocal, addToast]);

  const handleRename = useCallback(async () => {
    if (!selectedInstance || !renameValue.trim() || renameValue.trim() === selectedInstance.name) {
      setIsRenaming(false);
      return;
    }
    try {
      await renameInstance(selectedInstance.name, renameValue.trim(), selectedInstance.kind);
      setIsRenaming(false);
    } catch {
      addToast("Failed to rename instance", "error");
      setIsRenaming(false);
    }
  }, [selectedInstance, renameValue, renameInstance, addToast]);

  const handleDelete = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      await deleteInstance(selectedInstance.name, selectedInstance.kind);
    } catch {
      addToast("Failed to delete instance", "error");
    }
    setConfirmDelete(false);
  }, [selectedInstance, deleteInstance, addToast]);

  const handleRedownloadStage = useCallback(async (stage: "libraries" | "assets") => {
    if (!selectedInstance) return;
    const label = stage === "libraries" ? "Reinstalling libraries" : "Updating assets";
    setRedownloading(stage);
    try {
      await tauriCommands.redownload_instance_stage(selectedInstance.name, stage);
      addToast(`${label} completed`, "success");
    } catch (e) {
      addToast(e instanceof Error ? e.message : `${label} failed`, "error");
    } finally {
      setRedownloading(null);
    }
  }, [selectedInstance, addToast]);

  const handleOpenInstanceFolder = useCallback(async () => {
    if (!selectedInstance) return;
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      const kind = selectedInstance.kind;
      const subDir = kind === "Client" ? "instances" : "servers";
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dataDir = await appDataDir();
      const instanceDir = `${dataDir}QuantumLauncher/${subDir}/${selectedInstance.name}`;
      await open(instanceDir);
    } catch {
      addToast("Failed to open folder", "error");
    }
  }, [selectedInstance, addToast]);

  // Load custom JAR file list
  const loadCustomJars = useCallback(async () => {
    setCustomJarLoading(true);
    try {
      const { appDataDir } = await import("@tauri-apps/api/path");
      const { readDir: fsReadDir } = await import("@tauri-apps/plugin-fs");
      const dataDir = await appDataDir();
      const jarDir = `${dataDir}QuantumLauncher/custom_jars`;
      const entries = await fsReadDir(jarDir);
      const jars = entries
        .filter((e: { name?: string; isFile?: boolean; isDirectory?: boolean }) => e.isFile && e.name?.endsWith(".jar"))
        .map((e: { name?: string }) => e.name!)
        .sort();
      setCustomJarFiles(jars);
    } catch {
      // Directory may not exist yet
      setCustomJarFiles([]);
    } finally {
      setCustomJarLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedInstance?.kind === "Client") {
      loadCustomJars();
    }
  }, [selectedInstance, loadCustomJars]);

  const handleAddCustomJar = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-dialog");
      const { copyFile } = await import("@tauri-apps/plugin-fs");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const { mkdir } = await import("@tauri-apps/plugin-fs");

      const selected = await open({
        title: "Select Custom Minecraft JAR",
        filters: [{ name: "Java Archive", extensions: ["jar"] }],
        multiple: false,
      });
      if (!selected) return;

      const srcPath = Array.isArray(selected) ? selected[0] : selected;
      const fileName = srcPath.split(/[\\/]/).pop() || "custom.jar";
      const dataDir = await appDataDir();
      const jarDir = `${dataDir}QuantumLauncher/custom_jars`;

      try { await mkdir(jarDir, { recursive: true }); } catch { /* dir may exist */ }
      const destPath = `${jarDir}/${fileName}`;
      await copyFile(srcPath, destPath);

      const jarConfig: CustomJarConfig = { name: fileName, autoset_main_class: false };
      updateInstanceConfig({ custom_jar: jarConfig });
      addToast(`Custom JAR "${fileName}" added`, "success");
      loadCustomJars();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to add JAR", "error");
    }
  }, [updateInstanceConfig, addToast, loadCustomJars]);

  const handleRemoveCustomJar = useCallback(async () => {
    if (!localConfig?.custom_jar) return;
    const name = localConfig.custom_jar.name;
    try {
      const { remove } = await import("@tauri-apps/plugin-fs");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dataDir = await appDataDir();
      await remove(`${dataDir}QuantumLauncher/custom_jars/${name}`);
      updateInstanceConfig({ custom_jar: null, main_class_override: null });
      setMainClassMode("default");
      addToast(`Custom JAR "${name}" removed`, "success");
      loadCustomJars();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to remove JAR", "error");
    }
  }, [localConfig?.custom_jar, updateInstanceConfig, addToast, loadCustomJars]);

  const handleOpenCustomJarFolder = useCallback(async () => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const { mkdir } = await import("@tauri-apps/plugin-fs");
      const dataDir = await appDataDir();
      const jarDir = `${dataDir}QuantumLauncher/custom_jars`;
      try { await mkdir(jarDir, { recursive: true }); } catch { /* dir may exist */ }
      await open(jarDir);
    } catch {
      addToast("Failed to open folder", "error");
    }
  }, [addToast]);

  const handleMainClassMode = useCallback((mode: "default" | "safefallback" | "custom") => {
    setMainClassMode(mode);
    const jar = localConfig?.custom_jar;
    switch (mode) {
      case "default":
        updateInstanceConfig({ main_class_override: null, custom_jar: jar ? { ...jar, autoset_main_class: false } : undefined });
        setCustomMainClass("");
        break;
      case "safefallback":
        updateInstanceConfig({ main_class_override: null, custom_jar: jar ? { ...jar, autoset_main_class: true } : { name: "", autoset_main_class: true } });
        setCustomMainClass("");
        break;
      case "custom":
        updateInstanceConfig({ custom_jar: jar ? { ...jar, autoset_main_class: false } : undefined });
        break;
    }
  }, [localConfig?.custom_jar, updateInstanceConfig]);

  const handleCustomMainClassInput = useCallback((val: string) => {
    setCustomMainClass(val);
    updateInstanceConfig({ main_class_override: val || null });
  }, [updateInstanceConfig]);

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
        {/* Instance Name Header */}
        <div className="flex items-center justify-between mb-2">
          <div className="flex items-center gap-2 min-w-0">
            {isRenaming ? (
              <div className="flex items-center gap-1.5 min-w-0">
                <input
                  type="text"
                  value={renameValue}
                  onChange={(e) => setRenameValue(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === "Enter") handleRename();
                    if (e.key === "Escape") {
                      setIsRenaming(false);
                      setRenameValue(selectedInstance.name);
                    }
                  }}
                  autoFocus
                  className="text-sm font-semibold bg-theme-dark border border-theme-mid text-theme-text rounded px-2 py-0.5 outline-none min-w-0 font-mono"
                />
                <button
                  onClick={handleRename}
                  className="p-0.5 text-green-500 hover:text-green-400 transition-colors"
                >
                  <Check className="w-3.5 h-3.5" />
                </button>
                <button
                  onClick={() => {
                    setIsRenaming(false);
                    setRenameValue(selectedInstance.name);
                  }}
                  className="p-0.5 text-theme-text-muted hover:text-theme-text transition-colors"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>
            ) : (
              <>
                <h2 className="text-sm font-semibold text-theme-text font-mono truncate">
                  {selectedInstance.name}
                </h2>
                <button
                  onClick={() => setIsRenaming(true)}
                  className="p-0.5 text-theme-text-muted hover:text-theme-text transition-colors flex-shrink-0"
                  title="Rename instance"
                >
                  <Pencil className="w-3 h-3" />
                </button>
              </>
            )}
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
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

        {/* Instance type badge */}
        <div className="flex items-center gap-2">
          <span className="text-[10px] font-medium px-1.5 py-0.5 rounded bg-theme-mid/20 text-theme-mid">
            {selectedInstance.kind}
          </span>
          {typeof instanceConfig?.version === "string" && (
            <span className="text-[10px] text-theme-text-muted">
              Minecraft {instanceConfig.version}
            </span>
          )}
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

        {/* Java Override Path with Browse button */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Custom Java Path
          </label>
          <div className="flex items-center gap-1.5">
            <Input
              value={localConfig.java_override || ""}
              onChange={(e) =>
                updateLocal({
                  java_override: e.target.value || null,
                })
              }
              placeholder="Leave empty for automatic"
              className="flex-1 min-w-0"
            />
            <button
              onClick={handleBrowseJava}
              className="px-2 py-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-second-dark/60 rounded-md transition-colors flex-shrink-0"
              title="Browse for Java executable"
            >
              <FolderOpen className="w-4 h-4" />
            </button>
          </div>
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

        {/* Custom JAR (Client only) */}
        {selectedInstance.kind === "Client" && (
          <div className="space-y-2">
            <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
              Custom JAR File
            </label>
            <div className="flex items-center gap-1.5">
              <Select
                options={[
                  { value: "(None)", label: "(None)" },
                  ...customJarFiles.map((j) => ({ value: j, label: j })),
                  { value: "+ Add JAR", label: "+ Add JAR" },
                  { value: "- Remove Selected", label: "- Remove Selected" },
                  { value: "> Open Folder", label: "> Open Folder" },
                ]}
                value={localConfig.custom_jar?.name || "(None)"}
                onChange={(v) => {
                  if (v === "+ Add JAR") {
                    handleAddCustomJar();
                  } else if (v === "- Remove Selected") {
                    handleRemoveCustomJar();
                  } else if (v === "> Open Folder") {
                    handleOpenCustomJarFolder();
                  } else if (v === "(None)") {
                    updateInstanceConfig({ custom_jar: null });
                  } else {
                    const jarConfig: CustomJarConfig = {
                      name: v,
                      autoset_main_class: localConfig.custom_jar?.autoset_main_class || false,
                    };
                    updateInstanceConfig({ custom_jar: jarConfig });
                  }
                }}
                disabled={customJarLoading}
                placeholder={customJarLoading ? "Loading..." : undefined}
              />
            </div>
            <p className="text-[10px] text-theme-text-muted/70">
              For replacing the Minecraft JAR, not adding to it. To patch your existing JAR, use Mods &gt; Jarmod Patches.
            </p>

            {/* Main Class Mode */}
            <div className="space-y-1.5 mt-2">
              <label className="block text-[11px] font-medium text-theme-text-muted">Main Class</label>
              <div className="space-y-1">
                <label className="flex items-center gap-2 text-xs text-theme-text cursor-pointer">
                  <input
                    type="radio"
                    checked={mainClassMode === "default"}
                    onChange={() => handleMainClassMode("default")}
                    className="accent-theme-mid"
                  />
                  Default
                </label>
                <label className="flex items-center gap-2 text-xs text-theme-text cursor-pointer">
                  <input
                    type="radio"
                    checked={mainClassMode === "safefallback"}
                    onChange={() => handleMainClassMode("safefallback")}
                    className="accent-theme-mid"
                  />
                  Safe Mode (might fix crashes?)
                </label>
                <label className="flex items-center gap-2 text-xs text-theme-text cursor-pointer">
                  <input
                    type="radio"
                    checked={mainClassMode === "custom"}
                    onChange={() => handleMainClassMode("custom")}
                    className="accent-theme-mid"
                  />
                  Custom
                </label>
              </div>
              {mainClassMode === "custom" && (
                <Input
                  value={customMainClass}
                  onChange={(e) => handleCustomMainClassInput(e.target.value)}
                  placeholder="Enter main class..."
                  className="font-mono text-xs mt-1"
                />
              )}
            </div>
          </div>
        )}

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
              w-9 h-5 rounded-full transition-colors duration-200 relative
              ${localConfig.global_java_args_enable !== false ? "bg-theme-mid" : "bg-theme-second-dark"}
            `}
          >
            <div
              className={`
                w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all duration-200
                ${localConfig.global_java_args_enable !== false ? "left-[18px]" : "left-0.5"}
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
              w-9 h-5 rounded-full transition-colors duration-200 relative
              ${localConfig.enable_logger !== false ? "bg-theme-mid" : "bg-theme-second-dark"}
            `}
          >
            <div
              className={`
                w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-all duration-200
                ${localConfig.enable_logger !== false ? "left-[18px]" : "left-0.5"}
              `}
            />
          </button>
        </div>

        {/* Maintenance (Client only) */}
        {selectedInstance.kind === "Client" && (
          <div className="border-t border-theme-second-dark pt-4 mt-2">
            <h3 className="text-xs font-semibold text-theme-text-muted mb-2">Maintenance</h3>
            <div className="flex flex-wrap gap-2">
              <Button
                variant="ghost"
                size="sm"
                icon={<Download className="w-3.5 h-3.5" />}
                loading={redownloading === "libraries"}
                disabled={redownloading !== null}
                onClick={() => handleRedownloadStage("libraries")}
              >
                Reinstall Libraries
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<RefreshCw className="w-3.5 h-3.5" />}
                loading={redownloading === "assets"}
                disabled={redownloading !== null}
                onClick={() => handleRedownloadStage("assets")}
              >
                Update Assets
              </Button>
              <Button
                variant="ghost"
                size="sm"
                icon={<FolderOpen className="w-3.5 h-3.5" />}
                onClick={handleOpenInstanceFolder}
              >
                Open Folder
              </Button>
            </div>
          </div>
        )}

        {/* Server Properties (Server only) */}
        {selectedInstance.kind === "Server" && (
          <div className="border-t border-theme-second-dark pt-4 mt-2">
            <div className="flex items-center justify-between mb-2">
              <h3 className="text-xs font-semibold text-theme-text-muted">Server</h3>
              <Button
                variant="ghost"
                size="sm"
                icon={<FileText className="w-3.5 h-3.5" />}
                onClick={async () => {
                  setServerPropsLoading(true);
                  setShowServerProps(true);
                  try {
                    const props = await tauriCommands.get_server_properties(selectedInstance.name);
                    setServerProps(props);
                  } catch {
                    addToast("Failed to load server.properties", "error");
                    setShowServerProps(false);
                  } finally {
                    setServerPropsLoading(false);
                  }
                }}
              >
                Edit server.properties
              </Button>
            </div>
            {showServerProps && (
              <div className="space-y-2">
                {serverPropsLoading ? (
                  <div className="flex items-center gap-2 text-xs text-theme-text-muted py-2">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Loading properties...
                  </div>
                ) : (
                  <>
                    <div className="max-h-48 overflow-y-auto space-y-1 bg-theme-dark border border-theme-second-dark rounded-lg p-2">
                      {Object.entries(serverProps).map(([key, val]) => (
                        <div key={key} className="flex items-center gap-1.5">
                          <span className="text-[11px] font-mono text-theme-mid w-36 flex-shrink-0 truncate" title={key}>
                            {key}
                          </span>
                          <span className="text-theme-text-muted text-xs">=</span>
                          <input
                            className="flex-1 bg-theme-surface border border-theme-second-dark text-theme-text text-xs rounded px-1.5 py-0.5 outline-none focus:border-theme-mid min-w-0"
                            value={val}
                            onChange={(e) =>
                              setServerProps((prev) => ({ ...prev, [key]: e.target.value }))
                            }
                          />
                        </div>
                      ))}
                    </div>
                    <div className="flex gap-2">
                      <Button
                        variant="primary"
                        size="sm"
                        onClick={async () => {
                          try {
                            await tauriCommands.save_server_properties(selectedInstance.name, serverProps);
                            addToast("server.properties saved", "success");
                          } catch {
                            addToast("Failed to save server.properties", "error");
                          }
                        }}
                      >
                        Save Properties
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setShowServerProps(false)}
                      >
                        Close
                      </Button>
                    </div>
                  </>
                )}
              </div>
            )}
          </div>
        )}

        {/* RAM Warning */}
        {localConfig.ram_in_mb > 8192 && (
          <div className="flex items-start gap-2 bg-theme-warning/10 border border-theme-warning/30 rounded-lg px-3 py-2">
            <AlertTriangle className="w-4 h-4 text-theme-warning flex-shrink-0 mt-0.5" />
            <p className="text-[11px] text-theme-warning/90">
              High memory allocation ({localConfig.ram_in_mb} MB). This may cause issues on systems with less RAM.
            </p>
          </div>
        )}

        {/* Danger Zone */}
        <div className="border-t border-theme-second-dark pt-4 mt-2">
          <h3 className="text-xs font-semibold text-theme-error/80 mb-2">Danger Zone</h3>
          <Button
            variant="ghost"
            size="sm"
            icon={<Trash2 className="w-3.5 h-3.5" />}
            className="text-theme-error hover:text-theme-error hover:bg-theme-error/10"
            onClick={() => setConfirmDelete(true)}
          >
            Delete Instance
          </Button>
        </div>
      </div>

      {/* Confirm Delete */}
      <ConfirmModal
        open={confirmDelete}
        title="Delete Instance"
        message={`Are you sure you want to delete "${selectedInstance.name}"? This cannot be undone. All files will be permanently removed.`}
        onConfirm={handleDelete}
        onCancel={() => setConfirmDelete(false)}
      />
    </div>
  );
}