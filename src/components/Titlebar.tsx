import { useState, useCallback } from "react";
import { Minus, Square, X, Maximize2 } from "lucide-react";
import { getCurrentWindow } from "@tauri-apps/api/window";

export default function Titlebar() {
  const [isMaximized, setIsMaximized] = useState(false);
  const appWindow = getCurrentWindow();

  const handleMinimize = useCallback(async () => {
    await appWindow.minimize();
  }, [appWindow]);

  const handleMaximize = useCallback(async () => {
    await appWindow.toggleMaximize();
    setIsMaximized(!isMaximized);
  }, [appWindow, isMaximized]);

  const handleClose = useCallback(async () => {
    await appWindow.close();
  }, [appWindow]);

  return (
    <div
      data-tauri-drag-region
      className="flex items-center justify-between h-[38px] px-2 bg-theme-surface border-b border-theme-second-dark flex-shrink-0 select-none"
    >
      <div data-tauri-drag-region className="flex items-center gap-2 flex-1 min-w-0 pl-2">
        <span
          data-tauri-drag-region
          className="text-xs font-semibold text-theme-text-muted tracking-wide"
        >
          PK Launcher
        </span>
      </div>

      <div className="flex items-center gap-0.5">
        <button
          onClick={handleMinimize}
          className="w-11 h-8 flex items-center justify-center rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-second-dark/60 transition-colors"
          title="Minimize"
        >
          <Minus className="w-4 h-4" />
        </button>
        <button
          onClick={handleMaximize}
          className="w-11 h-8 flex items-center justify-center rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-second-dark/60 transition-colors"
          title="Maximize"
        >
          {isMaximized ? (
            <Square className="w-3.5 h-3.5" />
          ) : (
            <Maximize2 className="w-3.5 h-3.5" />
          )}
        </button>
        <button
          onClick={handleClose}
          className="w-11 h-8 flex items-center justify-center rounded-md text-theme-text-muted hover:text-white hover:bg-theme-error transition-colors"
          title="Close"
        >
          <X className="w-4 h-4" />
        </button>
      </div>
    </div>
  );
}