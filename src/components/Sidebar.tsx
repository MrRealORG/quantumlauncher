import { useState, useCallback, useRef, useMemo } from "react";
import {
  ChevronRight,
  ChevronDown,
  FolderOpen,
  Monitor,
  Server,
  Plus,
  Trash2,
  Pencil,
  FolderPlus,
  MoreHorizontal,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import ContextMenu from "@/components/common/ContextMenu";
import type { SidebarNode, SidebarNodeKind, SidebarFolder, InstanceKind } from "@/types";
import ConfirmModal from "@/components/modals/ConfirmModal";

const SIDEBAR_DEFAULT_WIDTH = 0.33;

export default function Sidebar() {
  const {
    clientInstances,
    serverInstances,
    selectedInstance,
    sidebarConfig,
    selectInstance,
    deleteInstance,
    renameInstance,
    saveSidebar,
    setScreen,
    updateSidebar,
    addToast,
  } = useAppStore();

  const [sidebarWidth, setSidebarWidth] = useState(SIDEBAR_DEFAULT_WIDTH);
  const [isResizing, setIsResizing] = useState(false);
  const [contextMenu, setContextMenu] = useState<{
    x: number;
    y: number;
    type: "instance" | "folder";
    name: string;
    kind?: InstanceKind;
  } | null>(null);
  const [renameState, setRenameState] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{ name: string; kind: string } | null>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Get all nodes (use sidebar config or fall back to flat lists)
  const nodes = useMemo(() => {
    if (sidebarConfig?.list && sidebarConfig.list.length > 0) {
      return sidebarConfig.list;
    }
    // Build flat list from instances
    const list: SidebarNode[] = [];
    for (const name of clientInstances) {
      list.push({ name, kind: { type: "instance", kind: "Client" } });
    }
    for (const name of serverInstances) {
      list.push({ name, kind: { type: "instance", kind: "Server" } });
    }
    return list;
  }, [sidebarConfig, clientInstances, serverInstances]);

  // Separate into clients and servers
  const clientNodes = useMemo(
    () => nodes.filter((n) => n.kind.type === "instance" && n.kind.kind === "Client"),
    [nodes]
  );
  const serverNodes = useMemo(
    () => nodes.filter((n) => n.kind.type === "instance" && n.kind.kind === "Server"),
    [nodes]
  );
  const folderNodes = useMemo(
    () => nodes.filter((n) => n.kind.type === "folder"),
    [nodes]
  );

  const isSelected = useCallback(
    (name: string, kind: InstanceKind) =>
      selectedInstance?.name === name && selectedInstance?.kind === kind,
    [selectedInstance]
  );

  const handleContextMenu = useCallback(
    (e: React.MouseEvent, name: string, kind: InstanceKind, type: "instance" | "folder") => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, type, name, kind });
    },
    []
  );

  const handleStartRename = useCallback((name: string) => {
    setRenameState(name);
    setRenameValue(name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (renameState && renameValue.trim() && renameValue.trim() !== renameState) {
      const kind =
        clientInstances.includes(renameState) ? "Client" : serverInstances.includes(renameState) ? "Server" : "Client";
      try {
        await renameInstance(renameState, renameValue.trim(), kind);
      } catch {
        addToast("Failed to rename instance", "error");
      }
    }
    setRenameState(null);
  }, [renameState, renameValue, clientInstances, serverInstances, renameInstance, addToast]);

  // Resize handling
  const handleResizeStart = useCallback(
    (e: React.MouseEvent) => {
      e.preventDefault();
      setIsResizing(true);
      const startX = e.clientX;
      const startWidth = sidebarWidth;
      const containerWidth = window.innerWidth;

      const handleMouseMove = (ev: MouseEvent) => {
        const delta = (ev.clientX - startX) / containerWidth;
        const newWidth = Math.max(0.15, Math.min(0.55, startWidth + delta));
        setSidebarWidth(newWidth);
      };

      const handleMouseUp = () => {
        setIsResizing(false);
        document.removeEventListener("mousemove", handleMouseMove);
        document.removeEventListener("mouseup", handleMouseUp);
      };

      document.addEventListener("mousemove", handleMouseMove);
      document.addEventListener("mouseup", handleMouseUp);
    },
    [sidebarWidth]
  );

  const handleNewFolder = useCallback(async () => {
    if (!sidebarConfig) return;
    const newFolder: SidebarNode = {
      name: "New Folder",
      kind: {
        type: "folder",
        folder: { id: crypto.randomUUID(), children: [], is_expanded: true },
      },
    };
    const updated = { list: [...sidebarConfig.list, newFolder] };
    await saveSidebar(updated);
    handleStartRename("New Folder");
  }, [sidebarConfig, saveSidebar, handleStartRename]);

  const handleDeleteInstance = useCallback(async () => {
    if (!confirmDelete) return;
    try {
      await deleteInstance(confirmDelete.name, confirmDelete.kind);
    } catch {
      addToast("Failed to delete instance", "error");
    }
    setConfirmDelete(null);
  }, [confirmDelete, deleteInstance, addToast]);

  const renderNode = (node: SidebarNode, depth: number = 0) => {
    if (node.kind.type === "folder") {
      const folder = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      return (
        <div key={`folder-${folder.id}`}>
          <div
            className="flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer hover:bg-theme-second-dark/40 transition-colors group"
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            onClick={() => {
              const updated = { ...sidebarConfig! };
              updated.list = updated.list.map((n) => {
                if (n.kind.type === "folder") {
                  const f = (n.kind as { type: "folder"; folder: SidebarFolder }).folder;
                  if (f.id === folder.id) {
                    return {
                      ...n,
                      kind: {
                        type: "folder",
                        folder: { ...f, is_expanded: !f.is_expanded },
                      },
                    };
                  }
                }
                return n;
              });
              saveSidebar(updated);
            }}
            onContextMenu={(e) => handleContextMenu(e, node.name, "Client", "folder")}
          >
            {folder.is_expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-theme-text-muted flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-theme-text-muted flex-shrink-0" />
            )}
            <FolderOpen className="w-3.5 h-3.5 text-theme-mid flex-shrink-0" />
            <span className="text-sm text-theme-text truncate flex-1">{node.name}</span>
          </div>
          {folder.is_expanded &&
            folder.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const kind = node.kind.kind;
    const name = node.name;
    const selected = isSelected(name, kind);
    const isRenaming = renameState === name;

    return (
      <div
        key={`${kind}-${name}`}
        className={`
          flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer
          transition-colors group
          ${selected ? "bg-theme-mid/20 text-theme-accent" : "hover:bg-theme-second-dark/40 text-theme-text"}
        `}
        style={{ paddingLeft: `${8 + depth * 16}px` }}
        onClick={() => !isRenaming && selectInstance(name, kind)}
        onContextMenu={(e) => handleContextMenu(e, name, kind, "instance")}
      >
        {kind === "Server" ? (
          <Server className="w-3.5 h-3.5 text-theme-mid flex-shrink-0" />
        ) : (
          <Monitor className="w-3.5 h-3.5 text-theme-mid flex-shrink-0" />
        )}
        {isRenaming ? (
          <input
            ref={renameInputRef}
            value={renameValue}
            onChange={(e) => setRenameValue(e.target.value)}
            onBlur={handleConfirmRename}
            onKeyDown={(e) => {
              if (e.key === "Enter") handleConfirmRename();
              if (e.key === "Escape") setRenameState(null);
            }}
            className="flex-1 bg-theme-dark border border-theme-mid text-theme-text text-sm rounded px-1.5 py-0 outline-none min-w-0"
            onClick={(e) => e.stopPropagation()}
          />
        ) : (
          <span className="text-sm truncate flex-1">{name}</span>
        )}
      </div>
    );
  };

  return (
    <>
      <div
        className="relative flex flex-col bg-theme-surface border-r border-theme-second-dark overflow-hidden flex-shrink-0"
        style={{ width: `${sidebarWidth * 100}%` }}
      >
        {/* Client Section */}
        <div className="flex-1 overflow-y-auto py-2 px-1.5">
          <div className="mb-1">
            <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5">
              <Monitor className="w-3.5 h-3.5 text-theme-text-muted" />
              <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-text-muted">
                Clients
              </span>
            </div>
            {clientNodes.map((n) => renderNode(n))}
          </div>

          {/* Folders mixed in */}
          {folderNodes.length > 0 && (
            <div className="mb-1">
              {folderNodes.map((n) => renderNode(n))}
            </div>
          )}

          {/* Server Section */}
          {serverNodes.length > 0 && (
            <div>
              <div className="flex items-center gap-1.5 px-2 py-1 mb-0.5 mt-2">
                <Server className="w-3.5 h-3.5 text-theme-text-muted" />
                <span className="text-[10px] font-semibold uppercase tracking-wider text-theme-text-muted">
                  Servers
                </span>
              </div>
              {serverNodes.map((n) => renderNode(n))}
            </div>
          )}
        </div>

        {/* Bottom Buttons */}
        <div className="border-t border-theme-second-dark p-1.5 flex gap-1">
          <button
            onClick={() => setScreen({ type: "create_instance" })}
            className="flex-1 flex items-center justify-center gap-1.5 px-2 py-1.5 text-xs text-theme-text-muted hover:text-theme-text hover:bg-theme-second-dark/40 rounded-md transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            New Instance
          </button>
          <button
            onClick={handleNewFolder}
            className="flex items-center justify-center px-2 py-1.5 text-theme-text-muted hover:text-theme-text hover:bg-theme-second-dark/40 rounded-md transition-colors"
            title="New Folder"
          >
            <FolderPlus className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Resize Handle */}
        <div
          ref={resizeRef}
          className="resize-handle"
          onMouseDown={handleResizeStart}
        />
      </div>

      {/* Context Menu */}
      {contextMenu && (
        <ContextMenu
          x={contextMenu.x}
          y={contextMenu.y}
          items={[
            {
              label: "Rename",
              icon: <Pencil className="w-4 h-4" />,
              onClick: () => {
                if (contextMenu.type === "instance") {
                  handleStartRename(contextMenu.name);
                }
              },
            },
            { separator: true },
            {
              label: "Delete",
              icon: <Trash2 className="w-4 h-4" />,
              danger: true,
              onClick: () => {
                if (contextMenu.type === "instance" && contextMenu.kind) {
                  setConfirmDelete({ name: contextMenu.name, kind: contextMenu.kind });
                }
              },
            },
          ]}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        open={confirmDelete !== null}
        title="Delete Instance"
        message={
          confirmDelete
            ? `Are you sure you want to delete "${confirmDelete.name}"? This cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteInstance}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}