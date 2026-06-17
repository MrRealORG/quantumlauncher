import { useState, useEffect, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Select from "@/components/common/Select";
import ProgressBar from "@/components/common/ProgressBar";
import { tauriCommands } from "@/utils/tauri";
import type { Loader, GenericProgress } from "@/types";

const LOADERS: { value: Loader; label: string }[] = [
  { value: "Fabric", label: "Fabric" },
  { value: "Quilt", label: "Quilt" },
  { value: "Forge", label: "Forge" },
  { value: "NeoForge", label: "NeoForge" },
  { value: "OptiFine", label: "OptiFine" },
  { value: "Paper", label: "Paper" },
];

export default function LoaderModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const instanceConfig = useAppStore((s) => s.instanceConfig);
  const addToast = useAppStore((s) => s.addToast);

  const [selectedLoader, setSelectedLoader] = useState<Loader>("Fabric");
  const [versions, setVersions] = useState<string[]>([]);
  const [selectedVersion, setSelectedVersion] = useState("");
  const [loading, setLoading] = useState(false);
  const [installing, setInstalling] = useState(false);
  const [progress, setProgress] = useState<GenericProgress | null>(null);
  const [uninstalling, setUninstalling] = useState(false);

  const open = screen.type === "loader";
  const handleClose = useCallback(() => setScreen({ type: "main" }), [setScreen]);

  const currentLoader = instanceConfig?.mod_type || "Vanilla";

  // Load versions when loader changes
  useEffect(() => {
    if (!open || !selectedInstance) return;
    setLoading(true);
    const version = instanceConfig?.mod_type_info?.version || "";
    tauriCommands
      .get_loader_versions(selectedInstance.name, selectedInstance.kind, selectedLoader)
      .then((lv) => {
        const v = lv.map((entry) => entry.version);
        setVersions(v);
        if (v.length > 0) setSelectedVersion(v[0]);
      })
      .catch(() => setVersions([]))
      .finally(() => setLoading(false));
  }, [open, selectedInstance, selectedLoader]);

  const handleInstall = useCallback(async () => {
    if (!selectedInstance || !selectedVersion) return;
    setInstalling(true);
    setProgress({ done: 0, total: 1, has_finished: false });
    try {
      await tauriCommands.install_loader(selectedInstance.name, selectedInstance.kind, selectedLoader, selectedVersion);
      setProgress({ done: 1, total: 1, has_finished: true, message: "Installed!" });
      addToast(`${selectedLoader} ${selectedVersion} installed`, "success");
      // Refresh instance config
      const config = await tauriCommands.get_instance_config(selectedInstance.name, selectedInstance.kind);
      useAppStore.getState().instanceConfig && useAppStore.setState({ instanceConfig: config });
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Installation failed", "error");
    } finally {
      setInstalling(false);
    }
  }, [selectedInstance, selectedLoader, selectedVersion, addToast]);

  const handleUninstall = useCallback(async () => {
    if (!selectedInstance) return;
    setUninstalling(true);
    try {
      await tauriCommands.uninstall_loader(selectedInstance.name, selectedInstance.kind);
      addToast("Loader uninstalled", "success");
      const config = await tauriCommands.get_instance_config(selectedInstance.name, selectedInstance.kind);
      useAppStore.setState({ instanceConfig: config });
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Uninstall failed", "error");
    } finally {
      setUninstalling(false);
    }
  }, [selectedInstance, addToast]);

  return (
    <Modal open={open} onClose={handleClose} title="Mod Loader">
      <div className="p-4 space-y-4">
        {/* Current Status */}
        <div className="flex items-center justify-between bg-theme-dark border border-theme-second-dark rounded-lg px-3 py-2">
          <span className="text-xs text-theme-text-muted">Current Loader:</span>
          <span className={`text-sm font-medium ${currentLoader !== "Vanilla" ? "text-theme-accent" : "text-theme-text"}`}>
            {currentLoader}
            {instanceConfig?.mod_type_info?.version ? ` ${instanceConfig.mod_type_info.version}` : ""}
          </span>
        </div>

        {/* Loader Selection */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Loader Type
          </label>
          <Select
            options={LOADERS.map((l) => ({ value: l.value, label: l.label }))}
            value={selectedLoader}
            onChange={(v) => setSelectedLoader(v as Loader)}
          />
        </div>

        {/* Version Selection */}
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Version
          </label>
          {loading ? (
            <div className="flex items-center justify-center py-4">
              <div className="animate-spin w-5 h-5 border-2 border-theme-mid border-t-transparent rounded-full" />
            </div>
          ) : (
            <Select
              options={versions.map((v) => ({ value: v, label: v }))}
              value={selectedVersion}
              onChange={setSelectedVersion}
              placeholder={versions.length === 0 ? "No versions available" : "Select version..."}
            />
          )}
        </div>

        {/* Progress */}
        {progress && (
          <ProgressBar
            value={progress.total > 0 ? progress.done / progress.total : 0}
            indeterminate={!progress.has_finished && installing}
            message={progress.message || (installing ? "Installing..." : undefined)}
          />
        )}

        {/* Actions */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="primary"
            className="flex-1"
            onClick={handleInstall}
            loading={installing}
            disabled={!selectedVersion || versions.length === 0}
          >
            Install
          </Button>
          {currentLoader !== "Vanilla" && (
            <Button
              variant="danger"
              onClick={handleUninstall}
              loading={uninstalling}
            >
              Uninstall
            </Button>
          )}
        </div>
      </div>
    </Modal>
  );
}