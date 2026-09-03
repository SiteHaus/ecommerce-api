import type { TailwindConfig } from "react-email";

/**
 * Palette lifted from the sitehaus.dev design tokens (light theme).
 *
 * The site defines most tokens twice — a hex value and an `oklch()` value.
 * Email clients are unreliable on `oklch()`, so these are the hex ones only.
 * The `--line-*` tokens on the site are 8-digit alpha hex (`#3c2a2029`), which
 * Outlook and older clients drop entirely, so they're pre-flattened here over
 * the parchment background.
 */
export const sitehausColors = {
  /** --background */
  parchment: "#fbf6ee",
  parchment100: "#f5eee0",
  /** --muted */
  parchment200: "#ece2cf",
  parchment300: "#dfd2b8",
  /** --card / --bg-raised */
  raised: "#fffdf8",

  /** --foreground */
  ink: "#2a211c",
  ink700: "#4a3d36",
  ink500: "#7a6a60",
  ink300: "#b6a89e",

  /** --secondary */
  clay100: "#e6d6c5",
  clay300: "#b89a82",
  clay500: "#8c6a52",
  /** --muted-foreground */
  clay700: "#5c4233",
  clay900: "#3a2a20",

  /** --primary */
  terracotta: "#c25e3a",
  /** --primary-foreground */
  terracottaForeground: "#fbf6ee",
  /** --destructive */
  destructive: "#b0432b",

  /** --accent */
  rose100: "#f1d9d2",
  rose300: "#dda9a0",
  rose500: "#c8847a",
  rose700: "#98564e",

  sage100: "#dde2d2",
  sage500: "#8a9a77",
  sage700: "#566348",

  /** --line-soft, flattened */
  lineSoft: "#ece6de",
  /** --line, flattened */
  line: "#dcd5cd",
  /** --line-strong, flattened */
  lineStrong: "#bdb4ac",
} as const;

/**
 * Pass to `<Tailwind config={tailwindConfig}>` so templates can use semantic
 * class names (`bg-parchment`, `text-ink-500`, `border-line`) instead of
 * repeating hex literals. No `pixelBasedPreset` — the existing templates were
 * written against the default rem spacing scale and adding it would silently
 * resize every margin.
 */
export const tailwindConfig: TailwindConfig = {
  theme: {
    extend: {
      colors: {
        parchment: {
          DEFAULT: sitehausColors.parchment,
          100: sitehausColors.parchment100,
          200: sitehausColors.parchment200,
          300: sitehausColors.parchment300,
        },
        raised: sitehausColors.raised,
        ink: {
          DEFAULT: sitehausColors.ink,
          700: sitehausColors.ink700,
          500: sitehausColors.ink500,
          300: sitehausColors.ink300,
        },
        clay: {
          100: sitehausColors.clay100,
          300: sitehausColors.clay300,
          500: sitehausColors.clay500,
          700: sitehausColors.clay700,
          900: sitehausColors.clay900,
        },
        terracotta: {
          DEFAULT: sitehausColors.terracotta,
          foreground: sitehausColors.terracottaForeground,
        },
        destructive: sitehausColors.destructive,
        rose: {
          100: sitehausColors.rose100,
          300: sitehausColors.rose300,
          500: sitehausColors.rose500,
          700: sitehausColors.rose700,
        },
        sage: {
          100: sitehausColors.sage100,
          500: sitehausColors.sage500,
          700: sitehausColors.sage700,
        },
        line: {
          DEFAULT: sitehausColors.line,
          soft: sitehausColors.lineSoft,
          strong: sitehausColors.lineStrong,
        },
      },
    },
  },
};
