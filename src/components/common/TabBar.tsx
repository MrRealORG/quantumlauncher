import React from "react";

interface Tab {
  id: string;
  label: string;
  icon?: React.ReactNode;
}

interface TabBarProps {
  tabs: Tab[];
  activeTab: string;
  onTabChange: (tabId: string) => void;
  className?: string;
}

export default function TabBar({ tabs, activeTab, onTabChange, className = "" }: TabBarProps) {
  return (
    <div className={`flex items-center gap-1 ${className}`}>
      {tabs.map((tab) => {
        const isActive = tab.id === activeTab;
        return (
          <button
            key={tab.id}
            onClick={() => onTabChange(tab.id)}
            className={`
              relative flex items-center gap-1.5 px-3 py-1.5 text-sm rounded-md
              transition-all duration-150
              ${
                isActive
                  ? "text-theme-accent"
                  : "text-theme-text-muted hover:text-theme-text hover:bg-theme-second-dark/50"
              }
            `}
          >
            {tab.icon && <span className="flex-shrink-0">{tab.icon}</span>}
            <span>{tab.label}</span>
            {isActive && (
              <div className="absolute bottom-0 left-2 right-2 h-0.5 bg-theme-accent rounded-full" />
            )}
          </button>
        );
      })}
    </div>
  );
}