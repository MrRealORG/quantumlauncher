import { useEffect, useState, useCallback } from "react";
import { Check, X, AlertTriangle, Info, AlertCircle } from "lucide-react";
import { useAppStore } from "@/stores/appStore";

type ToastType = "success" | "error" | "warning" | "info";

const icons: Record<ToastType, React.ReactNode> = {
  success: <Check className="w-4 h-4" />,
  error: <AlertCircle className="w-4 h-4" />,
  warning: <AlertTriangle className="w-4 h-4" />,
  info: <Info className="w-4 h-4" />,
};

const bgColors: Record<ToastType, string> = {
  success: "bg-theme-success/20 border-theme-success/40 text-theme-success",
  error: "bg-theme-error/20 border-theme-error/40 text-theme-error",
  warning: "bg-theme-warning/20 border-theme-warning/40 text-theme-warning",
  info: "bg-theme-mid/20 border-theme-mid/40 text-theme-mid",
};

const DURATION = 4000;
const EXIT_ANIM_MS = 200;

function ToastItem({
  id,
  message,
  type,
}: {
  id: string;
  message: string;
  type: ToastType;
}) {
  const [progress, setProgress] = useState(100);
  const [exiting, setExiting] = useState(false);
  const removeToast = useAppStore((s) => s.removeToast);

  const dismiss = useCallback(() => {
    if (exiting) return;
    setExiting(true);
    setTimeout(() => removeToast(id), EXIT_ANIM_MS);
  }, [id, exiting, removeToast]);

  useEffect(() => {
    const startTime = Date.now();
    const interval = setInterval(() => {
      const elapsed = Date.now() - startTime;
      setProgress(Math.max(0, 100 - (elapsed / DURATION) * 100));
      if (elapsed >= DURATION) {
        clearInterval(interval);
        // Trigger exit animation, then remove
        setExiting(true);
        setTimeout(() => removeToast(id), EXIT_ANIM_MS);
      }
    }, 50);
    return () => clearInterval(interval);
  }, [id, removeToast]);

  return (
    <div
      className={`
        relative flex items-start gap-2.5 px-3 py-2.5 rounded-lg border
        shadow-lg backdrop-blur-sm
        transition-all duration-200
        ${exiting
          ? "opacity-0 translate-x-4 scale-95"
          : "opacity-100 translate-x-0 scale-100 animate-slide-up"
        }
        ${bgColors[type]}
      `}
    >
      <span className="mt-0.5 flex-shrink-0">{icons[type]}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm leading-snug">{message}</p>
      </div>
      <button
        onClick={dismiss}
        className="flex-shrink-0 p-0.5 rounded opacity-60 hover:opacity-100 transition-opacity"
      >
        <X className="w-3.5 h-3.5" />
      </button>
      <div className="absolute bottom-0 left-2 right-2 h-0.5 rounded-b-lg overflow-hidden">
        <div
          className="h-full bg-current opacity-30 transition-all duration-100"
          style={{ width: `${progress}%` }}
        />
      </div>
    </div>
  );
}

export default function Toast() {
  const toasts = useAppStore((s) => s.toasts);

  if (toasts.length === 0) return null;

  return (
    <div className="fixed bottom-4 right-4 z-[100] flex flex-col-reverse gap-2 max-w-sm">
      {toasts.map((toast) => (
        <ToastItem key={toast.id} id={toast.id} message={toast.message} type={toast.type} />
      ))}
    </div>
  );
}