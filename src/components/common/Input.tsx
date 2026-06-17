import React, { forwardRef } from "react";

type InputVariant = "default" | "search";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  variant?: InputVariant;
  leftIcon?: React.ReactNode;
  rightIcon?: React.ReactNode;
  error?: boolean;
}

const baseClasses =
  "w-full bg-theme-dark border border-theme-second-dark text-theme-text rounded-lg px-3 py-1.5 text-sm transition-all duration-150 placeholder:text-theme-text-muted/60";

const variantClasses: Record<InputVariant, string> = {
  default: baseClasses,
  search: `${baseClasses} pl-9`,
};

export default forwardRef<HTMLInputElement, InputProps>(function Input(
  { variant = "default", leftIcon, rightIcon, error, className = "", ...props },
  ref
) {
  return (
    <div className="relative">
      {leftIcon && (
        <div className="absolute left-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted pointer-events-none">
          {leftIcon}
        </div>
      )}
      <input
        ref={ref}
        className={`
          ${variantClasses[variant]}
          ${error ? "border-theme-error focus:border-theme-error" : "focus:border-theme-mid"}
          ${className}
        `}
        {...props}
      />
      {rightIcon && (
        <div className="absolute right-2.5 top-1/2 -translate-y-1/2 text-theme-text-muted">
          {rightIcon}
        </div>
      )}
    </div>
  );
});