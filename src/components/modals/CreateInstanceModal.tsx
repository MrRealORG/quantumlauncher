import { useState, useEffect, useMemo, useCallback } from "react";
import { Search, Download, X, Filter } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import ProgressBar from "@/components/common/ProgressBar";
import { tauriCommands } from "@/utils/tauri";
import type { ListEntry, ListEntryKind } from "@/types";

const KIND_FILTERS: { kind: ListEntryKind; label: string }[] = [
  { kind: "Release", label: "Release" },
  { kind: "Snapshot", label: "Snapshot" },
  { kind: "Alpha", label: "Alpha" },
  { kind: "Beta", label: "Beta" },
  { kind: "Classic", label: "Classic" },
  { kind: "Preclassic", label: "Pre-classic" },
  { kind: "Indev", label: "Indev" },
  { kind: "Infdev", label: "Infdev" },
  { kind: "AprilFools", label: "April Fools" },
  { kind: "Special", label: "Special" },
];

export default function CreateInstanceModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const createInstance = useAppStore((s) => s.createInstance);
  const config = useAppStore((s) => s.config);

  const [versions, setVersions] = useState<ListEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [activeFilters, setActiveFilters] = useState<Set<ListEntryKind>>(
    new Set(["Release"])
  );
  const [selectedVersion, setSelectedVersion] = useState<string | null>(null);
  const [instanceName, setInstanceName] = useState("");
  const [instanceKind, setInstanceKind] = useState<string>("Client");
  const [isCreating, setIsCreating] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const open = screen.type === "create_instance";

  useEffect(() => {
    if (!open) return;
    setLoading(true);
    tauriCommands
      .get_version_list()
      .then(setVersions)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [open]);

  // Restore filters from config
  useEffect(() => {
    const saved = config?.persistent?.create_instance_filters;
    if (saved && saved.length > 0) {
      setActiveFilters(new Set(saved));
    }
  }, [config]);

  const filteredVersions = useMemo(() => {
    let filtered = versions;

    if (activeFilters.size > 0) {
      filtered = filtered.filter((v) => activeFilters.has(v.kind));
    }

    if (search.trim()) {
      const q = search.toLowerCase();
      filtered = filtered.filter((v) => v.name.toLowerCase().includes(q));
    }

    return filtered;
  }, [versions, activeFilters, search]);

  const toggleFilter = useCallback((kind: ListEntryKind) => {
    setActiveFilters((prev) => {
      const next = new Set(prev);
      if (next.has(kind)) {
        next.delete(kind);
      } else {
        next.add(kind);
      }
      return next;
    });
  }, []);

  const handleCreate = useCallback(async () => {
    if (!selectedVersion || !instanceName.trim()) return;
    setIsCreating(true);
    setError(null);
    try {
      await createInstance(instanceName.trim(), selectedVersion, instanceKind);
      setScreen({ type: "main" });
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setIsCreating(false);
    }
  }, [selectedVersion, instanceName, instanceKind, createInstance, setScreen]);

  const handleClose = useCallback(() => {
    setScreen({ type: "main" });
  }, [setScreen]);

  return (
    <Modal
      open={open}
      onClose={handleClose}
      title="Create Instance"
      wide
    >
      <div className="flex flex-col h-[600px]">
        {/* Top: Name + Kind */}
        <div className="flex gap-2 p-4 border-b border-theme-second-dark">
          <Input
            value={instanceName}
            onChange={(e) => setInstanceName(e.target.value)}
            placeholder="Instance name..."
            className="flex-1"
          />
          <div className="flex bg-theme-dark rounded-lg border border-theme-second-dark overflow-hidden">
            {(["Client", "Server"] as const).map((k) => (
              <button
                key={k}
                onClick={() => setInstanceKind(k)}
                className={`px-3 py-1.5 text-sm transition-colors ${
                  instanceKind === k
                    ? "bg-theme-mid text-theme-extra-dark font-medium"
                    : "text-theme-text-muted hover:text-theme-text"
                }`}
              >
                {k}
              </button>
            ))}
          </div>
        </div>

        <div className="flex flex-1 overflow-hidden">
          {/* Left: Filters */}
          <div className="w-40 border-r border-theme-second-dark p-2 overflow-y-auto flex-shrink-0">
            <div className="flex items-center gap-1.5 mb-2 px-1">
              <Filter className="w-3.5 h-3.5 text-theme-text-muted" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-text-muted">
                Filters
              </span>
            </div>
            {KIND_FILTERS.map((f) => (
              <button
                key={f.kind}
                onClick={() => toggleFilter(f.kind)}
                className={`
                  w-full text-left px-2 py-1 rounded text-xs mb-0.5 transition-colors
                  ${
                    activeFilters.has(f.kind)
                      ? "bg-theme-mid/20 text-theme-accent font-medium"
                      : "text-theme-text-muted hover:bg-theme-second-dark/40 hover:text-theme-text"
                  }
                `}
              >
                {f.label}
              </button>
            ))}
          </div>

          {/* Right: Version List */}
          <div className="flex-1 flex flex-col overflow-hidden">
            <div className="p-2 border-b border-theme-second-dark">
              <Input
                variant="search"
                placeholder="Search versions..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                leftIcon={<Search className="w-3.5 h-3.5" />}
                rightIcon={
                  search ? (
                    <button onClick={() => setSearch("")} className="hover:text-theme-text">
                      <X className="w-3.5 h-3.5" />
                    </button>
                  ) : undefined
                }
              />
            </div>

            <div className="flex-1 overflow-y-auto p-1">
              {loading ? (
                <div className="flex items-center justify-center h-full">
                  <div className="animate-spin w-6 h-6 border-2 border-theme-mid border-t-transparent rounded-full" />
                </div>
              ) : filteredVersions.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-theme-text-muted">
                  No versions found
                </div>
              ) : (
                filteredVersions.map((v) => (
                  <button
                    key={v.name}
                    onClick={() => setSelectedVersion(v.name)}
                    className={`
                      w-full flex items-center justify-between px-3 py-1.5 rounded text-sm transition-colors
                      ${
                        selectedVersion === v.name
                          ? "bg-theme-mid/20 text-theme-accent"
                          : "hover:bg-theme-second-dark/40 text-theme-text"
                      }
                    `}
                  >
                    <span className="truncate">{v.name}</span>
                    <span className="text-[10px] text-theme-text-muted ml-2 flex-shrink-0">
                      {v.kind}
                    </span>
                  </button>
                ))
              )}
            </div>
          </div>
        </div>

        {/* Bottom: Create button */}
        <div className="p-4 border-t border-theme-second-dark flex items-center justify-between">
          <div className="text-xs text-theme-text-muted">
            {selectedVersion && `Selected: ${selectedVersion}`}
          </div>
          <div className="flex gap-2">
            <Button variant="ghost" onClick={handleClose}>
              Cancel
            </Button>
            <Button
              variant="primary"
              onClick={handleCreate}
              loading={isCreating}
              disabled={!selectedVersion || !instanceName.trim()}
              icon={<Download className="w-4 h-4" />}
            >
              Create
            </Button>
          </div>
        </div>

        {error && (
          <div className="px-4 pb-3">
            <p className="text-xs text-theme-error">{error}</p>
          </div>
        )}
      </div>
    </Modal>
  );
}