import React from "react";
import { interpolate, spring, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../theme";

// Words rise in one after another. Wrap a word or phrase in *asterisks* ("Ask in *one tap*")
// to give it the accent treatment.
export const Kinetic: React.FC<{
  text: string;
  theme: Theme;
  size: number;
  weight?: number;
  font?: string; // defaults to the headline font
  color?: string;
  delay?: number; // frames
  stagger?: number; // frames between words
  align?: "center" | "left";
}> = ({ text, theme, size, weight, font, color, delay = 0, stagger = 3, align = "center" }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  let open = false;
  const words = text.split(/\s+/).filter(Boolean).map((raw) => {
    const starts = raw.startsWith("*");
    const ends = /\*[.,!?:;]?$/.test(raw);
    const hot = open || starts;
    open = (open || starts) && !ends;
    return { word: raw.replace(/\*/g, ""), hot };
  });
  return (
    // Block layout with inline-block words so text-wrap: balance can even out the lines,
    // instead of leaving one word alone on the second.
    <div style={{ display: "block", textWrap: "balance", wordSpacing: size * 0.02, fontFamily: font ?? theme.headlineFont, fontSize: size, fontWeight: weight ?? theme.headlineWeight, letterSpacing: theme.letterSpacing, lineHeight: 1.08, color: color ?? theme.text, textAlign: align }}>
      {words.map(({ word, hot }, i) => {
        const p = spring({ frame: frame - delay - i * stagger, fps, config: theme.spring });
        const y = interpolate(p, [0, 1], [size * 0.5, 0]);
        const o = interpolate(p, [0, 0.6], [0, 1], { extrapolateRight: "clamp" });
        const hotStyle: React.CSSProperties = !hot
          ? {}
          : theme.mood === "playful"
            ? { background: "#ffffff", color: theme.primary, borderRadius: size * 0.22, padding: `0 ${size * 0.2}px` }
            : theme.mood === "bold-dark"
              ? { color: theme.accent, textShadow: `0 0 ${size * 0.5}px ${theme.accent}88` }
              : { color: theme.primary };
        return (
          <span key={i} style={{ display: "inline-block", margin: `${size * 0.03}px ${size * 0.13}px`, transform: `translateY(${y}px)`, opacity: o, ...hotStyle }}>
            {word}
          </span>
        );
      })}
    </div>
  );
};
