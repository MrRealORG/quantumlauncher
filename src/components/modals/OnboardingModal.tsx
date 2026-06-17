import { useState, useCallback } from "react";
import { useAppStore } from "@/stores/appStore";
import { useThemeStore } from "@/stores/themeStore";
import Button from "@/components/common/Button";
import { Check } from "lucide-react";
import type { ThemeColor, ThemeLightness } from "@/types";

const STEPS = [
  { id: "welcome", label: "Welcome" },
  { id: "theme", label: "Appearance" },
  { id: "account", label: "Account" },
];

const THEME_COLORS: ThemeColor[] = ["Purple", "Brown", "Sky Blue", "Catppuccin", "Teal", "Halloween", "Adwaita"];

const COLOR_PREVIEW: Record<ThemeColor, string> = {
  Purple: "#cc76c5",
  Brown: "#a07856",
  "Sky Blue": "#4885a4",
  Catppuccin: "#f2cdcd",
  Teal: "#6ea07f",
  Halloween: "#d94500",
  Adwaita: "#58585d",
};

export default function OnboardingModal() {
  const [step, setStep] = useState(0);
  const [selectedColor, setSelectedColor] = useState<ThemeColor>("Purple");
  const [selectedLightness, setSelectedLightness] = useState<ThemeLightness>("Dark");

  const setScreen = useAppStore((s) => s.setScreen);
  const config = useAppStore((s) => s.config);
  const updateConfig = useAppStore((s) => s.updateConfig);
  const setThemeColor = useThemeStore((s) => s.setThemeColor);
  const setLightnessMode = useThemeStore((s) => s.setLightnessMode);

  const handleNext = useCallback(() => {
    if (step < 2) {
      setStep(step + 1);
    } else {
      // Finish
      setThemeColor(selectedColor);
      setLightnessMode(selectedLightness);
      updateConfig({ ui_theme: selectedColor, ui_mode: selectedLightness });
      setScreen({ type: "main" });
    }
  }, [step, selectedColor, selectedLightness, setThemeColor, setLightnessMode, updateConfig, setScreen]);

  const handleBack = useCallback(() => {
    if (step > 0) setStep(step - 1);
  }, [step]);

  const handleSkip = useCallback(() => {
    setScreen({ type: "main" });
  }, [setScreen]);

  return (
    <div className="w-full h-full bg-theme-background flex items-center justify-center p-8">
      <div className="w-full max-w-md bg-theme-surface border border-theme-second-dark rounded-2xl overflow-hidden animate-slide-up shadow-2xl">
        {/* Step indicators */}
        <div className="flex items-center justify-center gap-2 pt-6 px-6">
          {STEPS.map((s, i) => (
            <div key={s.id} className="flex items-center gap-2">
              <div
                className={`w-6 h-6 rounded-full flex items-center justify-center text-[10px] font-medium transition-colors ${
                  i <= step ? "bg-theme-mid text-theme-extra-dark" : "bg-theme-second-dark text-theme-text-muted"
                }`}
              >
                {i < step ? <Check className="w-3.5 h-3.5" /> : i + 1}
              </div>
              {i < STEPS.length - 1 && (
                <div className={`w-12 h-0.5 ${i < step ? "bg-theme-mid" : "bg-theme-second-dark"} transition-colors`} />
              )}
            </div>
          ))}
        </div>

        {/* Step Content */}
        <div className="px-6 py-6">
          {step === 0 && (
            <div className="text-center space-y-3">
              <h1 className="text-2xl font-bold text-theme-text">Welcome to PK Launcher</h1>
              <p className="text-sm text-theme-text-muted leading-relaxed">
                A modern Minecraft launcher with mod management, multi-instance support,
                and a beautiful themed interface. Let's set a few things up.
              </p>
            </div>
          )}

          {step === 1 && (
            <div className="space-y-4">
              <h2 className="text-lg font-semibold text-theme-text">Choose Your Theme</h2>

              <div>
                <label className="block text-xs font-medium text-theme-text-muted mb-2">Color</label>
                <div className="grid grid-cols-4 gap-2">
                  {THEME_COLORS.map((color) => (
                    <button
                      key={color}
                      onClick={() => setSelectedColor(color)}
                      className={`
                        relative flex flex-col items-center gap-1.5 p-2 rounded-lg border transition-all
                        ${selectedColor === color ? "border-theme-mid bg-theme-mid/10" : "border-theme-second-dark hover:border-theme-mid/50"}
                      `}
                    >
                      <div
                        className="w-8 h-8 rounded-full"
                        style={{ backgroundColor: COLOR_PREVIEW[color] }}
                      />
                      <span className="text-[10px] text-theme-text-muted">{color}</span>
                      {selectedColor === color && (
                        <div className="absolute top-1 right-1 w-3 h-3 bg-theme-mid rounded-full flex items-center justify-center">
                          <Check className="w-2 h-2 text-theme-extra-dark" />
                        </div>
                      )}
                    </button>
                  ))}
                </div>
              </div>

              <div>
                <label className="block text-xs font-medium text-theme-text-muted mb-2">Mode</label>
                <div className="flex gap-2">
                  {(["Dark", "Light", "Auto"] as ThemeLightness[]).map((mode) => (
                    <button
                      key={mode}
                      onClick={() => setSelectedLightness(mode)}
                      className={`
                        flex-1 py-2 text-sm rounded-lg border transition-all
                        ${selectedLightness === mode ? "border-theme-mid bg-theme-mid/20 text-theme-accent font-medium" : "border-theme-second-dark text-theme-text-muted hover:border-theme-mid/50"}
                      `}
                    >
                      {mode}
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}

          {step === 2 && (
            <div className="text-center space-y-4">
              <h2 className="text-lg font-semibold text-theme-text">Account Setup</h2>
              <p className="text-sm text-theme-text-muted">
                You can add accounts later from the account dropdown.
                For now, you can play offline with any username.
              </p>
              <Button
                variant="primary"
                onClick={() => setScreen({ type: "login" })}
              >
                Add Account
              </Button>
            </div>
          )}
        </div>

        {/* Navigation */}
        <div className="flex items-center justify-between px-6 py-4 border-t border-theme-second-dark">
          <button
            onClick={handleSkip}
            className="text-xs text-theme-text-muted hover:text-theme-text transition-colors"
          >
            Skip
          </button>
          <div className="flex gap-2">
            {step > 0 && (
              <Button variant="ghost" size="sm" onClick={handleBack}>
                Back
              </Button>
            )}
            <Button variant="primary" size="sm" onClick={handleNext}>
              {step === 2 ? "Finish" : "Next"}
            </Button>
          </div>
        </div>
      </div>
    </div>
  );
}