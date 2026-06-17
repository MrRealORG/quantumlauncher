import React, { useEffect, useRef, useState } from "react";

interface ContextMenuItem {
  label: string;
  icon?: React.ReactNode;
  onClick: () => void;
  danger?: boolean;
  separator?: false;
}

interface ContextMenuSeparator {
  separator: true;
}

type ContextMenuEntry = ContextMenuItem | ContextMenuSeparator;

interface ContextMenuProps {
  x: number;
  y: number;
  items: ContextMenuEntry[];
  onClose: () => void;
}

export default function ContextMenu({ x, y, items, onClose }: ContextMenuProps) {
  const menuRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ x, y });

  useEffect(() => {
    const handleClick = (e: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handleClick);
    return () => document.removeEventListener("mousedown", handleClick);
  }, [onClose]);

  useEffect(() => {
    if (menuRef.current) {
      const rect = menuRef.current.getBoundingClientRect();
      const vw = window.innerWidth;
      const vh = window.innerHeight;
      let newX = x;
      let newY = y;
      if (x + rect.width > vw) newX = vw - rect.width - 8;
      if (y + rect.height > vh) newY = vh - rect.height - 8;
      if (newX < 0) newX = 8;
      if (newY < 0) newY = 8;
      setPosition({ x: newX, y: newY });
    }
  }, [x, y]);

  return (
    <div
      ref={menuRef}
      className="fixed z-50 bg-theme-surface border border-theme-second-dark rounded-lg shadow-xl py-1 min-w-[160px] animate-fade-in"
      style={{ left: position.x, top: position.y }}
    >
      {items.map((item, i) => {
        if ("separator" in item && item.separator) {
          return <div key={i} className="my-1 h-px bg-theme-second-dark" />;
        }
        const menuItem = item as ContextMenuItem;
        return (
          <button
            key={i}
            onClick={() => {
              menuItem.onClick();
              onClose();
            }}
            className={`
              w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left
              transition-colors duration-100
              ${
                menuItem.danger
                  ? "text-theme-error hover:bg-theme-error/10"
                  : "text-theme-text hover:bg-theme-second-dark"
              }
            `}
          >
            {menuItem.icon && <span className="w-4 h-4 flex-shrink-0">{menuItem.icon}</span>}
            <span>{menuItem.label}</span>
          </button>
        );
      })}
    </div>
  );
}