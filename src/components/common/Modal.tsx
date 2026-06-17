import React, { useEffect, useCallback } from "react";
import { X } from "lucide-react";

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  className?: string;
  wide?: boolean;
  dragHandle?: boolean;
}

export default function Modal({
  open,
  onClose,
  title,
  children,
  className = "",
  wide = false,
  dragHandle = true,
}: ModalProps) {
  const handleEscape = useCallback(
    (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        onClose();
      }
    },
    [onClose]
  );

  useEffect(() => {
    if (open) {
      document.addEventListener("keydown", handleEscape);
      return () => document.removeEventListener("keydown", handleEscape);
    }
  }, [open, handleEscape]);

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center animate-fade-in">
      {/* Overlay */}
      <div
        className="absolute inset-0 bg-black/50 backdrop-blur-sm"
        onClick={onClose}
      />

      {/* Content */}
      <div
        className={`
          relative z-10 bg-theme-surface border border-theme-second-dark rounded-xl
          shadow-2xl overflow-hidden animate-slide-up
          ${wide ? "w-[700px] max-h-[85vh]" : "w-[460px] max-h-[80vh]"}
          ${className}
        `}
      >
        {/* Header */}
        {title && (
          <div
            className={`flex items-center justify-between px-4 py-3 border-b border-theme-second-dark ${
              dragHandle ? "data-tauri-drag-region cursor-default" : ""
            }`}
          >
            <h2 className="text-sm font-semibold text-theme-text data-tauri-drag-region">
              {title}
            </h2>
            <button
              onClick={onClose}
              className="p-1 rounded-md text-theme-text-muted hover:text-theme-text hover:bg-theme-second-dark transition-colors"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        )}

        {/* Body */}
        <div className="overflow-y-auto max-h-[calc(80vh-52px)]">
          {children}
        </div>
      </div>
    </div>
  );
}