import { useState, useCallback, useRef } from "react";
import { tauriCommands, TauriError } from "@/utils/tauri";

interface UseTauriCommandResult<T> {
  data: T | null;
  loading: boolean;
  error: string | null;
  execute: (...args: unknown[]) => Promise<T | null>;
  reset: () => void;
}

export function useTauriCommand<T>(
  commandFn: (args?: Record<string, unknown>) => Promise<T>,
  autoRetry: boolean = false
): UseTauriCommandResult<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const retryCount = useRef(0);

  const execute = useCallback(
    async (...args: unknown[]): Promise<T | null> => {
      setLoading(true);
      setError(null);
      retryCount.current = 0;

      const attempt = async (): Promise<T | null> => {
        try {
          const result = args.length > 0
            ? await commandFn(args[0] as Record<string, unknown>)
            : await commandFn();
          setData(result);
          setLoading(false);
          return result;
        } catch (err) {
          if (err instanceof TauriError) {
            if (autoRetry && retryCount.current < 2) {
              retryCount.current++;
              await new Promise((r) => setTimeout(r, 1000 * retryCount.current));
              return attempt();
            }
            setError(err.message);
          } else {
            setError(String(err));
          }
          setLoading(false);
          return null;
        }
      };

      return attempt();
    },
    [commandFn, autoRetry]
  );

  const reset = useCallback(() => {
    setData(null);
    setLoading(false);
    setError(null);
    retryCount.current = 0;
  }, []);

  return { data, loading, error, execute, reset };
}