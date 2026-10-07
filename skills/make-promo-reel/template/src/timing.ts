import type { CaptureManifest, PromoProps, Scene } from "./types";
import { makeTheme } from "./theme";

export function transitionOf(props: PromoProps) {
  const theme = makeTheme(props.mood, props.brand, props.motion);
  const kind = props.transition ?? theme.transition;
  return { kind, frames: kind === "none" ? 0 : theme.transitionFrames };
}

export const leadInOf = (s: Scene) => (s.type !== "shot" ? 0 : (s.leadIn ?? (s.caption ? 1.0 : 0.3)));

export function sceneSeconds(scene: Scene, manifests?: Record<string, CaptureManifest>): number {
  if (scene.type !== "shot") return scene.duration;
  const m = manifests?.[scene.clip];
  const [a, b] = scene.trim ?? [0, m?.duration ?? 4];
  return leadInOf(scene) + (b - a) / (scene.speed ?? 1);
}

// A shot after a cut also gets the transition's length, so its lead-in and action start once
// the transition has finished. Transitions eat into intros and end cards only.
export function sceneFrames(props: PromoProps): number[] {
  const { frames: tf } = transitionOf(props);
  return props.scenes.map((s, i) => Math.max(1, Math.round(sceneSeconds(s, props.manifests) * props.fps) + (s.type === "shot" && i > 0 ? tf : 0)));
}

// Frames into a scene before it is first visible: dip and wipe reveal it halfway through the cut.
export function revealFrames(kind: string, tf: number): number {
  return kind === "slide" ? 0 : Math.round(tf / 2);
}

// The frame at the middle of each cut, where the eye reads the change. sheet.mjs uses these to
// report how cuts sit on the music's beat.
export function cutFrames(props: PromoProps): number[] {
  const frames = sceneFrames(props);
  const { frames: t } = transitionOf(props);
  const cuts: number[] = [];
  let start = 0;
  for (let i = 1; i < frames.length; i++) {
    start += frames[i - 1] - t;
    cuts.push(start + Math.round(t / 2));
  }
  return cuts;
}

// Transitions overlap neighboring scenes, so they shorten the total.
export function totalFrames(props: PromoProps): number {
  const frames = sceneFrames(props);
  const { frames: t } = transitionOf(props);
  const overlap = Math.max(0, frames.length - 1) * t;
  return Math.max(1, frames.reduce((a, b) => a + b, 0) - overlap);
}
