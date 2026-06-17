import { create } from "zustand";
import type { ThemeColor, ThemeLightness, ThemePalette } from "@/types";
import { tauriCommands } from "@/utils/tauri";

// ===== Dark Palettes (matching the Rust source exactly) =====

const DARK_PALETTES: Record<ThemeColor, ThemePalette> = {
  Purple: {
    extraDark: "#221920",
    dark: "#3a2436",
    secondDark: "#664769",
    mid: "#cc76c5",
    secondLight: "#f9b1e6",
    light: "#ffc7f0",
    white: "#ffdaf5",
    background: "#221920",
    surface: "#3a2436",
    text: "#ffc7f0",
    textMuted: "#cc76c5",
    accent: "#cc76c5",
    success: "#4ade80",
    error: "#f87171",
    warning: "#fbbf24",
  },
  Brown: {
    extraDark: "#000000",
    dark: "#3d211a",
    secondDark: "#6f4d38",
    mid: "#a07856",
    secondLight: "#cbb799",
    light: "#f0f0cf",
    white: "#ffffff",
    background: "#000000",
    surface: "#3d211a",
    text: "#f0f0cf",
    textMuted: "#a07856",
    accent: "#a07856",
    success: "#4ade80",
    error: "#f87171",
    warning: "#fbbf24",
  },
  "Sky Blue": {
    extraDark: "#1a1b26",
    dark: "#1a2f41",
    secondDark: "#0f5173",
    mid: "#4885a4",
    secondLight: "#a3d3fa",
    light: "#e6f2ff",
    white: "#f5f9fe",
    background: "#1a1b26",
    surface: "#1a2f41",
    text: "#e6f2ff",
    textMuted: "#4885a4",
    accent: "#4885a4",
    success: "#4ade80",
    error: "#f87171",
    warning: "#fbbf24",
  },
  Catppuccin: {
    extraDark: "#11111b",
    dark: "#1e1e2e",
    secondDark: "#575667",
    mid: "#767588",
    secondLight: "#f2cdcd",
    light: "#fce0da",
    white: "#f7eae6",
    background: "#11111b",
    surface: "#1e1e2e",
    text: "#fce0da",
    textMuted: "#767588",
    accent: "#f2cdcd",
    success: "#4ade80",
    error: "#f87171",
    warning: "#fbbf24",
  },
  Teal: {
    extraDark: "#1b3030",
    dark: "#264344",
    secondDark: "#305657",
    mid: "#6ea07f",
    secondLight: "#a4c07e",
    light: "#faff95",
    white: "#fcffc8",
    background: "#1b3030",
    surface: "#264344",
    text: "#faff95",
    textMuted: "#6ea07f",
    accent: "#6ea07f",
    success: "#4ade80",
    error: "#f87171",
    warning: "#fbbf24",
  },
  Halloween: {
    extraDark: "#1a0a0a",
    dark: "#2d1414",
    secondDark: "#4a2020",
    mid: "#d94500",
    secondLight: "#ffb060",
    light: "#ffddaa",
    white: "#fff2d9",
    background: "#1a0a0a",
    surface: "#2d1414",
    text: "#ffddaa",
    textMuted: "#d94500",
    accent: "#d94500",
    success: "#4ade80",
    error: "#f87171",
    warning: "#fbbf24",
  },
  Adwaita: {
    extraDark: "#222226",
    dark: "#2e2e2e",
    secondDark: "#454548",
    mid: "#58585d",
    secondLight: "#919192",
    light: "#ffffff",
    white: "#ffffff",
    background: "#222226",
    surface: "#2e2e2e",
    text: "#ffffff",
    textMuted: "#919192",
    accent: "#58585d",
    success: "#4ade80",
    error: "#f87171",
    warning: "#fbbf24",
  },
};

// ===== Light Palettes (inverted) =====

const LIGHT_PALETTES: Record<ThemeColor, ThemePalette> = {
  Purple: {
    extraDark: "#ffc7f0",
    dark: "#ffdaf5",
    secondDark: "#f9b1e6",
    mid: "#cc76c5",
    secondLight: "#664769",
    light: "#3a2436",
    white: "#221920",
    background: "#ffc7f0",
    surface: "#ffdaf5",
    text: "#221920",
    textMuted: "#cc76c5",
    accent: "#664769",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
  },
  Brown: {
    extraDark: "#f0f0cf",
    dark: "#ffffff",
    secondDark: "#cbb799",
    mid: "#a07856",
    secondLight: "#6f4d38",
    light: "#3d211a",
    white: "#000000",
    background: "#f0f0cf",
    surface: "#ffffff",
    text: "#000000",
    textMuted: "#a07856",
    accent: "#6f4d38",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
  },
  "Sky Blue": {
    extraDark: "#e6f2ff",
    dark: "#f5f9fe",
    secondDark: "#a3d3fa",
    mid: "#4885a4",
    secondLight: "#0f5173",
    light: "#1a2f41",
    white: "#1a1b26",
    background: "#e6f2ff",
    surface: "#f5f9fe",
    text: "#1a1b26",
    textMuted: "#4885a4",
    accent: "#0f5173",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
  },
  Catppuccin: {
    extraDark: "#fce0da",
    dark: "#f7eae6",
    secondDark: "#f2cdcd",
    mid: "#767588",
    secondLight: "#575667",
    light: "#1e1e2e",
    white: "#11111b",
    background: "#fce0da",
    surface: "#f7eae6",
    text: "#11111b",
    textMuted: "#767588",
    accent: "#575667",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
  },
  Teal: {
    extraDark: "#faff95",
    dark: "#fcffc8",
    secondDark: "#a4c07e",
    mid: "#6ea07f",
    secondLight: "#305657",
    light: "#264344",
    white: "#1b3030",
    background: "#faff95",
    surface: "#fcffc8",
    text: "#1b3030",
    textMuted: "#6ea07f",
    accent: "#305657",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
  },
  Halloween: {
    extraDark: "#ffddaa",
    dark: "#fff2d9",
    secondDark: "#ffb060",
    mid: "#d94500",
    secondLight: "#4a2020",
    light: "#2d1414",
    white: "#1a0a0a",
    background: "#ffddaa",
    surface: "#fff2d9",
    text: "#1a0a0a",
    textMuted: "#d94500",
    accent: "#4a2020",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
  },
  Adwaita: {
    extraDark: "#fafafb",
    dark: "#ebebed",
    secondDark: "#d8d8db",
    mid: "#919192",
    secondLight: "#454548",
    light: "#2e2e2e",
    white: "#222226",
    background: "#fafafb",
    surface: "#ebebed",
    text: "#000000",
    textMuted: "#919192",
    accent: "#454548",
    success: "#16a34a",
    error: "#dc2626",
    warning: "#d97706",
  },
};

function isSystemDark(): boolean {
  return window.matchMedia("(prefers-color-scheme: dark)").matches;
}

function getEffectiveLightness(mode: ThemeLightness): "Dark" | "Light" {
  if (mode === "Auto") return isSystemDark() ? "Dark" : "Light";
  return mode;
}

function injectCSSVariables(palette: ThemePalette, isDark: boolean) {
  const root = document.documentElement;
  root.style.setProperty("--color-extra-dark", palette.extraDark);
  root.style.setProperty("--color-dark", palette.dark);
  root.style.setProperty("--color-second-dark", palette.secondDark);
  root.style.setProperty("--color-mid", palette.mid);
  root.style.setProperty("--color-second-light", palette.secondLight);
  root.style.setProperty("--color-light", palette.light);
  root.style.setProperty("--color-white", palette.white);
  root.style.setProperty("--color-background", palette.background);
  root.style.setProperty("--color-surface", palette.surface);
  root.style.setProperty("--color-text", palette.text);
  root.style.setProperty("--color-text-muted", palette.textMuted);
  root.style.setProperty("--color-accent", palette.accent);
  root.style.setProperty("--color-success", palette.success);
  root.style.setProperty("--color-error", palette.error);
  root.style.setProperty("--color-warning", palette.warning);

  // Toggle dark/light class for any CSS that depends on it
  if (isDark) {
    root.classList.remove("light");
    root.classList.add("dark");
  } else {
    root.classList.remove("dark");
    root.classList.add("light");
  }
}

interface ThemeState {
  themeColor: ThemeColor;
  lightnessMode: ThemeLightness;
  palette: ThemePalette;
  uiScale: number;

  setThemeColor: (color: ThemeColor) => void;
  setLightnessMode: (mode: ThemeLightness) => void;
  setUiScale: (scale: number) => void;
  applyFromConfig: (theme?: ThemeColor | null, lightness?: ThemeLightness | null, scale?: number | null) => void;
}

export const useThemeStore = create<ThemeState>((set, get) => {
  const defaultPalette = DARK_PALETTES.Purple;

  // Inject initial
  injectCSSVariables(defaultPalette, true);

  // Listen for system dark mode changes
  window.matchMedia("(prefers-color-scheme: dark)").addEventListener("change", () => {
    const { themeColor, lightnessMode } = get();
    if (lightnessMode === "Auto") {
      const effective = getEffectiveLightness("Auto");
      const palettes = effective === "Dark" ? DARK_PALETTES : LIGHT_PALETTES;
      const palette = palettes[themeColor];
      injectCSSVariables(palette, effective === "Dark");
      set({ palette });
    }
  });

  return {
    themeColor: "Purple",
    lightnessMode: "Dark",
    palette: defaultPalette,
    uiScale: 1.0,

    setThemeColor: (color) => {
      const { lightnessMode } = get();
      const effective = getEffectiveLightness(lightnessMode);
      const palettes = effective === "Dark" ? DARK_PALETTES : LIGHT_PALETTES;
      const palette = palettes[color];
      injectCSSVariables(palette, effective === "Dark");
      set({ themeColor: color, palette });
    },

    setLightnessMode: (mode) => {
      const { themeColor } = get();
      const effective = getEffectiveLightness(mode);
      const palettes = effective === "Dark" ? DARK_PALETTES : LIGHT_PALETTES;
      const palette = palettes[themeColor];
      injectCSSVariables(palette, effective === "Dark");
      set({ lightnessMode: mode, palette });
    },

    setUiScale: (scale) => {
      document.documentElement.style.fontSize = `${scale * 16}px`;
      set({ uiScale: scale });
    },

    applyFromConfig: (theme, lightness, scale) => {
      const store = get();
      const newColor = theme ?? store.themeColor;
      const newLightness = lightness ?? store.lightnessMode;
      const newScale = scale ?? store.uiScale;

      if (newScale !== store.uiScale) {
        document.documentElement.style.fontSize = `${newScale * 16}px`;
      }

      const effective = getEffectiveLightness(newLightness);
      const palettes = effective === "Dark" ? DARK_PALETTES : LIGHT_PALETTES;
      const palette = palettes[newColor];
      injectCSSVariables(palette, effective === "Dark");
      set({ themeColor: newColor, lightnessMode: newLightness, palette: palette, uiScale: newScale });
    },
  };
});