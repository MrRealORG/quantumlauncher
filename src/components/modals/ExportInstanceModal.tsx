import { useState, useCallback } from "react";
import { FolderOpen } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import ProgressBar from "@/components/common/ProgressBar";
import { tauriCommands } from "@/utils/tauri";
import { open } from "@tauri-apps/plugin-dialog";

export default function ExportInstanceModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const addToast = useAppStore((s) => s.addToast);

  const [exportPath, setExportPath] = useState("");
  const [exceptions, setExceptions] = useState<string[]>([]);
  const [exceptionInput, setExceptionInput] = useState("");
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState(0);

  const isOpen = screen.type === "export_instance";
  const handleClose = useCallback(() => setScreen({ type: "main" }), [setScreen]);

  const handleBrowse = useCallback(async () => {
    try {
      const path = await open({
        directory: true,
        multiple: false,
        title: "Select Export Location",
      });
      if (path) setExportPath(path);
    } catch {
      // dialog cancelled
    }
  }, []);

  const addException = useCallback(() => {
    if (exceptionInput.trim() && !exceptions.includes(exceptionInput.trim())) {
      setExceptions((prev) => [...prev, exceptionInput.trim()]);
      setExceptionInput("");
    }
  }, [exceptionInput, exceptions]);

  const removeException = useCallback((ex: string) => {
    setExceptions((prev) => prev.filter((e) => e !== ex));
  }, []);

  const handleExport = useCallback(async () => {
    if (!selectedInstance || !exportPath) return;
    setExporting(true);
    setProgress(0);
    try {
      await tauriCommands.export_instance(
        selectedInstance.name,
        selectedInstance.kind,
        exceptions
      );
      setProgress(1);
      addToast("Instance exported successfully", "success");
      handleClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Export failed", "error");
    } finally {
      setExporting(false);
    }
  }, [selectedInstance, exportPath, exceptions, addToast, handleClose]);

  return (
    <Modal open={isOpen} onClose={handleClose} title="Export Instance">
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Export Location
          </label>
          <div className="flex gap-2">
            <Input
              value={exportPath}
              onChange={(e) => setExportPath(e.target.value)}
              placeholder="Select a folder..."
              className="flex-1"
            />
            <Button variant="secondary" size="sm" icon={<FolderOpen className="w-4 h-4" />} onClick={handleBrowse}>
              Browse
            </Button>
          </div>
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            File Exceptions (paths to exclude)
          </label>
          <div className="flex gap-2 mb-2">
            <Input
              value={exceptionInput}
              onChange={(e) => setExceptionInput(e.target.value)}
              placeholder="e.g., logs/"
              onKeyDown={(e) => e.key === "Enter" && addException()}
            />
            <Button variant="secondary" size="sm" onClick={addException}>
              Add
            </Button>
          </div>
          {exceptions.length > 0 && (
            <div className="flex flex-wrap gap-1">
              {exceptions.map((ex) => (
                <span
                  key={ex}
                  className="inline-flex items-center gap-1 px-2 py-0.5 bg-theme-dark border border-theme-second-dark rounded text-xs text-theme-text"
                >
                  {ex}
                  <button
                    onClick={() => removeException(ex)}
                    className="text-theme-text-muted hover:text-theme-error transition-colors"
                  >
                    ×
                  </button>
                </span>
              ))}
            </div>
          )}
        </div>

        {exporting && <ProgressBar value={progress} indeterminate />}

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose} disabled={exporting}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleExport}
            loading={exporting}
            disabled={!exportPath}
          >
            Export
          </Button>
        </div>
      </div>
    </Modal>
  );
}