import { useState, useEffect, useCallback } from "react";
import { ArrowLeft, Download, ExternalLink, Loader2, Image as ImageIcon } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import Modal from "@/components/common/Modal";
import Button from "@/components/common/Button";
import { tauriCommands } from "@/utils/tauri";
import type { SearchMod, ModId, UrlKind } from "@/types";

export default function ModDescriptionModal() {
  const screen = useAppStore((s) => s.screen);
  const setScreen = useAppStore((s) => s.setScreen);
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const addToast = useAppStore((s) => s.addToast);

  const [description, setDescription] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [currentGalleryIndex, setCurrentGalleryIndex] = useState(0);

  const open = screen.type === "mod_description";
  const mod = open ? screen.mod : null;

  const handleClose = useCallback(() => setScreen({ type: "mods" }), [setScreen]);

  useEffect(() => {
    if (!open || !mod) return;
    setLoading(true);
    const modId: ModId =
      mod.backend === "curseforge"
        ? { type: "curseforge", id: mod.id }
        : { type: "modrinth", id: mod.id };
    tauriCommands
      .get_mod_description(modId)
      .then((data) => setDescription(data.description))
      .catch(() => setDescription("<p>Failed to load description</p>"))
      .finally(() => setLoading(false));
  }, [open, mod]);

  const handleDownload = useCallback(async () => {
    if (!mod || !selectedInstance) return;
    const modId: ModId =
      mod.backend === "curseforge"
        ? { type: "curseforge", id: mod.id }
        : { type: "modrinth", id: mod.id };
    try {
      await tauriCommands.download_mod(selectedInstance, modId);
      addToast(`Downloaded ${mod.title}`, "success");
    } catch {
      addToast("Download failed", "error");
    }
  }, [mod, selectedInstance, addToast]);

  return (
    <Modal open={open} onClose={handleClose} wide>
      <div className="flex flex-col h-[650px]">
        {/* Header with mod info */}
        <div className="flex items-start gap-3 p-4 border-b border-theme-second-dark flex-shrink-0">
          {mod?.icon_url && (
            <img
              src={mod.icon_url}
              alt=""
              className="w-12 h-12 rounded-lg flex-shrink-0"
              onError={(e) => (e.currentTarget.style.display = "none")}
            />
          )}
          <div className="flex-1 min-w-0">
            <h2 className="text-base font-semibold text-theme-text truncate">{mod?.title}</h2>
            <p className="text-xs text-theme-text-muted mt-0.5 line-clamp-2">{mod?.description}</p>
            <div className="flex items-center gap-3 mt-1.5">
              <span className="text-[10px] text-theme-text-muted">
                {mod?.downloads?.toLocaleString()} downloads
              </span>
              <span className="text-[10px] text-theme-text-muted">
                {mod?.backend === "modrinth" ? "Modrinth" : "CurseForge"}
              </span>
            </div>
          </div>
          <div className="flex gap-1.5 flex-shrink-0">
            <Button
              variant="ghost"
              size="sm"
              icon={<ArrowLeft className="w-4 h-4" />}
              onClick={() => setScreen({ type: "mods" })}
            >
              Back
            </Button>
            <Button
              variant="primary"
              size="sm"
              icon={<Download className="w-4 h-4" />}
              onClick={handleDownload}
            >
              Download
            </Button>
          </div>
        </div>

        {/* Gallery */}
        {mod && mod.gallery && mod.gallery.length > 0 && (
          <div className="border-b border-theme-second-dark flex-shrink-0">
            <div className="relative">
              <img
                src={mod.gallery[currentGalleryIndex].url}
                alt={mod.gallery[currentGalleryIndex].title || ""}
                className="w-full max-h-48 object-contain bg-theme-dark"
                onError={(e) => (e.currentTarget.style.display = "none")}
              />
              {mod.gallery.length > 1 && (
                <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex gap-1">
                  {mod.gallery.map((_, i) => (
                    <button
                      key={i}
                      onClick={() => setCurrentGalleryIndex(i)}
                      className={`w-1.5 h-1.5 rounded-full transition-colors ${
                        i === currentGalleryIndex ? "bg-theme-text" : "bg-theme-text-muted/40"
                      }`}
                    />
                  ))}
                </div>
              )}
            </div>
          </div>
        )}

        {/* Description */}
        <div className="flex-1 overflow-y-auto p-4">
          {loading ? (
            <div className="flex items-center justify-center h-full">
              <Loader2 className="w-6 h-6 animate-spin text-theme-mid" />
            </div>
          ) : description ? (
            <div
              className="prose prose-invert prose-sm max-w-none
                [&_a]:text-theme-mid [&_a:hover]:text-theme-accent [&_a]:transition-colors
                [&_img]:rounded-lg [&_img]:max-w-full
                [&_h1]:text-lg [&_h1]:text-theme-text [&_h1]:font-semibold
                [&_h2]:text-base [&_h2]:text-theme-text [&_h2]:font-semibold
                [&_h3]:text-sm [&_h3]:text-theme-text [&_h3]:font-medium
                [&_p]:text-theme-text/90 [&_p]:text-sm [&_p]:leading-relaxed
                [&_ul]:text-theme-text/90 [&_ol]:text-theme-text/90
                [&_li]:text-sm
                [&_code]:text-theme-accent [&_code]:bg-theme-dark [&_code]:px-1 [&_code]:py-0.5 [&_code]:rounded
                [&_pre]:bg-theme-dark [&_pre]:p-3 [&_pre]:rounded-lg [&_pre]:overflow-x-auto
                [&_table]:w-full [&_th]:text-left [&_th]:text-xs [&_th]:text-theme-text-muted [&_th]:p-1.5 [&_th]:border-b [&_th]:border-theme-second-dark
                [&_td]:text-sm [&_td]:text-theme-text [&_td]:p-1.5 [&_td]:border-b [&_td]:border-theme-second-dark
                [&_blockquote]:border-l-2 [&_blockquote]:border-theme-mid [&_blockquote]:pl-3 [&_blockquote]:text-theme-text-muted
              "
              dangerouslySetInnerHTML={{ __html: description }}
            />
          ) : (
            <p className="text-sm text-theme-text-muted">No description available</p>
          )}
        </div>
      </div>
    </Modal>
  );
}