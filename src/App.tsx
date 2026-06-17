import { useEffect } from "react";
import { useAppStore } from "@/stores/appStore";
import { useThemeStore } from "@/stores/themeStore";
import Titlebar from "@/components/Titlebar";
import Sidebar from "@/components/Sidebar";
import MainContent from "@/components/MainContent";
import CreateInstanceModal from "@/components/modals/CreateInstanceModal";
import SettingsModal from "@/components/modals/SettingsModal";
import LoginModal from "@/components/modals/LoginModal";
import ModsModal from "@/components/modals/ModsModal";
import LoaderModal from "@/components/modals/LoaderModal";
import ExportInstanceModal from "@/components/modals/ExportInstanceModal";
import ModDescriptionModal from "@/components/modals/ModDescriptionModal";
import OnboardingModal from "@/components/modals/OnboardingModal";
import ShortcutModal from "@/components/modals/ShortcutModal";
import Toast from "@/components/common/Toast";

export default function App() {
  const screen = useAppStore((s) => s.screen);
  const config = useAppStore((s) => s.config);
  const initialize = useAppStore((s) => s.initialize);
  const applyFromConfig = useThemeStore((s) => s.applyFromConfig);

  // Initialize app
  useEffect(() => {
    initialize().then(() => {
      const config = useAppStore.getState().config;
      if (config) {
        applyFromConfig(config.ui_theme, config.ui_mode, config.ui_scale);
      }
    });
  }, [initialize, applyFromConfig]);

  // Onboarding check
  if (screen.type === "onboarding") {
    return (
      <div className="w-full h-full bg-theme-background">
        <OnboardingModal />
      </div>
    );
  }

  // Error screen
  if (screen.type === "error") {
    return (
      <div className="w-full h-full bg-theme-background flex items-center justify-center p-8">
        <div className="bg-theme-surface border border-theme-second-dark rounded-xl p-6 max-w-md">
          <h2 className="text-lg font-semibold text-theme-error mb-2">Error</h2>
          <p className="text-sm text-theme-text-muted leading-relaxed">{screen.message}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="w-full h-full bg-theme-background flex flex-col overflow-hidden">
      <Titlebar />
      <div className="flex flex-1 overflow-hidden">
        <Sidebar />
        <MainContent />
      </div>

      {/* Modals */}
      <CreateInstanceModal />
      <SettingsModal />
      <LoginModal />
      <ModsModal />
      <LoaderModal />
      <ExportInstanceModal />
      <ModDescriptionModal />
      <ShortcutModal />

      {/* Toast Notifications */}
      <Toast />
    </div>
  );
}