import { useEffect, useCallback, useRef } from "react";
import { useAppStore } from "@/stores/appStore";

export function useKeyboardShortcuts() {
  const setScreen = useAppStore((s) => s.setScreen);
  const screen = useAppStore((s) => s.screen);
  const launchGame = useAppStore((s) => s.launchGame);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const selectInstance = useAppStore((s) => s.selectInstance);
  const killGame = useAppStore((s) => s.killGame);
  const runningInstances = useAppStore((s) => s.runningInstances);
  const clientInstances = useAppStore((s) => s.clientInstances);
  const serverInstances = useAppStore((s) => s.serverInstances);

  // Keep a ref to the flat instance list so the effect doesn't re-attach
  // on every instance list change, but the handler always reads the latest
  const instanceListRef = useRef<{ name: string; kind: "Client" | "Server" }[]>([]);

  const updateListRef = useCallback(() => {
    const list: { name: string; kind: "Client" | "Server" }[] = [];
    for (const name of clientInstances) list.push({ name, kind: "Client" });
    for (const name of serverInstances) list.push({ name, kind: "Server" });
    instanceListRef.current = list;
  }, [clientInstances, serverInstances]);

  useEffect(() => {
    updateListRef();
  }, [updateListRef]);

  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      // Don't capture when typing in inputs
      const tag = (e.target as HTMLElement).tagName;
      if (tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT") {
        // Still handle Escape in inputs
        if (e.key === "Escape") {
          (e.target as HTMLElement).blur();
          return;
        }
        return;
      }

      // Ctrl+Q or Ctrl+W: Quit
      if ((e.ctrlKey || e.metaKey) && (e.key === "q" || e.key === "w")) {
        e.preventDefault();
        import("@tauri-apps/api/window").then(({ getCurrentWindow }) => {
          getCurrentWindow().close();
        });
        return;
      }

      // Ctrl+Enter: Launch game
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        launchGame();
        return;
      }

      // Ctrl+N: New instance
      if ((e.ctrlKey || e.metaKey) && e.key === "n") {
        e.preventDefault();
        setScreen({ type: "create_instance" });
        return;
      }

      // Ctrl+,: Settings
      if ((e.ctrlKey || e.metaKey) && e.key === ",") {
        e.preventDefault();
        setScreen({ type: "settings" });
        return;
      }

      // Ctrl+Backspace: Kill running instance
      if (
        (e.ctrlKey || e.metaKey) &&
        e.key === "Backspace" &&
        selectedInstance &&
        runningInstances.has(selectedInstance.name)
      ) {
        e.preventDefault();
        killGame(selectedInstance.name);
        return;
      }

      // Escape: Go back / close modal
      if (e.key === "Escape") {
        if (screen.type !== "main") {
          setScreen({ type: "main" });
        }
        return;
      }

      // Ctrl+1/2/3: Switch tabs (when on main screen)
      if (screen.type === "main") {
        if ((e.ctrlKey || e.metaKey) && e.key === "1") {
          e.preventDefault();
          useAppStore.setState({ activeTab: "play" });
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "2") {
          e.preventDefault();
          useAppStore.setState({ activeTab: "logs" });
          return;
        }
        if ((e.ctrlKey || e.metaKey) && e.key === "3") {
          e.preventDefault();
          useAppStore.setState({ activeTab: "edit" });
          return;
        }

        // Arrow Up/Down: Navigate instances in sidebar
        if (e.key === "ArrowDown" || e.key === "ArrowUp") {
          const list = instanceListRef.current;
          if (list.length === 0) return;

          const currentIdx = selectedInstance
            ? list.findIndex(
                (i) => i.name === selectedInstance.name && i.kind === selectedInstance.kind
              )
            : -1;

          let nextIdx: number;
          if (e.key === "ArrowDown") {
            nextIdx = currentIdx < list.length - 1 ? currentIdx + 1 : 0;
          } else {
            nextIdx = currentIdx > 0 ? currentIdx - 1 : list.length - 1;
          }

          const next = list[nextIdx];
          selectInstance(next.name, next.kind);
          e.preventDefault();
          return;
        }
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, selectedInstance, launchGame, setScreen, selectInstance, killGame, runningInstances]);
}