import { useState, useEffect, useCallback } from "react";
import { Play, Settings, Plus, Loader2, Package, ChevronDown, ChevronUp } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import Select from "@/components/common/Select";

export default function PlayTab() {
  const {
    selectedInstance,
    instanceConfig,
    instanceNotes,
    config,
    accountsDropdown,
    selectedAccount,
    isLaunching,
    setSelectedAccount,
    launchGame,
    setScreen,
    updateConfig,
    saveNotes,
  } = useAppStore();

  const [notesExpanded, setNotesExpanded] = useState(false);
  const [localNotes, setLocalNotes] = useState("");

  useEffect(() => {
    setLocalNotes(instanceNotes || "");
  }, [instanceNotes]);

  const handleSaveNotes = useCallback(() => {
    saveNotes(localNotes);
  }, [localNotes, saveNotes]);

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

  return (
    <div className="flex-1 overflow-y-auto p-4">
      <div className="max-w-md mx-auto space-y-4">
        {/* Instance Name */}
        <div>
          <h1 className="text-lg font-semibold text-theme-text truncate" title={selectedInstance.name}>
            {selectedInstance.name}
          </h1>
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

        {/* Play and Settings Buttons */}
        <div className="flex gap-2 pt-1">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            icon={<Play className="w-5 h-5" />}
            loading={isLaunching}
            onClick={launchGame}
          >
            Play
          </Button>
          <Button
            variant="secondary"
            size="lg"
            icon={<Settings className="w-5 h-5" />}
            onClick={() => setScreen({ type: "settings" })}
          />
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