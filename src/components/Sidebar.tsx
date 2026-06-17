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
  XCircle,
  FolderSymlink,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import ContextMenu from "@/components/common/ContextMenu";
import type { SidebarNode, SidebarFolder, InstanceKind } from "@/types";
import ConfirmModal from "@/components/modals/ConfirmModal";

const SIDEBAR_DEFAULT_WIDTH = 0.33;

/** Recursively remove a folder by id, promoting its children to the parent level */
function removeFolderById(list: SidebarNode[], folderId: string): SidebarNode[] {
  const result: SidebarNode[] = [];
  for (const node of list) {
    if (node.kind.type === "folder") {
      const f = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      if (f.id === folderId) {
        // Promote children to parent level
        result.push(...f.children);
        continue;
      }
      // Recurse into children
      const newChildren = removeFolderById(f.children, folderId);
      result.push({
        ...node,
        kind: { type: "folder", folder: { ...f, children: newChildren } },
      });
    } else {
      result.push(node);
    }
  }
  return result;
}

/** Recursively rename a folder by id */
function renameFolderById(list: SidebarNode[], folderId: string, newName: string): SidebarNode[] {
  return list.map((node) => {
    if (node.kind.type === "folder") {
      const f = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      return {
        ...node,
        name: f.id === folderId ? newName : node.name,
        kind: {
          type: "folder",
          folder: {
            ...f,
            children: renameFolderById(f.children, folderId, newName),
          },
        },
      };
    }
    return node;
  });
}

/** Find folder id by its display name (first match) */
function findFolderIdByName(list: SidebarNode[], name: string): string | null {
  for (const node of list) {
    if (node.kind.type === "folder" && node.name === name) {
      return (node.kind as { type: "folder"; folder: SidebarFolder }).folder.id;
    }
    if (node.kind.type === "folder") {
      const f = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      const found = findFolderIdByName(f.children, name);
      if (found) return found;
    }
  }
  return null;
}

export default function Sidebar() {
  const {
    clientInstances,
    serverInstances,
    selectedInstance,
    sidebarConfig,
    runningInstances,
    selectInstance,
    deleteInstance,
    renameInstance,
    killGame,
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
    type: "instance" | "folder" | "empty";
    name: string;
    kind?: InstanceKind;
    folderId?: string;
  } | null>(null);
  const [renameState, setRenameState] = useState<{ name: string; isFolder: boolean } | null>(null);
  const [renameValue, setRenameValue] = useState("");
  const [confirmDelete, setConfirmDelete] = useState<{
    name: string;
    kind: InstanceKind;
    isFolder?: boolean;
    folderId?: string;
  } | null>(null);
  const resizeRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Get all nodes (use sidebar config or fall back to flat lists)
  // The sidebar config stores the user-arranged tree order — instances and folders
  // are intermixed. When no config exists, build a flat list preserving
  // client/server ordering (matching the original iced behaviour).
  const nodes = useMemo(() => {
    if (sidebarConfig?.list && sidebarConfig.list.length > 0) {
      return sidebarConfig.list;
    }
    // Build flat list from instances (clients first, then servers)
    const list: SidebarNode[] = [];
    for (const name of clientInstances) {
      list.push({ name, kind: { type: "instance", kind: "Client" } });
    }
    for (const name of serverInstances) {
      list.push({ name, kind: { type: "instance", kind: "Server" } });
    }
    return list;
  }, [sidebarConfig, clientInstances, serverInstances]);

  const isSelected = useCallback(
    (name: string, kind: InstanceKind) =>
      selectedInstance?.name === name && selectedInstance?.kind === kind,
    [selectedInstance]
  );

  const handleContextMenu = useCallback(
    (
      e: React.MouseEvent,
      name: string,
      type: "instance" | "folder" | "empty",
      kind?: InstanceKind,
      folderId?: string
    ) => {
      e.preventDefault();
      e.stopPropagation();
      setContextMenu({ x: e.clientX, y: e.clientY, type, name, kind, folderId });
    },
    []
  );

  const handleStartRename = useCallback((name: string, isFolder = false) => {
    setRenameState({ name, isFolder });
    setRenameValue(name);
    setTimeout(() => renameInputRef.current?.focus(), 50);
  }, []);

  const handleConfirmRename = useCallback(async () => {
    if (!renameState || !renameValue.trim()) {
      setRenameState(null);
      return;
    }
    const newName = renameValue.trim();
    if (newName === renameState.name) {
      setRenameState(null);
      return;
    }

    if (renameState.isFolder && sidebarConfig) {
      // Rename folder in sidebar config
      const folderId = findFolderIdByName(sidebarConfig.list, renameState.name);
      if (folderId) {
        const updated = { list: renameFolderById(sidebarConfig.list, folderId, newName) };
        await saveSidebar(updated);
      }
    } else {
      // Rename instance
      const kind =
        clientInstances.includes(renameState.name)
          ? "Client"
          : serverInstances.includes(renameState.name)
            ? "Server"
            : "Client";
      try {
        await renameInstance(renameState.name, newName, kind);
      } catch {
        addToast("Failed to rename instance", "error");
      }
    }
    setRenameState(null);
  }, [renameState, renameValue, sidebarConfig, saveSidebar, clientInstances, serverInstances, renameInstance, addToast]);

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

  const handleNewFolder = useCallback(
    async (insertIndex?: number) => {
      if (!sidebarConfig) return;
      const newFolder: SidebarNode = {
        name: "New Folder",
        kind: {
          type: "folder",
          folder: { id: crypto.randomUUID(), children: [], is_expanded: true },
        },
      };
      const list = [...sidebarConfig.list];
      if (insertIndex !== undefined) {
        list.splice(insertIndex + 1, 0, newFolder);
      } else {
        list.push(newFolder);
      }
      const updated = { list };
      await saveSidebar(updated);
      handleStartRename("New Folder", true);
    },
    [sidebarConfig, saveSidebar, handleStartRename]
  );

  const handleDeleteInstance = useCallback(async () => {
    if (!confirmDelete) return;

    if (confirmDelete.isFolder && confirmDelete.folderId && sidebarConfig) {
      // Delete folder — children promoted to parent level
      const updated = { list: removeFolderById(sidebarConfig.list, confirmDelete.folderId) };
      await saveSidebar(updated);
      addToast(`Folder "${confirmDelete.name}" deleted`, "info");
    } else {
      try {
        await deleteInstance(confirmDelete.name, confirmDelete.kind);
      } catch {
        addToast("Failed to delete instance", "error");
      }
    }
    setConfirmDelete(null);
  }, [confirmDelete, sidebarConfig, saveSidebar, deleteInstance, addToast]);

  const handleEmptySpaceContextMenu = useCallback(
    (e: React.MouseEvent) => {
      handleContextMenu(e, "", "empty");
    },
    [handleContextMenu]
  );

  const handleOpenFolder = useCallback(async (name: string, kind: InstanceKind) => {
    try {
      const { open } = await import("@tauri-apps/plugin-shell");
      const { appDataDir } = await import("@tauri-apps/api/path");
      const dataDir = await appDataDir();
      const subDir = kind === "Client" ? "instances" : "servers";
      await open(`${dataDir}QuantumLauncher/${subDir}/${name}`);
    } catch {
      addToast("Failed to open folder", "error");
    }
  }, [addToast]);

  const renderNode = (node: SidebarNode, depth: number = 0) => {
    if (node.kind.type === "folder") {
      const folder = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      const isRenaming = renameState?.isFolder && renameState?.name === node.name;

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
            onContextMenu={(e) => handleContextMenu(e, node.name, "folder", undefined, folder.id)}
          >
            {folder.is_expanded ? (
              <ChevronDown className="w-3.5 h-3.5 text-theme-text-muted flex-shrink-0" />
            ) : (
              <ChevronRight className="w-3.5 h-3.5 text-theme-text-muted flex-shrink-0" />
            )}
            <FolderOpen className="w-3.5 h-3.5 text-theme-mid flex-shrink-0" />
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
              <span className="text-sm text-theme-text truncate flex-1">{node.name}</span>
            )}
          </div>
          {folder.is_expanded && folder.children.map((child) => renderNode(child, depth + 1))}
        </div>
      );
    }

    const kind = node.kind.kind;
    const name = node.name;
    const selected = isSelected(name, kind);
    const isRenaming = !renameState?.isFolder && renameState?.name === name;
    const isRunning = runningInstances.has(name);

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
        onContextMenu={(e) => handleContextMenu(e, name, "instance", kind)}
      >
        {kind === "Server" ? (
          <Server className="w-3.5 h-3.5 text-theme-mid flex-shrink-0" />
        ) : (
          <Monitor className="w-3.5 h-3.5 text-theme-mid flex-shrink-0" />
        )}
        {isRunning && (
          <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse flex-shrink-0" />
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

  // Build context menu items based on what was right-clicked
  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];
    const items: SidebarContextMenuEntry[] = [];

    if (contextMenu.type === "instance") {
      // Instance context menu
      if (runningInstances.has(contextMenu.name) && contextMenu.kind) {
        items.push({
          label: "Kill Process",
          icon: <XCircle className="w-4 h-4" />,
          onClick: () => {
            killGame(contextMenu.name);
          },
        });
        items.push({ separator: true });
      }
      items.push({
        label: "Open Folder",
        icon: <FolderSymlink className="w-4 h-4" />,
        onClick: () => {
          if (contextMenu.kind) handleOpenFolder(contextMenu.name, contextMenu.kind);
        },
      });
      items.push({
        label: "Rename",
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          handleStartRename(contextMenu.name, false);
        },
      });
      items.push({ separator: true });
      items.push({
        label: "Delete",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => {
          if (contextMenu.kind) {
            setConfirmDelete({ name: contextMenu.name, kind: contextMenu.kind });
          }
        },
      });
    } else if (contextMenu.type === "folder") {
      // Folder context menu
      items.push({
        label: "Rename",
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => {
          handleStartRename(contextMenu.name, true);
        },
      });
      items.push({ separator: true });
      items.push({
        label: "Delete Folder",
        icon: <Trash2 className="w-4 h-4" />,
        danger: true,
        onClick: () => {
          if (contextMenu.folderId) {
            setConfirmDelete({
              name: contextMenu.name,
              kind: "Client",
              isFolder: true,
              folderId: contextMenu.folderId,
            });
          }
        },
      });
    } else if (contextMenu.type === "empty") {
      // Empty space context menu
      items.push({
        label: "New Folder",
        icon: <FolderPlus className="w-4 h-4" />,
        onClick: () => {
          handleNewFolder();
        },
      });
    }

    return items;
  }, [contextMenu, runningInstances, killGame, handleStartRename, handleNewFolder, handleOpenFolder]);

  return (
    <>
      <div
        className="relative flex flex-col bg-theme-surface border-r border-theme-second-dark overflow-hidden flex-shrink-0"
        style={{ width: `${sidebarWidth * 100}%` }}
      >
        {/* Sidebar tree — renders nodes in configured order (flat tree) */}
        <div
          className="flex-1 overflow-y-auto py-2 px-1.5"
          onContextMenu={handleEmptySpaceContextMenu}
        >
          {nodes.map((n) => renderNode(n))}
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
            onClick={() => handleNewFolder()}
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
          items={contextMenuItems}
          onClose={() => setContextMenu(null)}
        />
      )}

      {/* Confirm Delete */}
      <ConfirmModal
        open={confirmDelete !== null}
        title={confirmDelete?.isFolder ? "Delete Folder" : "Delete Instance"}
        message={
          confirmDelete
            ? confirmDelete.isFolder
              ? `Are you sure you want to delete folder "${confirmDelete.name}"? Its instances will be moved out.`
              : `Are you sure you want to delete "${confirmDelete.name}"? This cannot be undone.`
            : ""
        }
        onConfirm={handleDeleteInstance}
        onCancel={() => setConfirmDelete(null)}
      />
    </>
  );
}

// Context menu item types (matching ContextMenu component)
interface SidebarContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: false;
}

interface SidebarContextMenuSeparator {
  separator: true;
}

type SidebarContextMenuEntry = SidebarContextMenuItem | SidebarContextMenuSeparator;