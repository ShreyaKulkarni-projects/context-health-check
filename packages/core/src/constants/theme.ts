/**
 * JS-side mirror of the resolved hex values in ./theme.css, for contexts that
 * need a raw color (e.g. generating a downloaded score-card image) rather
 * than a CSS custom property reference. Keep in sync with theme.css by hand -
 * both are ported from the same source (the original HTML prototype).
 */
export const THEME = {
  light: {
    surface1: "#fcfcfb",
    page: "#f9f9f7",
    textPrimary: "#0b0b0b",
    textSecondary: "#52514e",
    textMuted: "#898781",
    gridline: "#e1e0d9",
    baseline: "#c3c2b7",
    seriesBlue: "#2a78d6",
    seriesBlue100: "#cde2fb",
    statusGood: "#0ca30c",
    statusWarning: "#fab219",
    statusSerious: "#ec835a",
    statusCritical: "#d03b3b",
  },
  dark: {
    surface1: "#1a1a19",
    page: "#0d0d0d",
    textPrimary: "#ffffff",
    textSecondary: "#c3c2b7",
    textMuted: "#898781",
    gridline: "#2c2c2a",
    baseline: "#383835",
    seriesBlue: "#3987e5",
    seriesBlue100: "#184f95",
    statusGood: "#0ca30c",
    statusWarning: "#fab219",
    statusSerious: "#ec835a",
    statusCritical: "#d03b3b",
  },
} as const;

export type ThemeMode = keyof typeof THEME;
