import { useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import Button from "@/components/common/Button";

function formatChangelog(content: string): string {
  // Simple markdown-to-HTML: handle headings, bold, links, lists, code
  let html = content
    // Headers
    .replace(/^### (.+)$/gm, '<h3 class="text-base font-semibold text-theme-text mt-4 mb-1">$1</h3>')
    .replace(/^## (.+)$/gm, '<h2 class="text-lg font-semibold text-theme-text mt-5 mb-2">$1</h2>')
    .replace(/^# (.+)$/gm, '<h1 class="text-xl font-bold text-theme-text mt-6 mb-2">$1</h1>')
    // Bold
    .replace(/\*\*(.+?)\*\*/g, '<span class="font-semibold text-theme-text">$1</span>')
    // Inline code
    .replace(/`([^`]+)`/g, '<code class="bg-theme-second-dark px-1 py-0.5 rounded text-xs font-mono text-theme-accent">$1</code>')
    // Links
    .replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noreferrer" class="text-theme-mid hover:text-theme-accent underline transition-colors">$1</a>')
    // Unordered list items
    .replace(/^- (.+)$/gm, '<li class="ml-4 list-disc text-sm text-theme-text-muted leading-relaxed">$1</li>')
    // Ordered list items
    .replace(/^\d+\. (.+)$/gm, '<li class="ml-4 list-decimal text-sm text-theme-text-muted leading-relaxed">$1</li>')
    // Horizontal rules
    .replace(/^---$/gm, '<hr class="my-4 border-theme-second-dark" />')
    // Paragraphs (double newlines)
    .replace(/\n\n/g, '</p><p class="text-sm text-theme-text-muted leading-relaxed mb-2">')
    // Single newlines to <br>
    .replace(/\n/g, '<br />');

  return `<p class="text-sm text-theme-text-muted leading-relaxed mb-2">${html}</p>`;
}

export default function ChangelogModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);

  const content = screen.type === "changelog" ? (screen.content || "No changelog available.") : "";

  const handleContinue = useCallback(() => {
    setScreen({ type: "main" });
  }, [setScreen]);

  return (
    <div className="w-full h-full bg-theme-background flex items-center justify-center p-8">
      <div className="w-full max-w-lg bg-theme-surface border border-theme-second-dark rounded-2xl overflow-hidden animate-slide-up shadow-2xl">
        {/* Header */}
        <div className="px-6 pt-6 pb-2">
          <h1 className="text-xl font-bold text-theme-text">What's New</h1>
          <p className="text-xs text-theme-text-muted mt-1">PK Launcher has been updated</p>
        </div>

        {/* Changelog Content */}
        <div className="px-6 py-4 max-h-[60vh] overflow-y-auto">
          <div
            className="changelog-content"
            dangerouslySetInnerHTML={{ __html: formatChangelog(content) }}
          />
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end px-6 py-4 border-t border-theme-second-dark">
          <Button variant="primary" size="sm" onClick={handleContinue}>
            Continue
          </Button>
        </div>
      </div>
    </div>
  );
}