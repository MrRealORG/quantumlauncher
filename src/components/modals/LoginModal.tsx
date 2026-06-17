import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ExternalLink, Copy } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { tauriCommands } from "@/utils/tauri";
import type { AccountType, AccountData } from "@/types";

type LoginMethod = "microsoft" | "elyby" | "littleskin" | "offline";

const METHODS: { id: LoginMethod; label: string }[] = [
  { id: "microsoft", label: "Microsoft" },
  { id: "elyby", label: "Ely By" },
  { id: "littleskin", label: "LittleSkin" },
  { id: "offline", label: "Offline" },
];

export default function LoginModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const addToast = useAppStore((s) => s.addToast);

  const [method, setMethod] = useState<LoginMethod>("microsoft");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [msData, setMsData] = useState<{ user_code: string; verification_uri: string } | null>(null);
  const [loading, setLoading] = useState(false);
  const [polling, setPolling] = useState(false);
  const pollRef = useRef<ReturnType<typeof setInterval>>();

  const open = screen.type === "login";
  const handleClose = useCallback(() => {
    setPolling(false);
    if (pollRef.current) clearInterval(pollRef.current);
    setScreen({ type: "main" });
  }, [setScreen]);

  // Cleanup polling on unmount
  useEffect(() => {
    return () => {
      if (pollRef.current) clearInterval(pollRef.current);
    };
  }, []);

  const handleMicrosoftLogin = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tauriCommands.login_microsoft();
      setMsData(data);
      setPolling(true);

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const account = await tauriCommands.poll_microsoft_login(data.user_code);
          if (account) {
            clearInterval(pollRef.current);
            setPolling(false);
            setLoading(false);
            addToast(`Logged in as ${account.nice_username}`, "success");
            handleClose();
          }
        } catch {
          // Continue polling
        }
      }, 3000);
    } catch (e) {
      addToast("Failed to start Microsoft login", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, handleClose]);

  const handleYggdrasilLogin = useCallback(async () => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const authType = method === "elyby" ? "ElyBy" : "LittleSkin";
      const authUrl = method === "littleskin" ? "https://littleskin.cn/api/yggdrasil" : undefined;
      const account = await tauriCommands.login_yggdrasil(
        username.trim(),
        password,
        authType,
        authUrl
      );
      addToast(`Logged in as ${account.nice_username}`, "success");
      handleClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Login failed", "error");
    } finally {
      setLoading(false);
    }
  }, [method, username, password, addToast, handleClose]);

  const handleOffline = useCallback(() => {
    if (!username.trim()) return;
    addToast(`Using offline username: ${username.trim()}`, "info");
    handleClose();
  }, [username, addToast, handleClose]);

  return (
    <Modal open={open} onClose={handleClose} title="Add Account">
      <div className="p-4 space-y-4">
        {/* Method Selection */}
        <div className="flex gap-1.5">
          {METHODS.map((m) => (
            <button
              key={m.id}
              onClick={() => {
                setMethod(m.id);
                setMsData(null);
                if (pollRef.current) clearInterval(pollRef.current);
                setPolling(false);
              }}
              className={`
                flex-1 px-2 py-1.5 text-xs rounded-lg border transition-all text-center
                ${
                  method === m.id
                    ? "border-theme-mid bg-theme-mid/20 text-theme-accent font-medium"
                    : "border-theme-second-dark text-theme-text-muted hover:border-theme-mid hover:text-theme-text"
                }
              `}
            >
              {m.label}
            </button>
          ))}
        </div>

        {/* Microsoft Flow */}
        {method === "microsoft" && (
          <div className="space-y-3">
            {msData ? (
              <div className="space-y-3">
                <p className="text-xs text-theme-text-muted">
                  Open this link and enter the code:
                </p>
                <div className="bg-theme-dark border border-theme-second-dark rounded-lg p-3">
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-2xl font-mono font-bold text-theme-accent tracking-widest">
                      {msData.user_code}
                    </span>
                    <button
                      onClick={() => navigator.clipboard.writeText(msData.user_code)}
                      className="p-1.5 rounded-md hover:bg-theme-second-dark text-theme-text-muted hover:text-theme-text transition-colors"
                    >
                      <Copy className="w-4 h-4" />
                    </button>
                  </div>
                  <a
                    href={msData.verification_uri}
                    target="_blank"
                    rel="noreferrer"
                    className="text-xs text-theme-mid hover:text-theme-accent flex items-center gap-1 transition-colors"
                  >
                    {msData.verification_uri}
                    <ExternalLink className="w-3 h-3" />
                  </a>
                </div>
                {polling && (
                  <div className="flex items-center gap-2 text-xs text-theme-text-muted">
                    <Loader2 className="w-3.5 h-3.5 animate-spin" />
                    Waiting for authentication...
                  </div>
                )}
              </div>
            ) : (
              <Button
                variant="primary"
                className="w-full"
                onClick={handleMicrosoftLogin}
                loading={loading}
              >
                Sign in with Microsoft
              </Button>
            )}
          </div>
        )}

        {/* Yggdrasil Login (ElyBy / LittleSkin) */}
        {(method === "elyby" || method === "littleskin") && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-theme-text-muted mb-1">
                {method === "elyby" ? "Email or Username" : "Username"}
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder={method === "elyby" ? "email@example.com" : "Username"}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-text-muted mb-1">Password</label>
              <Input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
              />
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={handleYggdrasilLogin}
              loading={loading}
              disabled={!username.trim() || !password.trim()}
            >
              Login
            </Button>
          </div>
        )}

        {/* Offline */}
        {method === "offline" && (
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-medium text-theme-text-muted mb-1">
                Offline Username
              </label>
              <Input
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                placeholder="Player"
              />
            </div>
            <Button
              variant="primary"
              className="w-full"
              onClick={handleOffline}
              disabled={!username.trim()}
            >
              Set Username
            </Button>
          </div>
        )}
      </div>
    </Modal>
  );
}