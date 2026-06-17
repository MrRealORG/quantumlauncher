/** @type {import('tailwindcss').Config} */
export default {
  content: ["./index.html", "./src/**/*.{js,ts,jsx,tsx}"],
  darkMode: "class",
  theme: {
    extend: {
      colors: {
        theme: {
          "extra-dark": "var(--color-extra-dark)",
          dark: "var(--color-dark)",
          "second-dark": "var(--color-second-dark)",
          mid: "var(--color-mid)",
          "second-light": "var(--color-second-light)",
          light: "var(--color-light)",
          white: "var(--color-white)",
          background: "var(--color-background)",
          surface: "var(--color-surface)",
          text: "var(--color-text)",
          "text-muted": "var(--color-text-muted)",
          accent: "var(--color-accent)",
          success: "var(--color-success)",
          error: "var(--color-error)",
          warning: "var(--color-warning)",
        },
      },
      fontFamily: {
        sans: ["Inter", "system-ui", "sans-serif"],
        mono: ["JetBrains Mono", "monospace"],
      },
      borderRadius: {
        DEFAULT: "8px",
      },
    },
  },
  plugins: [],
};