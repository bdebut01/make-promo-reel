import React from "react";
import { Audio, Sequence, staticFile, useVideoConfig } from "remotion";
import type { CaptureManifest, PromoProps } from "../types";

// UI sounds, placed on the capture's own events. Quiet on purpose: they should be felt more
// than heard, and loud clicks are the quickest way to sound amateur.
export type SfxSettings = { kit: "soft" | "round" | "crisp"; gain: number };

const KIT_FOR_MOOD = { clean: "soft", playful: "round", "bold-dark": "crisp" } as const;
export const LEVEL = { click: 0.55, key: 0.22, whoosh: 0.32, chime: 0.42, pop: 0.28 };

export function sfxSettings(props: PromoProps): SfxSettings | null {
  if (props.sfx === false || props.sfx === undefined) return null;
  const kit = !props.sfx.kit || props.sfx.kit === "auto" ? KIT_FOR_MOOD[props.mood] : props.sfx.kit;
  return { kit, gain: props.sfx.volume ?? 1 };
}

export const Sfx: React.FC<{ sfx: SfxSettings; name: string; at: number; level: number }> = ({ sfx, name, at, level }) => {
  const { fps } = useVideoConfig();
  if (at < 0) return null;
  return (
    <Sequence from={at} durationInFrames={Math.round(fps * 1.6)} layout="none">
      <Audio src={staticFile(`sfx/${sfx.kit}/${name}.wav`)} volume={Math.min(1, level * sfx.gain)} />
    </Sequence>
  );
};

// A shot's sounds: a click per click, a key per keystroke, and a chime on the payoff (the last
// focus mark that isn't typing). `at` maps capture time to the scene's frames.
export function shotSounds(m: CaptureManifest, from: number, to: number, at: (t: number) => number) {
  const inRange = (t: number) => t >= from && t <= to;
  const out: { name: string; at: number; level: number }[] = [];
  const clicks = m.clicks.filter((c) => inRange(c.t));
  clicks.forEach((c, i) => out.push({ name: `click-${(i % 3) + 1}`, at: at(c.t), level: LEVEL.click }));
  (m.keys ?? [])
    .filter((k) => inRange(k.t) && !clicks.some((c) => Math.abs(c.t - k.t) < 0.05))
    .forEach((k, i) => out.push({ name: `key-${((i * 5 + 3) % 6) + 1}`, at: at(k.t), level: LEVEL.key * (0.8 + 0.2 * ((i * 7) % 3) / 2) }));
  const payoff = m.focus.filter((f) => inRange(f.from) && f.kind !== "type").slice(-1)[0];
  if (payoff) out.push({ name: "chime", at: at(payoff.from), level: LEVEL.chime });
  return out;
}
