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
  GripVertical,
} from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import ContextMenu from "@/components/common/ContextMenu";
import type { SidebarNode, SidebarFolder, InstanceKind } from "@/types";
import ConfirmModal from "@/components/modals/ConfirmModal";

const SIDEBAR_DEFAULT_WIDTH = 0.33;

// ===== Drag-and-Drop Types =====

type DropPosition = "before" | "after" | "inside";

interface DragState {
  /** Identity of the dragged node (for top-level: "instance:Name:Kind" or "folder:id") */
  sourceId: string;
  /** Current drop target */
  targetId: string | null;
  /** Where relative to the target */
  dropPos: DropPosition | null;
}

/** Build a stable identity string for a sidebar node */
function nodeId(node: SidebarNode): string {
  if (node.kind.type === "folder") {
    return `folder:${(node.kind as { type: "folder"; folder: SidebarFolder }).folder.id}`;
  }
  return `instance:${node.name}:${node.kind.kind}`;
}

/** Extract the node-id from a dataTransfer payload */
function parseDragId(raw: string): { type: "instance" | "folder"; name?: string; kind?: InstanceKind; folderId?: string } | null {
  if (raw.startsWith("folder:")) return { type: "folder", folderId: raw.slice(7) };
  const m = raw.match(/^instance:(.+?):(Client|Server)$/);
  if (m) return { type: "instance", name: m[1], kind: m[2] as InstanceKind };
  return null;
}

// ===== Tree Helpers =====

/** Recursively remove a folder by id, promoting its children to the parent level */
function removeFolderById(list: SidebarNode[], folderId: string): SidebarNode[] {
  const result: SidebarNode[] = [];
  for (const node of list) {
    if (node.kind.type === "folder") {
      const f = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      if (f.id === folderId) {
        result.push(...f.children);
        continue;
      }
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

/** Check if `targetId` is the same as `sourceId` or a descendant of it (prevents dropping a folder into itself) */
function isDescendantOf(sourceId: string, targetId: string, list: SidebarNode[]): boolean {
  if (sourceId === targetId) return true;
  for (const node of list) {
    const nid = nodeId(node);
    if (nid !== sourceId) continue;
    if (node.kind.type === "folder") {
      const f = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      return containsId(targetId, f.children);
    }
    return false;
  }
  return false;
}

function containsId(targetId: string, children: SidebarNode[]): boolean {
  for (const child of children) {
    if (nodeId(child) === targetId) return true;
    if (child.kind.type === "folder") {
      const f = (child.kind as { type: "folder"; folder: SidebarFolder }).folder;
      if (containsId(targetId, f.children)) return true;
    }
  }
  return false;
}

/** Remove a node by id from a flat list (top-level only) */
function removeNodeById(list: SidebarNode[], id: string): { list: SidebarNode[]; removed: SidebarNode | null } {
  const idx = list.findIndex((n) => nodeId(n) === id);
  if (idx >= 0) {
    const removed = list[idx];
    return { list: [...list.slice(0, idx), ...list.slice(idx + 1)], removed };
  }
  // Search inside folders
  for (let i = 0; i < list.length; i++) {
    const node = list[i];
    if (node.kind.type === "folder") {
      const f = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      const result = removeNodeById(f.children, id);
      if (result.removed) {
        const newList = [...list];
        newList[i] = {
          ...node,
          kind: { type: "folder", folder: { ...f, children: result.list } },
        };
        return { list: newList, removed: result.removed };
      }
    }
  }
  return { list, removed: null };
}

/** Insert a node at a given position relative to a target */
function insertNodeAt(
  list: SidebarNode[],
  targetId: string,
  pos: DropPosition,
  node: SidebarNode,
): SidebarNode[] {
  // Try top-level
  const idx = list.findIndex((n) => nodeId(n) === targetId);
  if (idx >= 0) {
    if (pos === "inside") {
      const target = list[idx];
      if (target.kind.type === "folder") {
        const f = (target.kind as { type: "folder"; folder: SidebarFolder }).folder;
        const newList = [...list];
        newList[idx] = {
          ...target,
          kind: { type: "folder", folder: { ...f, children: [...f.children, node], is_expanded: true } },
        };
        return newList;
      }
      // Can't insert "inside" a non-folder, fall through to "after"
      const newList = [...list];
      newList.splice(idx + 1, 0, node);
      return newList;
    }
    const insertIdx = pos === "before" ? idx : idx + 1;
    const newList = [...list];
    newList.splice(insertIdx, 0, node);
    return newList;
  }
  // Search inside folders
  for (let i = 0; i < list.length; i++) {
    const item = list[i];
    if (item.kind.type === "folder") {
      const f = (item.kind as { type: "folder"; folder: SidebarFolder }).folder;
      if (f.children.some((c) => nodeId(c) === targetId)) {
        const newChildren = insertNodeAt(f.children, targetId, pos, node);
        const newList = [...list];
        newList[i] = {
          ...item,
          kind: { type: "folder", folder: { ...f, children: newChildren } },
        };
        return newList;
      }
    }
  }
  // Target not found, append to end
  return [...list, node];
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

  // Drag-and-drop state
  const [dragState, setDragState] = useState<DragState | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);
  const listContainerRef = useRef<HTMLDivElement>(null);

  // Get all nodes (use sidebar config or fall back to flat lists)
  const nodes = useMemo(() => {
    if (sidebarConfig?.list && sidebarConfig.list.length > 0) {
      return sidebarConfig.list;
    }
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

  // ===== Drag handlers =====

  const handleDragStart = useCallback(
    (e: React.DragEvent, node: SidebarNode) => {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/x-sidebar-node", nodeId(node));
      // Use a tiny transparent image as drag ghost
      const img = new Image();
      img.src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
      e.dataTransfer.setDragImage(img, 0, 0);
      setDragState({ sourceId: nodeId(node), targetId: null, dropPos: null });
    },
    []
  );

  const handleDragEnd = useCallback(() => {
    setDragState(null);
    setDragOverId(null);
  }, []);

  const handleDragOver = useCallback(
    (e: React.DragEvent, targetNode: SidebarNode) => {
      if (!dragState) return;
      e.preventDefault();
      e.dataTransfer.dropEffect = "move";

      const tid = nodeId(targetNode);
      if (tid === dragState.sourceId) {
        // Hovering over self — no indicator
        setDragState((prev) => prev ? { ...prev, targetId: null, dropPos: null } : null);
        setDragOverId(null);
        return;
      }

      // Determine position based on cursor Y relative to element center
      const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
      const y = e.clientY - rect.top;
      const h = rect.height;
      const isFolder = targetNode.kind.type === "folder";

      let pos: DropPosition;
      if (isFolder && y > h * 0.3 && y < h * 0.7) {
        pos = "inside";
      } else if (y < h / 2) {
        pos = "before";
      } else {
        pos = "after";
      }

      // Guard: can't drop into self or descendant
      if (pos === "inside" && isDescendantOf(dragState.sourceId, tid, nodes)) {
        setDragState((prev) => prev ? { ...prev, targetId: null, dropPos: null } : null);
        setDragOverId(null);
        return;
      }

      setDragOverId(tid);
      setDragState((prev) => prev ? { ...prev, targetId: tid, dropPos: pos } : null);
    },
    [dragState, nodes]
  );

  const handleDragLeave = useCallback(
    (e: React.DragEvent) => {
      // Only clear if leaving the element (not entering a child)
      const related = e.relatedTarget as HTMLElement | null;
      if (related && (e.currentTarget as HTMLElement).contains(related)) return;
      setDragState((prev) => prev ? { ...prev, targetId: null, dropPos: null } : null);
      setDragOverId(null);
    },
    []
  );

  const handleDropOnItem = useCallback(
    (e: React.DragEvent, targetNode: SidebarNode) => {
      e.preventDefault();
      if (!dragState || !dragState.dropPos || !sidebarConfig) return;
      applyDrop(dragState.sourceId, nodeId(targetNode), dragState.dropPos);
    },
    [dragState, sidebarConfig]
  );

  const handleDropOnEmpty = useCallback(
    (e: React.DragEvent) => {
      e.preventDefault();
      if (!dragState || !sidebarConfig) return;
      // Dropped on empty space — append to end
      const { list, removed } = removeNodeById(sidebarConfig.list, dragState.sourceId);
      if (removed) {
        saveSidebar({ list: [...list, removed] });
      }
    },
    [dragState, sidebarConfig, saveSidebar]
  );

  const applyDrop = useCallback(
    (sourceId: string, targetId: string, pos: DropPosition) => {
      if (!sidebarConfig) return;
      // Remove source from list
      const { list: withoutSource, removed } = removeNodeById(sidebarConfig.list, sourceId);
      if (!removed) return;
      // Insert at new position
      const newList = insertNodeAt(withoutSource, targetId, pos, removed);
      saveSidebar({ list: newList });
      setDragState(null);
      setDragOverId(null);
    },
    [sidebarConfig, saveSidebar]
  );

  // ===== Context menu / rename / etc. =====

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
      const folderId = findFolderIdByName(sidebarConfig.list, renameState.name);
      if (folderId) {
        const updated = { list: renameFolderById(sidebarConfig.list, folderId, newName) };
        await saveSidebar(updated);
      }
    } else {
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

  /** Render a drop indicator line */
  const renderDropIndicator = (nid: string, pos: DropPosition, depth: number) => {
    if (dragState?.targetId !== nid || dragState?.dropPos !== pos) return null;
    const isInside = pos === "inside";
    return (
      <div
        className="pointer-events-none z-10"
        style={{
          paddingLeft: `${isInside ? 8 + (depth + 1) * 16 : 8}px`,
          paddingRight: "8px",
        }}
      >
        <div
          className={`rounded-full transition-all duration-100 ${
            isInside
              ? "h-[3px] bg-theme-accent my-0.5"
              : "h-[2px] bg-theme-accent my-0"
          }`}
        />
      </div>
    );
  };

  const renderNode = (node: SidebarNode, depth: number = 0) => {
    const nid = nodeId(node);

    if (node.kind.type === "folder") {
      const folder = (node.kind as { type: "folder"; folder: SidebarFolder }).folder;
      const isRenaming = renameState?.isFolder && renameState?.name === node.name;
      const isDragTarget = dragOverId === nid;

      return (
        <div key={`folder-${folder.id}`}>
          {/* Before indicator */}
          {renderDropIndicator(nid, "before", depth)}

          <div
            className={`
              flex items-center gap-1 px-2 py-1 rounded-md cursor-pointer
              transition-colors group relative
              ${isDragTarget && dragState?.dropPos === "inside" ? "bg-theme-accent/10 ring-1 ring-theme-accent/30" : "hover:bg-theme-second-dark/40"}
              text-theme-text
            `}
            style={{ paddingLeft: `${8 + depth * 16}px` }}
            draggable={!isRenaming}
            onDragStart={(e) => handleDragStart(e, node)}
            onDragEnd={handleDragEnd}
            onDragOver={(e) => handleDragOver(e, node)}
            onDragLeave={handleDragLeave}
            onDrop={(e) => handleDropOnItem(e, node)}
            onClick={() => {
              if (dragState) return;
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
            {/* Drag handle */}
            <GripVertical className="w-3 h-3 text-theme-text-muted/0 group-hover:text-theme-text-muted/50 flex-shrink-0 cursor-grab active:cursor-grabbing transition-colors" />
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

          {/* Inside indicator (for folders) */}
          {renderDropIndicator(nid, "inside", depth)}

          {folder.is_expanded && folder.children.map((child) => renderNode(child, depth + 1))}

          {/* After indicator */}
          {renderDropIndicator(nid, "after", depth)}
        </div>
      );
    }

    // Instance node
    const kind = node.kind.kind;
    const name = node.name;
    const selected = isSelected(name, kind);
    const isRenaming = !renameState?.isFolder && renameState?.name === name;
    const isRunning = runningInstances.has(name);
    const isDragTarget = dragOverId === nid;

    return (
      <div key={`${kind}-${name}`}>
        {/* Before indicator */}
        {renderDropIndicator(nid, "before", depth)}

        <div
          className={`
            flex items-center gap-2 px-2 py-1 rounded-md cursor-pointer
            transition-colors group relative
            ${selected ? "bg-theme-mid/20 text-theme-accent" : isDragTarget ? "bg-theme-accent/10 ring-1 ring-theme-accent/30" : "hover:bg-theme-second-dark/40 text-theme-text"}
          `}
          style={{ paddingLeft: `${8 + depth * 16}px` }}
          draggable={!isRenaming}
          onDragStart={(e) => handleDragStart(e, node)}
          onDragEnd={handleDragEnd}
          onDragOver={(e) => handleDragOver(e, node)}
          onDragLeave={handleDragLeave}
          onDrop={(e) => handleDropOnItem(e, node)}
          onClick={() => {
            if (dragState) return;
            if (!isRenaming) selectInstance(name, kind);
          }}
          onContextMenu={(e) => handleContextMenu(e, name, "instance", kind)}
        >
          {/* Drag handle */}
          <GripVertical className="w-3 h-3 text-theme-text-muted/0 group-hover:text-theme-text-muted/50 flex-shrink-0 cursor-grab active:cursor-grabbing transition-colors" />
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

        {/* After indicator */}
        {renderDropIndicator(nid, "after", depth)}
      </div>
    );
  };

  // Build context menu items
  const contextMenuItems = useMemo(() => {
    if (!contextMenu) return [];
    const items: SidebarContextMenuEntry[] = [];

    if (contextMenu.type === "instance") {
      if (runningInstances.has(contextMenu.name) && contextMenu.kind) {
        items.push({
          label: "Kill Process",
          icon: <XCircle className="w-4 h-4" />,
          onClick: () => killGame(contextMenu.name),
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
        onClick: () => handleStartRename(contextMenu.name, false),
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
      items.push({
        label: "Rename",
        icon: <Pencil className="w-4 h-4" />,
        onClick: () => handleStartRename(contextMenu.name, true),
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
      items.push({
        label: "New Folder",
        icon: <FolderPlus className="w-4 h-4" />,
        onClick: () => handleNewFolder(),
      });
    }

    return items;
  }, [contextMenu, runningInstances, killGame, handleStartRename, handleNewFolder, handleOpenFolder]);

  return (
    <>
      <div
        className="relative flex flex-col bg-theme-surface border-r border-theme-second-dark overflow-hidden flex-shrink-0 select-none"
        style={{ width: `${sidebarWidth * 100}%` }}
      >
        {/* Sidebar tree */}
        <div
          ref={listContainerRef}
          className={`flex-1 overflow-y-auto py-2 px-1.5 ${dragState ? "cursor-grabbing" : ""}`}
          onContextMenu={handleEmptySpaceContextMenu}
          onDragOver={(e) => {
            if (!dragState) return;
            // Only trigger if dragging over empty space (not a node)
            e.preventDefault();
            e.dataTransfer.dropEffect = "move";
          }}
          onDrop={handleDropOnEmpty}
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

// Context menu item types
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