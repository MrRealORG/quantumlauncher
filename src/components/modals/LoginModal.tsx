import { useState, useEffect, useCallback, useRef } from "react";
import { Loader2, ExternalLink, Copy, Eye, EyeOff } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { tauriCommands, type AccountInfo } from "@/utils/tauri";
import type { AccountType, AccountData, ConfigAccount } from "@/types";

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
  const config = useAppStore((s) => s.config);
  const updateConfig = useAppStore((s) => s.updateConfig);

  const [method, setMethod] = useState<LoginMethod>("microsoft");
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [otp, setOtp] = useState("");
  const [otpRequired, setOtpRequired] = useState(false);
  const [msData, setMsData] = useState<{
    user_code: string;
    verification_uri: string;
  } | null>(null);
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

  /** Store account data into config.accounts and update dropdown */
  const storeAccount = useCallback(
    (account: AccountInfo) => {
      if (!config) return;

      const niceName = account.nice_username || account.username;
      const configAccount: ConfigAccount = {
        uuid: account.uuid,
        skin: null,
        account_type: account.account_type as AccountType,
        keyring_identifier: null,
        username_nice: niceName,
      };

      const existing = config.accounts || {};
      const updatedAccounts = { ...existing, [niceName]: configAccount };
      const dropdownNames = Object.keys(updatedAccounts).sort();

      // Insert new name into dropdown before "+ Add Account"
      const newDropdown = [
        "(Offline)",
        ...dropdownNames,
        "+ Add Account",
      ];

      updateConfig({
        accounts: updatedAccounts,
        account_selected: niceName,
      });

      // Also update the store's dropdown directly for immediate UI update
      useAppStore.setState({
        accountsDropdown: newDropdown,
        selectedAccount: niceName,
        accounts: {
          ...useAppStore.getState().accounts,
          [niceName]: account,
        },
      });
    },
    [config, updateConfig]
  );

  const handleMicrosoftLogin = useCallback(async () => {
    setLoading(true);
    try {
      const data = await tauriCommands.login_microsoft();
      setMsData(data);
      setPolling(true);

      // Start polling
      pollRef.current = setInterval(async () => {
        try {
          const account = await tauriCommands.poll_microsoft_login(
            data.user_code
          );
          if (account) {
            clearInterval(pollRef.current);
            setPolling(false);
            setLoading(false);
            storeAccount(account);
            addToast(`Logged in as ${account.nice_username}`, "success");
            handleClose();
          }
          // null = still pending, continue polling
        } catch (e) {
          // Auth declined or expired
          clearInterval(pollRef.current);
          setPolling(false);
          setLoading(false);
          addToast(e instanceof Error ? e.message : "Microsoft auth failed", "error");
        }
      }, 5000);
    } catch {
      addToast("Failed to start Microsoft login", "error");
    } finally {
      setLoading(false);
    }
  }, [addToast, handleClose, storeAccount]);

  const handleYggdrasilLogin = useCallback(async (otpCode?: string) => {
    if (!username.trim() || !password.trim()) return;
    setLoading(true);
    try {
      const authType = method === "elyby" ? "ElyBy" : "LittleSkin";
      const authUrl =
        method === "littleskin"
          ? "https://littleskin.cn/api/yggdrasil"
          : undefined;
      // OTP is appended to password with colon separator (same as iced)
      const passwordWithOtp = otpCode
        ? `${password}:${otpCode}`
        : password;
      const result = await tauriCommands.login_yggdrasil(
        username.trim(),
        passwordWithOtp,
        authType,
        authUrl
      );

      if (result.is_needs_otp) {
        setOtpRequired(true);
        addToast("OTP required. Please check your email and enter the code.", "warning");
        return;
      }

      setOtpRequired(false);
      storeAccount(result.account);
      addToast(`Logged in as ${result.account.nice_username}`, "success");
      handleClose();
    } catch (e) {
      addToast(e instanceof Error ? e.message : "Login failed", "error");
    } finally {
      setLoading(false);
    }
  }, [method, username, password, addToast, handleClose, storeAccount]);

  const handleOffline = useCallback(() => {
    if (!username.trim()) return;
    updateConfig({ username: username.trim() });
    addToast(`Using offline username: ${username.trim()}`, "info");
    handleClose();
  }, [username, addToast, handleClose, updateConfig]);

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
                setUsername("");
                setPassword("");
                setOtp("");
                setOtpRequired(false);
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
                      onClick={() =>
                        navigator.clipboard.writeText(msData.user_code)
                      }
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
                placeholder={
                  method === "elyby" ? "email@example.com" : "Username"
                }
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-theme-text-muted mb-1">
                Password
              </label>
              <div className="relative">
                <Input
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(e) => setPassword(e.target.value)}
                  placeholder="Password"
                  className="pr-8"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword(!showPassword)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-theme-text-muted hover:text-theme-text transition-colors"
                >
                  {showPassword ? (
                    <EyeOff className="w-3.5 h-3.5" />
                  ) : (
                    <Eye className="w-3.5 h-3.5" />
                  )}
                </button>
              </div>
            </div>
            {method === "elyby" && (
              <div>
                <label className="block text-xs font-medium text-theme-text-muted mb-1">
                  {otpRequired ? "OTP Code" : "OTP Code (optional)"}
                </label>
                <div className="flex gap-2">
                  <Input
                    value={otp}
                    onChange={(e) => setOtp(e.target.value)}
                    placeholder="000000"
                    className="flex-1"
                    onKeyDown={(e) => {
                      if (e.key === "Enter" && otpRequired && otp.trim()) {
                        handleYggdrasilLogin(otp.trim());
                      }
                    }}
                  />
                  {otpRequired && (
                    <Button
                      variant="primary"
                      size="sm"
                      onClick={() => handleYggdrasilLogin(otp.trim())}
                      loading={loading}
                      disabled={!otp.trim()}
                    >
                      Submit
                    </Button>
                  )}
                </div>
              </div>
            )}
            {!otpRequired && (
              <Button
                variant="primary"
                className="w-full"
                onClick={() => handleYggdrasilLogin()}
                loading={loading}
                disabled={!username.trim() || !password.trim()}
              >
                Login
              </Button>
            )}
            <p className="text-[11px] text-theme-text-muted text-center">
              Or{" "}
              <a
                href={
                  method === "elyby"
                    ? "https://ely.by/register"
                    : "https://littleskin.cn/auth/register"
                }
                target="_blank"
                rel="noreferrer"
                className="text-theme-mid hover:text-theme-accent underline transition-colors"
              >
                create an account
              </a>
            </p>
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