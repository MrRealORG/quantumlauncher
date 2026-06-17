import { useState } from "react";
import { Play, FileText, Settings2 } from "lucide-react";
import { useAppStore } from "@/stores/appStore";
import TabBar from "@/components/common/TabBar";
import PlayTab from "@/components/PlayTab";
import LogTab from "@/components/LogTab";
import EditTab from "@/components/EditTab";
import ProgressBar from "@/components/common/ProgressBar";

const tabs = [
  { id: "play", label: "Play", icon: <Play className="w-4 h-4" /> },
  { id: "logs", label: "Logs", icon: <FileText className="w-4 h-4" /> },
  { id: "edit", label: "Edit", icon: <Settings2 className="w-4 h-4" /> },
];

export default function MainContent() {
  const [activeTab, setActiveTab] = useState("play");
  const selectedInstance = useAppStore((s) => s.selectedInstance);
  const launchProgress = useAppStore((s) => s.launchProgress);
  const isLaunching = useAppStore((s) => s.isLaunching);

  return (
    <div className="flex-1 flex flex-col overflow-hidden bg-theme-background">
      {/* Tab Bar */}
      <div className="flex items-center justify-between px-4 border-b border-theme-second-dark flex-shrink-0">
        <TabBar tabs={tabs} activeTab={activeTab} onTabChange={setActiveTab} />
        {selectedInstance && (
          <span className="text-xs text-theme-text-muted truncate max-w-[200px]">
            {selectedInstance.name}
          </span>
        )}
      </div>

      {/* Progress bar during launch */}
      {isLaunching && launchProgress && (
        <div className="px-4 pt-3">
          <ProgressBar
            value={launchProgress.total > 0 ? launchProgress.done / launchProgress.total : 0}
            indeterminate={!launchProgress.message}
            message={launchProgress.message || "Preparing..."}
          />
        </div>
      )}

      {/* Tab Content */}
      <div className="flex-1 overflow-hidden">
        {activeTab === "play" && <PlayTab />}
        {activeTab === "logs" && <LogTab />}
        {activeTab === "edit" && <EditTab />}
      </div>
    </div>
  );
}