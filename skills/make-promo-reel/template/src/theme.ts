import { loadFont as loadInter } from "@remotion/google-fonts/Inter";
import { loadFont as loadNunito } from "@remotion/google-fonts/Nunito";
import { loadFont as loadSpaceGrotesk } from "@remotion/google-fonts/SpaceGrotesk";
import type { Brand, Mood } from "./types";

const inter = loadInter("normal", { weights: ["500", "600", "700", "800"], subsets: ["latin"] });
const nunito = loadNunito("normal", { weights: ["600", "800", "900"], subsets: ["latin"] });
const grotesk = loadSpaceGrotesk("normal", { weights: ["500", "700"], subsets: ["latin"] });

export type Theme = {
  mood: Mood;
  font: string;
  headlineFont: string;
  headlineWeight: number;
  bodyWeight: number;
  text: string;
  muted: string;
  bgBase: string;
  bgGlow: string;
  primary: string;
  accent: string;
  // spring config for entrances; low damping = bouncier
  spring: { damping: number; stiffness: number; mass: number };
  transition: "fade" | "slide" | "wipe" | "none";
  transitionFrames: number;
  radius: number;
  shadow: string;
  letterSpacing: string;
};

function mix(hex: string, other: string, amount: number): string {
  const p = (h: string) => {
    const s = h.replace("#", "");
    const n = s.length === 3 ? s.split("").map((c) => c + c).join("") : s;
    return [0, 2, 4].map((i) => parseInt(n.slice(i, i + 2), 16));
  };
  const a = p(hex);
  const b = p(other);
  const c = a.map((v, i) => Math.round(v + (b[i] - v) * amount));
  return `#${c.map((v) => v.toString(16).padStart(2, "0")).join("")}`;
}

const MOTION = {
  gentle: { damping: 200, stiffness: 120, mass: 1 },
  bouncy: { damping: 12, stiffness: 140, mass: 0.8 },
  snappy: { damping: 22, stiffness: 220, mass: 0.7 },
} as const;

export function makeTheme(mood: Mood, brand: Brand, motion?: keyof typeof MOTION): Theme {
  const theme = baseTheme(mood, brand);
  if (brand.text) theme.text = brand.text;
  if (brand.muted) theme.muted = brand.muted;
  if (brand.radius != null) theme.radius = brand.radius;
  if (brand.shadow) theme.shadow = brand.shadow;
  return motion ? { ...theme, spring: { ...MOTION[motion] } } : theme;
}

function baseTheme(mood: Mood, brand: Brand): Theme {
  const primary = brand.primary;
  const accent = brand.accent ?? primary;
  if (mood === "playful") {
    return {
      mood,
      font: brand.font ?? nunito.fontFamily,
      headlineFont: brand.headlineFont ?? brand.font ?? nunito.fontFamily,
      headlineWeight: 900,
      bodyWeight: 700,
      text: "#ffffff",
      muted: "rgba(255,255,255,0.82)",
      bgBase: brand.background ?? primary,
      bgGlow: mix(accent, "#ffffff", 0.35),
      primary,
      accent,
      spring: { damping: 11, stiffness: 140, mass: 0.8 },
      transition: "slide",
      transitionFrames: 14,
      radius: 22,
      shadow: "0 40px 90px rgba(0,0,0,0.28), 0 12px 30px rgba(0,0,0,0.18)",
      letterSpacing: "-0.01em",
    };
  }
  if (mood === "bold-dark") {
    return {
      mood,
      font: brand.font ?? grotesk.fontFamily,
      headlineFont: brand.headlineFont ?? brand.font ?? grotesk.fontFamily,
      headlineWeight: 700,
      bodyWeight: 500,
      text: "#f8fafc",
      muted: "rgba(248,250,252,0.66)",
      bgBase: brand.background ?? "#07080c",
      bgGlow: accent,
      primary,
      accent,
      spring: { damping: 22, stiffness: 220, mass: 0.7 },
      transition: "wipe",
      transitionFrames: 10,
      radius: 14,
      shadow: `0 0 0 1px rgba(255,255,255,0.08), 0 40px 120px ${mix(accent, "#000000", 0.4)}66`,
      letterSpacing: "-0.03em",
    };
  }
  return {
    mood,
    font: brand.font ?? inter.fontFamily,
    headlineFont: brand.headlineFont ?? brand.font ?? inter.fontFamily,
    headlineWeight: 700,
    bodyWeight: 500,
    text: "#0f172a",
    muted: "#475569",
    bgBase: brand.background ?? "#f6f7fb",
    bgGlow: mix(primary, "#ffffff", 0.55),
    primary,
    accent,
    spring: { damping: 200, stiffness: 120, mass: 1 },
    transition: "fade",
    transitionFrames: 12,
    radius: 16,
    shadow: "0 30px 80px rgba(15,23,42,0.18), 0 8px 24px rgba(15,23,42,0.10)",
    letterSpacing: "-0.02em",
  };
}
