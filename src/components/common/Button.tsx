import React from "react";
import { Loader2 } from "lucide-react";

type ButtonVariant = "primary" | "secondary" | "danger" | "ghost" | "icon";
type ButtonSize = "sm" | "md" | "lg";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  icon?: React.ReactNode;
  children?: React.ReactNode;
}

const variantClasses: Record<ButtonVariant, string> = {
  primary:
    "bg-theme-mid text-theme-extra-dark hover:brightness-110 active:brightness-90 font-medium",
  secondary:
    "bg-theme-second-dark text-theme-light hover:bg-theme-mid hover:text-theme-extra-dark active:brightness-90",
  danger:
    "bg-theme-error/80 text-white hover:bg-theme-error active:brightness-90",
  ghost:
    "bg-transparent text-theme-text hover:bg-theme-second-dark active:bg-theme-mid/50",
  icon:
    "bg-transparent text-theme-text-muted hover:bg-theme-second-dark hover:text-theme-light active:bg-theme-mid/50",
};

const sizeClasses: Record<ButtonSize, string> = {
  sm: "px-2.5 py-1 text-xs rounded-md gap-1.5",
  md: "px-3.5 py-1.5 text-sm rounded-lg gap-2",
  lg: "px-5 py-2.5 text-base rounded-lg gap-2.5",
};

export default function Button({
  variant = "primary",
  size = "md",
  loading = false,
  icon,
  children,
  className = "",
  disabled,
  ...props
}: ButtonProps) {
  return (
    <button
      className={`
        inline-flex items-center justify-center transition-all duration-150 ease-in-out
        cursor-pointer select-none whitespace-nowrap
        disabled:opacity-40 disabled:cursor-not-allowed disabled:pointer-events-none
        ${variantClasses[variant]}
        ${sizeClasses[size]}
        ${className}
      `}
      disabled={disabled || loading}
      {...props}
    >
      {loading ? (
        <Loader2 className="w-4 h-4 animate-spin" />
      ) : icon ? (
        <span className="flex-shrink-0">{icon}</span>
      ) : null}
      {children && <span>{children}</span>}
    </button>
  );
}