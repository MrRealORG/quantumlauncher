import { useState, useEffect, useRef, useCallback } from "react";
import { Upload, Copy, Search, X, Terminal, ExternalLink, Check, Loader2 } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Button from "@/components/common/Button";
import Input from "@/components/common/Input";
import { tauriCommands } from "@/utils/tauri";

export default function LogTab() {
  const { selectedInstance, logs, addToast, isLaunching, runningInstances } = useAppStore();
  const [autoScroll, setAutoScroll] = useState(true);
  const [searchQuery, setSearchQuery] = useState("");
  const [command, setCommand] = useState("");
  const [uploadingLog, setUploadingLog] = useState(false);
  const [uploadedUrl, setUploadedUrl] = useState<string | null>(null);
  const [uploadCopied, setUploadCopied] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);
  const commandInputRef = useRef<HTMLInputElement>(null);

  const logKey = selectedInstance
    ? `${selectedInstance.kind}/${selectedInstance.name}`
    : null;

  const log = logKey ? logs[logKey] : undefined;

  const isServer = selectedInstance?.kind === "Server";
  const isServerRunning = isServer && selectedInstance && runningInstances.has(selectedInstance.name);

  const filteredLines = log
    ? searchQuery
      ? log.lines.filter((line) =>
          line.toLowerCase().includes(searchQuery.toLowerCase())
        )
      : log.lines
    : [];

  // Auto-scroll
  useEffect(() => {
    if (autoScroll && scrollRef.current) {
      scrollRef.current.scrollTop = scrollRef.current.scrollHeight;
    }
  }, [log?.lines.length, autoScroll]);

  // Focus command input when server starts running
  useEffect(() => {
    if (isServerRunning && commandInputRef.current) {
      commandInputRef.current.focus();
    }
  }, [isServerRunning]);

  const handleScroll = useCallback(() => {
    if (!scrollRef.current) return;
    const { scrollTop, scrollHeight, clientHeight } = scrollRef.current;
    const atBottom = scrollHeight - scrollTop - clientHeight < 40;
    setAutoScroll(atBottom);
  }, []);

  const handleUploadLog = useCallback(async () => {
    if (!log || uploadingLog) return;
    setUploadingLog(true);
    setUploadedUrl(null);
    try {
      const url = await tauriCommands.upload_log(log.lines.join("\n"));
      setUploadedUrl(url);
    } catch {
      addToast("Failed to upload log", "error");
    } finally {
      setUploadingLog(false);
    }
  }, [log, uploadingLog, addToast]);

  const handleCopyUploadedUrl = useCallback(async () => {
    if (!uploadedUrl) return;
    try {
      await navigator.clipboard.writeText(uploadedUrl);
      setUploadCopied(true);
      setTimeout(() => setUploadCopied(false), 2000);
    } catch {
      addToast("Failed to copy URL", "error");
    }
  }, [uploadedUrl, addToast]);

  const handleCopyLog = useCallback(async () => {
    if (!log) return;
    try {
      await navigator.clipboard.writeText(log.lines.join("\n"));
      addToast("Log copied to clipboard", "success");
    } catch {
      addToast("Failed to copy log", "error");
    }
  }, [log, addToast]);

  const handleSendCommand = useCallback(async () => {
    if (!selectedInstance || !command.trim()) return;
    const cmd = command.trim();
    setCommand("");
    try {
      const sent = await tauriCommands.send_server_command(selectedInstance.name, cmd);
      if (!sent) {
        addToast("Failed to send command — server may not be running", "warning");
      }
    } catch {
      addToast("Failed to send server command", "error");
    }
    // Re-focus input after sending
    commandInputRef.current?.focus();
  }, [selectedInstance, command, addToast]);

  if (!selectedInstance) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm text-theme-text-muted">Select an instance to view logs</p>
      </div>
    );
  }

  return (
    <div className="flex-1 flex flex-col overflow-hidden">
      {/* Toolbar */}
      <div className="flex items-center gap-2 px-4 py-2 border-b border-theme-second-dark flex-shrink-0">
        <div className="flex-1 max-w-xs">
          <Input
            variant="search"
            placeholder="Search logs..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            leftIcon={<Search className="w-3.5 h-3.5" />}
            rightIcon={
              searchQuery ? (
                <button onClick={() => setSearchQuery("")} className="hover:text-theme-text">
                  <X className="w-3.5 h-3.5" />
                </button>
              ) : undefined
            }
          />
        </div>
        <Button
          variant="ghost"
          size="sm"
          icon={uploadingLog ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Upload className="w-3.5 h-3.5" />}
          onClick={handleUploadLog}
          disabled={!log || log.lines.length === 0 || uploadingLog}
        >
          {uploadingLog ? "Uploading..." : "Upload Log"}
        </Button>
        <Button variant="ghost" size="sm" icon={<Copy className="w-3.5 h-3.5" />} onClick={handleCopyLog}>
          Copy
        </Button>
        {log?.has_crashed && (
          <span className="text-xs text-theme-error font-medium px-2 py-0.5 bg-theme-error/10 rounded">
            Crashed
          </span>
        )}
      </div>

      {/* Upload Result Banner */}
      {uploadedUrl && (
        <div className="mx-4 mt-2 bg-green-500/10 border border-green-500/30 rounded-lg px-3 py-2 flex items-center gap-2">
          <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <p className="text-[11px] text-green-400 font-medium">Log uploaded to mclo.gs</p>
            <p className="text-[10px] text-theme-mid font-mono truncate">{uploadedUrl}</p>
          </div>
          <button
            onClick={handleCopyUploadedUrl}
            className="flex items-center gap-1 text-[10px] text-theme-text-muted hover:text-theme-text transition-colors px-1.5 py-0.5 rounded hover:bg-theme-second-dark/40 flex-shrink-0"
          >
            {uploadCopied ? <Check className="w-3 h-3 text-green-500" /> : <Copy className="w-3 h-3" />}
            {uploadCopied ? "Copied" : "Copy"}
          </button>
          <a
            href={uploadedUrl}
            target="_blank"
            rel="noreferrer"
            className="flex items-center gap-1 text-[10px] text-theme-mid hover:text-theme-accent transition-colors px-1.5 py-0.5 rounded hover:bg-theme-second-dark/40 flex-shrink-0"
          >
            <ExternalLink className="w-3 h-3" />
            Open
          </a>
          <button
            onClick={() => setUploadedUrl(null)}
            className="text-theme-text-muted hover:text-theme-text transition-colors flex-shrink-0"
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Log Content */}
      <div
        ref={scrollRef}
        onScroll={handleScroll}
        className="flex-1 overflow-y-auto p-3 font-mono text-xs leading-relaxed"
      >
        {filteredLines.length === 0 ? (
          <div className="flex items-center justify-center h-full text-theme-text-muted text-xs">
            {isLaunching ? "Waiting for game output..." : "No log output yet"}
          </div>
        ) : (
          filteredLines.map((line, i) => (
            <div
              key={i}
              className={`py-0.5 px-1 rounded-sm hover:bg-theme-second-dark/30 ${
                line.includes("[ERROR]") || line.toLowerCase().includes("error")
                  ? "text-theme-error"
                  : line.includes("[WARN]") || line.toLowerCase().includes("warn")
                  ? "text-theme-warning"
                  : "text-theme-text/90"
              }`}
            >
              {line || "\u00A0"}
            </div>
          ))
        )}
      </div>

      {/* Server Command Input */}
      {isServer && (
        <div className="border-t border-theme-second-dark px-4 py-2 flex-shrink-0">
          <div className="flex items-center gap-2">
            <Terminal className="w-3.5 h-3.5 text-theme-text-muted flex-shrink-0" />
            <input
              ref={commandInputRef}
              type="text"
              value={command}
              onChange={(e) => setCommand(e.target.value)}
              onKeyDown={(e) => {
                if (e.key === "Enter") handleSendCommand();
              }}
              disabled={!isServerRunning}
              placeholder={
                isServerRunning
                  ? "Enter server command..."
                  : "Server is not running"
              }
              className={`
                flex-1 bg-transparent text-sm text-theme-text placeholder:text-theme-text-muted
                border border-theme-second-dark rounded-md px-3 py-1.5 outline-none
                focus:border-theme-mid transition-colors
                disabled:opacity-50 disabled:cursor-not-allowed
              `}
            />
            <Button
              variant="ghost"
              size="sm"
              onClick={handleSendCommand}
              disabled={!isServerRunning || !command.trim()}
            >
              Send
            </Button>
          </div>
          {isServer && !isServerRunning && (
            <p className="text-[10px] text-theme-text-muted mt-1 ml-6">
              Start the server to send commands
            </p>
          )}
        </div>
      )}

      {/* Auto scroll indicator */}
      {!autoScroll && log && log.lines.length > 0 && (
        <button
          onClick={() => {
            setAutoScroll(true);
            scrollRef.current?.scrollTo({ top: scrollRef.current.scrollHeight });
          }}
          className="absolute bottom-16 right-4 bg-theme-mid text-theme-extra-dark text-xs font-medium px-3 py-1.5 rounded-full shadow-lg hover:brightness-110 transition-all"
        >
          ↓ Scroll to bottom
        </button>
      )}
    </div>
  );
}