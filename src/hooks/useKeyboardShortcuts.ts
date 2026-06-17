import { useEffect } from "react";
import { useAppStore } from "@/stores/appStore";

export function useKeyboardShortcuts() {
  const setScreen = useAppStore((s) => s.setScreen);
  const screen = useAppStore((s) => s.screen);
  const launchGame = useAppStore((s) => s.launchGame);
  const selectedInstance = useAppStore((s) => s.selectedInstance);

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
        // Can't actually quit from web, but can close window via Tauri
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
      }
    };

    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [screen, selectedInstance, launchGame, setScreen]);
}