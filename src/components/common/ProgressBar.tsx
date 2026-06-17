interface ProgressBarProps {
  value?: number;
  indeterminate?: boolean;
  color?: "accent" | "success" | "error";
  message?: string;
  className?: string;
}

const colorMap = {
  accent: "bg-theme-mid",
  success: "bg-theme-success",
  error: "bg-theme-error",
};

export default function ProgressBar({
  value = 0,
  indeterminate = false,
  color = "accent",
  message,
  className = "",
}: ProgressBarProps) {
  const pct = Math.min(100, Math.max(0, value * 100));

  return (
    <div className={`w-full ${className}`}>
      {message && (
        <div className="text-xs text-theme-text-muted mb-1.5 truncate">{message}</div>
      )}
      <div className="w-full h-1.5 bg-theme-second-dark rounded-full overflow-hidden">
        {indeterminate ? (
          <div
            className={`h-full w-1/3 ${colorMap[color]} rounded-full`}
            style={{ animation: "progressBar 1.5s ease-in-out infinite" }}
          />
        ) : (
          <div
            className={`h-full ${colorMap[color]} rounded-full transition-all duration-300 ease-out`}
            style={{ width: `${pct}%` }}
          />
        )}
      </div>
    </div>
  );
}