import { useState, useEffect, useCallback, useMemo } from "react";
import {
  Search,
  Download,
  Grid3X3,
  List,
  ChevronLeft,
  ChevronRight,
  Loader2,
  ExternalLink,
  Eye,
  Trash2,
  Power,
  PowerOff,
  RefreshCw,
  Package,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import TabBar from "@/components/common/TabBar";
import { tauriCommands } from "@/utils/tauri";
import type {
  SearchMod,
  SearchResult,
  QueryType,
  StoreBackendType,
  Category,
  ModId,
  Loader,
} from "@/types";

const QUERY_TYPES: { id: QueryType; label: string }[] = [
  { id: "Mods", label: "Mods" },
  { id: "ResourcePacks", label: "Resource Packs" },
  { id: "Shaders", label: "Shaders" },
  { id: "ModPacks", label: "Modpacks" },
];

const CONTENT_TABS = [
  { id: "browse", label: "Browse" },
  { id: "installed", label: "Installed" },
];

export default function ModsModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const instanceConfig = useAppStore((s) => s.instanceConfig);
  const addToast = useAppStore((s) => s.addToast);

  const [contentTab, setContentTab] = useState("browse");
  const [queryType, setQueryType] = useState<QueryType>("Mods");
  const [backend, setBackend] = useState<StoreBackendType>("modrinth");
  const [searchQuery, setSearchQuery] = useState("");
  const [results, setResults] = useState<SearchResult | null>(null);
  const [loading, setLoading] = useState(false);
  const [categories, setCategories] = useState<Category[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [viewMode, setViewMode] = useState<"grid" | "list">("list");
  const [installedMods, setInstalledMods] = useState<SearchMod[]>([]);
  const [loadingInstalled, setLoadingInstalled] = useState(false);
  const [selectedModIds, setSelectedModIds] = useState<Set<string>>(new Set());

  const open = screen.type === "mods";
  const handleClose = useCallback(() => setScreen({ type: "main" }), [setScreen]);

  // Load categories
  useEffect(() => {
    if (!open) return;
    tauriCommands
      .get_categories(backend, queryType)
      .then(setCategories)
      .catch(() => {});
  }, [open, backend, queryType]);

  // Load installed mods when switching to installed tab
  useEffect(() => {
    if (contentTab !== "installed" || !selectedInstance) return;
    setLoadingInstalled(true);
    tauriCommands
      .get_local_mods(selectedInstance, queryType)
      .then(setInstalledMods)
      .catch(() => setInstalledMods([]))
      .finally(() => setLoadingInstalled(false));
  }, [contentTab, selectedInstance, queryType]);

  // Search
  const handleSearch = useCallback(async () => {
    if (!selectedInstance) return;
    setLoading(true);
    try {
      const result = await tauriCommands.search_mods(
        searchQuery,
        "", // version
        instanceConfig?.mod_type || "Vanilla",
        backend,
        queryType,
        0,
        selectedCategories,
        false,
        false,
        selectedInstance.kind === "Server"
      );
      setResults(result);
    } catch {
      addToast("Search failed", "error");
    } finally {
      setLoading(false);
    }
  }, [searchQuery, selectedInstance, instanceConfig, backend, queryType, selectedCategories, addToast]);

  // Load more
  const handleLoadMore = useCallback(async () => {
    if (!results || !selectedInstance || results.reached_end) return;
    setLoading(true);
    try {
      const newResults = await tauriCommands.search_mods(
        searchQuery,
        "",
        instanceConfig?.mod_type || "Vanilla",
        backend,
        queryType,
        results.offset + results.mods.length,
        selectedCategories,
        false,
        false,
        selectedInstance.kind === "Server"
      );
      setResults({
        ...newResults,
        mods: [...results.mods, ...newResults.mods],
      });
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [results, searchQuery, selectedInstance, instanceConfig, backend, queryType, selectedCategories]);

  // Download a mod
  const handleDownload = useCallback(
    async (mod: SearchMod) => {
      if (!selectedInstance) return;
      const modId: ModId =
        mod.backend === "curseforge"
          ? { type: "curseforge", id: mod.id }
          : { type: "modrinth", id: mod.id };
      try {
        await tauriCommands.download_mod(selectedInstance, modId);
        addToast(`Downloaded ${mod.title}`, "success");
      } catch {
        addToast(`Failed to download ${mod.title}`, "error");
      }
    },
    [selectedInstance, addToast]
  );

  // Toggle selection
  const toggleSelect = useCallback((id: string) => {
    setSelectedModIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  }, []);

  // Download all selected
  const handleDownloadSelected = useCallback(async () => {
    if (!results || !selectedInstance) return;
    const selectedMods = results.mods.filter((m) => selectedModIds.has(m.id));
    for (const mod of selectedMods) {
      await handleDownload(mod);
    }
    setSelectedModIds(new Set());
  }, [results, selectedInstance, selectedModIds, handleDownload]);

  // Usable categories (flatten)
  const usableCategories = useMemo(
    () =>
      categories
        .filter((c) => c.is_usable)
        .flatMap((c) => [c, ...c.children.filter((ch) => ch.is_usable)]),
    [categories]
  );

  const toggleCategory = useCallback((slug: string) => {
    setSelectedCategories((prev) =>
      prev.includes(slug) ? prev.filter((s) => s !== slug) : [...prev, slug]
    );
  }, []);

  return (
    <Modal open={open} onClose={handleClose} title="Mod Store" wide>
      <div className="flex flex-col h-[650px]">
        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-2 border-b border-theme-second-dark flex-shrink-0">
          <div className="flex bg-theme-dark rounded-lg border border-theme-second-dark overflow-hidden">
            {QUERY_TYPES.map((qt) => (
              <button
                key={qt.id}
                onClick={() => setQueryType(qt.id)}
                className={`px-2.5 py-1 text-xs transition-colors ${
                  queryType === qt.id
                    ? "bg-theme-mid text-theme-extra-dark font-medium"
                    : "text-theme-text-muted hover:text-theme-text"
                }`}
              >
                {qt.label}
              </button>
            ))}
          </div>

          <div className="flex-1" />

          <div className="flex bg-theme-dark rounded-lg border border-theme-second-dark overflow-hidden">
            <button
              onClick={() => setBackend("modrinth")}
              className={`px-2 py-1 text-xs transition-colors ${
                backend === "modrinth"
                  ? "bg-theme-mid text-theme-extra-dark font-medium"
                  : "text-theme-text-muted hover:text-theme-text"
              }`}
            >
              Modrinth
            </button>
            <button
              onClick={() => setBackend("curseforge")}
              className={`px-2 py-1 text-xs transition-colors ${
                backend === "curseforge"
                  ? "bg-theme-mid text-theme-extra-dark font-medium"
                  : "text-theme-text-muted hover:text-theme-text"
              }`}
            >
              CurseForge
            </button>
          </div>

          <div className="flex bg-theme-dark rounded-lg border border-theme-second-dark overflow-hidden">
            <button
              onClick={() => setViewMode("list")}
              className={`p-1 transition-colors ${viewMode === "list" ? "text-theme-accent" : "text-theme-text-muted"}`}
            >
              <List className="w-3.5 h-3.5" />
            </button>
            <button
              onClick={() => setViewMode("grid")}
              className={`p-1 transition-colors ${viewMode === "grid" ? "text-theme-accent" : "text-theme-text-muted"}`}
            >
              <Grid3X3 className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>

        {/* Content tabs: Browse / Installed */}
        <div className="px-4 pt-2">
          <TabBar tabs={CONTENT_TABS} activeTab={contentTab} onTabChange={setContentTab} />
        </div>

        <div className="flex flex-1 overflow-hidden">
          {contentTab === "browse" ? (
            <>
              {/* Category sidebar */}
              <div className="w-44 border-r border-theme-second-dark p-2 overflow-y-auto flex-shrink-0">
                <div className="text-[10px] font-semibold uppercase tracking-wider text-theme-text-muted px-1 mb-1.5">
                  Categories
                </div>
                {usableCategories.map((cat) => (
                  <button
                    key={cat.slug}
                    onClick={() => toggleCategory(cat.slug)}
                    className={`
                      w-full text-left px-2 py-0.5 rounded text-xs mb-0.5 transition-colors truncate
                      ${selectedCategories.includes(cat.slug) ? "bg-theme-mid/20 text-theme-accent" : "text-theme-text-muted hover:bg-theme-second-dark/40"}
                    `}
                  >
                    {cat.name}
                  </button>
                ))}
              </div>

              {/* Search + Results */}
              <div className="flex-1 flex flex-col overflow-hidden">
                <div className="p-2 border-b border-theme-second-dark flex gap-2">
                  <div className="flex-1">
                    <Input
                      variant="search"
                      placeholder="Search mods..."
                      value={searchQuery}
                      onChange={(e) => setSearchQuery(e.target.value)}
                      leftIcon={<Search className="w-3.5 h-3.5" />}
                      onKeyDown={(e) => e.key === "Enter" && handleSearch()}
                    />
                  </div>
                  <Button variant="primary" size="sm" onClick={handleSearch} loading={loading}>
                    Search
                  </Button>
                  {selectedModIds.size > 0 && (
                    <Button
                      variant="secondary"
                      size="sm"
                      onClick={handleDownloadSelected}
                      icon={<Download className="w-3.5 h-3.5" />}
                    >
                      {selectedModIds.size}
                    </Button>
                  )}
                </div>

                <div className="flex-1 overflow-y-auto p-2">
                  {loading && !results ? (
                    <div className="flex items-center justify-center h-full">
                      <Loader2 className="w-6 h-6 animate-spin text-theme-mid" />
                    </div>
                  ) : !results ? (
                    <div className="flex items-center justify-center h-full text-sm text-theme-text-muted">
                      Search for mods to get started
                    </div>
                  ) : viewMode === "list" ? (
                    <div className="space-y-1">
                      {results.mods.map((mod) => (
                        <div
                          key={mod.id}
                          className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-theme-second-dark/30 transition-colors group"
                        >
                          <input
                            type="checkbox"
                            checked={selectedModIds.has(mod.id)}
                            onChange={() => toggleSelect(mod.id)}
                            className="w-3.5 h-3.5 rounded accent-[var(--color-mid)]"
                          />
                          {mod.icon_url && (
                            <img
                              src={mod.icon_url}
                              alt=""
                              className="w-6 h-6 rounded"
                              onError={(e) => (e.currentTarget.style.display = "none")}
                            />
                          )}
                          <div className="flex-1 min-w-0">
                            <div className="text-sm text-theme-text truncate">{mod.title}</div>
                            <div className="text-[10px] text-theme-text-muted truncate">
                              {mod.description}
                            </div>
                          </div>
                          <div className="text-[10px] text-theme-text-muted flex-shrink-0">
                            {formatDownloads(mod.downloads)}
                          </div>
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                            icon={<Eye className="w-3.5 h-3.5" />}
                            onClick={() => setScreen({ type: "mod_description", mod })}
                          />
                          <Button
                            variant="ghost"
                            size="sm"
                            className="opacity-0 group-hover:opacity-100 flex-shrink-0"
                            icon={<Download className="w-3.5 h-3.5" />}
                            onClick={() => handleDownload(mod)}
                          />
                        </div>
                      ))}
                    </div>
                  ) : (
                    <div className="grid grid-cols-3 gap-2">
                      {results.mods.map((mod) => (
                        <div
                          key={mod.id}
                          className="bg-theme-dark border border-theme-second-dark rounded-lg p-2 hover:border-theme-mid/50 transition-colors cursor-pointer"
                          onClick={() => setScreen({ type: "mod_description", mod })}
                        >
                          {mod.icon_url && (
                            <div className="w-full aspect-square bg-theme-second-dark rounded-md mb-2 flex items-center justify-center overflow-hidden">
                              <img src={mod.icon_url} alt="" className="w-full h-full object-cover" onError={(e) => (e.currentTarget.style.display = "none")} />
                            </div>
                          )}
                          <div className="text-xs font-medium text-theme-text truncate">{mod.title}</div>
                          <div className="text-[10px] text-theme-text-muted mt-0.5">
                            {formatDownloads(mod.downloads)}
                          </div>
                        </div>
                      ))}
                    </div>
                  )}

                  {/* Load more */}
                  {results && !results.reached_end && (
                    <div className="flex justify-center py-3">
                      <Button variant="secondary" size="sm" onClick={handleLoadMore} loading={loading}>
                        Load More
                      </Button>
                    </div>
                  )}
                </div>
              </div>
            </>
          ) : (
            /* Installed Mods Tab */
            <div className="flex-1 overflow-y-auto p-2">
              {loadingInstalled ? (
                <div className="flex items-center justify-center h-full">
                  <Loader2 className="w-6 h-6 animate-spin text-theme-mid" />
                </div>
              ) : installedMods.length === 0 ? (
                <div className="flex items-center justify-center h-full text-sm text-theme-text-muted">
                  No installed mods
                </div>
              ) : (
                <div className="space-y-1">
                  {installedMods.map((mod, i) => (
                    <div
                      key={`${mod.id}-${i}`}
                      className="flex items-center gap-2 px-2 py-1.5 rounded-md hover:bg-theme-second-dark/30 transition-colors"
                    >
                      {mod.icon_url && (
                        <img src={mod.icon_url} alt="" className="w-6 h-6 rounded" onError={(e) => (e.currentTarget.style.display = "none")} />
                      )}
                      <div className="flex-1 min-w-0">
                        <div className="text-sm text-theme-text truncate">{mod.title}</div>
                      </div>
                      <Button
                        variant="ghost"
                        size="sm"
                        icon={<Trash2 className="w-3.5 h-3.5" />}
                        onClick={async () => {
                          if (!selectedInstance) return;
                          try {
                            await tauriCommands.delete_mod(selectedInstance, mod.title, queryType);
                            setInstalledMods((prev) => prev.filter((m) => m.id !== mod.id));
                            addToast(`Deleted ${mod.title}`, "info");
                          } catch {
                            addToast("Failed to delete mod", "error");
                          }
                        }}
                      />
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </Modal>
  );
}

function formatDownloads(n: number): string {
  if (n >= 1_000_000_000) return `${(n / 1_000_000_000).toFixed(1)}B`;
  if (n >= 1_000_000) return `${(n / 1_000_000).toFixed(1)}M`;
  if (n >= 1_000) return `${(n / 1_000).toFixed(1)}K`;
  return n.toString();
}