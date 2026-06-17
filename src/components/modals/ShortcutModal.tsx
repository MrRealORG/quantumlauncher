import { useState, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";
import { tauriCommands } from "@/utils/tauri";
import type { ShortcutConfig } from "@/types";

export default function ShortcutModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const accountsDropdown = useAppStore((s) => s.accountsDropdown);
  const addToast = useAppStore((s) => s.addToast);

  const [name, setName] = useState(selectedInstance?.name || "");
  const [description, setDescription] = useState("");
  const [account, setAccount] = useState("");
  const [saveToApplications, setSaveToApplications] = useState(false);
  const [creating, setCreating] = useState(false);

  const open = screen.type === "shortcut";
  const handleClose = useCallback(() => setScreen({ type: "main" }), [setScreen]);

  const accountOptions = accountsDropdown
    .filter((a) => a !== "+ Add Account")
    .map((a) => ({ value: a, label: a }));

  const handleCreate = useCallback(async () => {
    if (!selectedInstance || !name.trim()) return;
    setCreating(true);
    try {
      const config: ShortcutConfig = {
        name: name.trim(),
        description,
        instance: selectedInstance.name,
        account: account || null,
        save_to_applications: saveToApplications,
      };
      await tauriCommands.create_shortcut(config);
      addToast("Shortcut created", "success");
      handleClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Failed to create shortcut", "error");
    } finally {
      setCreating(false);
    }
  }, [selectedInstance, name, description, account, saveToApplications, addToast, handleClose]);

  return (
    <Modal open={open} onClose={handleClose} title="Create Shortcut">
      <div className="p-4 space-y-4">
        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Shortcut Name
          </label>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="Minecraft"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Description
          </label>
          <Input
            value={description}
            onChange={(e) => setDescription(e.target.value)}
            placeholder="Play Minecraft with PK Launcher"
          />
        </div>

        <div>
          <label className="block text-xs font-medium text-theme-text-muted mb-1.5">
            Account (optional)
          </label>
          <Select
            options={accountOptions}
            value={account}
            onChange={setAccount}
            placeholder="Default account"
          />
        </div>

        <div className="flex items-center justify-between py-2">
          <label className="text-xs font-medium text-theme-text-muted">
            Save to Applications Menu
          </label>
          <button
            onClick={() => setSaveToApplications(!saveToApplications)}
            className={`w-9 h-5 rounded-full transition-colors relative ${saveToApplications ? "bg-theme-mid" : "bg-theme-second-dark"}`}
          >
            <div className={`w-3.5 h-3.5 bg-white rounded-full absolute top-0.5 transition-transform ${saveToApplications ? "translate-x-4.5 left-0" : "left-0.5"}`} />
          </button>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <Button variant="ghost" onClick={handleClose}>
            Cancel
          </Button>
          <Button
            variant="primary"
            onClick={handleCreate}
            loading={creating}
            disabled={!name.trim()}
          >
            Create Shortcut
          </Button>
        </div>
      </div>
    </Modal>
  );
}