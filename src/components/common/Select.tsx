import React, { useState, useRef, useEffect, useCallback } from "react";
import { ChevronDown, Check, X } from "lucide-react";

interface SelectOption {
  value: string;
  label: string;
  icon?: React.ReactNode;
}

interface SelectProps {
  options: SelectOption[];
  value?: string;
  onChange: (value: string) => void;
  placeholder?: string;
  searchable?: boolean;
  className?: string;
  disabled?: boolean;
}

export default function Select({
  options,
  value,
  onChange,
  placeholder = "Select...",
  searchable = false,
  className = "",
  disabled = false,
}: SelectProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [search, setSearch] = useState("");
  const containerRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const selectedOption = options.find((o) => o.value === value);

  const filteredOptions = searchable
    ? options.filter((o) =>
        o.label.toLowerCase().includes(search.toLowerCase())
      )
    : options;

  const handleClick = useCallback(
    (optionValue: string) => {
      onChange(optionValue);
      setIsOpen(false);
      setSearch("");
    },
    [onChange]
  );

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setIsOpen(false);
        setSearch("");
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  useEffect(() => {
    if (isOpen && searchable && searchInputRef.current) {
      searchInputRef.current.focus();
    }
  }, [isOpen, searchable]);

  return (
    <div ref={containerRef} className={`relative ${className}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setIsOpen(!isOpen)}
        className={`
          w-full flex items-center justify-between gap-2
          bg-theme-dark border border-theme-second-dark text-theme-text
          rounded-lg px-3 py-1.5 text-sm
          hover:border-theme-mid transition-colors duration-150
          disabled:opacity-40 disabled:cursor-not-allowed
          ${isOpen ? "border-theme-mid" : ""}
        `}
      >
        <div className="flex items-center gap-2 truncate">
          {selectedOption?.icon}
          <span className={selectedOption ? "" : "text-theme-text-muted"}>
            {selectedOption?.label || placeholder}
          </span>
        </div>
        {value && !disabled ? (
          <span
            className="text-theme-text-muted hover:text-theme-text p-0.5 rounded"
            onClick={(e) => {
              e.stopPropagation();
              onChange("");
            }}
          >
            <X className="w-3.5 h-3.5" />
          </span>
        ) : (
          <ChevronDown className={`w-4 h-4 text-theme-text-muted transition-transform ${isOpen ? "rotate-180" : ""}`} />
        )}
      </button>

      {isOpen && (
        <div className="absolute z-50 mt-1 w-full bg-theme-dark border border-theme-second-dark rounded-lg shadow-lg overflow-hidden animate-slide-down">
          {searchable && (
            <div className="p-1.5 border-b border-theme-second-dark">
              <input
                ref={searchInputRef}
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search..."
                className="w-full bg-theme-surface border border-theme-second-dark text-theme-text rounded-md px-2.5 py-1 text-sm outline-none focus:border-theme-mid"
              />
            </div>
          )}
          <div className="max-h-52 overflow-y-auto py-1">
            {filteredOptions.length === 0 ? (
              <div className="px-3 py-2 text-sm text-theme-text-muted">No results</div>
            ) : (
              filteredOptions.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => handleClick(option.value)}
                  className={`
                    w-full flex items-center gap-2 px-3 py-1.5 text-sm text-left
                    hover:bg-theme-second-dark transition-colors duration-100
                    ${option.value === value ? "text-theme-accent" : "text-theme-text"}
                  `}
                >
                  {option.icon}
                  <span className="truncate flex-1">{option.label}</span>
                  {option.value === value && <Check className="w-4 h-4 flex-shrink-0" />}
                </button>
              ))
            )}
          </div>
        </div>
      )}
    </div>
  );
}