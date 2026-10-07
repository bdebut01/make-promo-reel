import React from "react";
import { AbsoluteFill, Img, interpolate, spring, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../theme";
import type { Brand, CaptureManifest, EndScene, IntroScene, ShotScene } from "../types";
import { BrowserFrame, PhoneFrame } from "./Chrome";
import { Kinetic } from "./Caption";
import { ScreenClip } from "./ScreenClip";
import { leadInOf } from "../timing";
import { LEVEL, Sfx, type SfxSettings, shotSounds } from "./Sound";

type Layout = "landscape" | "square" | "portrait";

// End-card bubble positions (fractions of width, height), clear of the centered logo, headline
// and CTA. In portrait they fill the bands above and below the text column.
const SPOTS: Record<Layout, [number, number][]> = {
  landscape: [[0.1, 0.22], [0.9, 0.22], [0.12, 0.8], [0.88, 0.8], [0.27, 0.1], [0.73, 0.1], [0.28, 0.9], [0.72, 0.9], [0.05, 0.5], [0.95, 0.5], [0.44, 0.06], [0.56, 0.94]],
  square: [[0.14, 0.14], [0.86, 0.14], [0.14, 0.87], [0.86, 0.87], [0.38, 0.07], [0.62, 0.93], [0.07, 0.42], [0.93, 0.6], [0.62, 0.07], [0.38, 0.93], [0.07, 0.64], [0.93, 0.38]],
  portrait: [[0.2, 0.13], [0.8, 0.13], [0.18, 0.8], [0.82, 0.8], [0.5, 0.09], [0.5, 0.87], [0.12, 0.26], [0.88, 0.27], [0.4, 0.23], [0.62, 0.74], [0.1, 0.68], [0.9, 0.67]],
};
const layoutOf = (w: number, h: number): Layout => (w / h > 1.2 ? "landscape" : w / h < 0.85 ? "portrait" : "square");

const Logo: React.FC<{ brand: Brand; height: number; delay?: number; theme: Theme }> = ({ brand, height, delay = 0, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const p = spring({ frame: frame - delay, fps, config: { ...theme.spring, damping: Math.min(theme.spring.damping, 14) } });
  if (!brand.logo) return null;
  return <Img src={staticFile(brand.logo)} style={{ height, transform: `scale(${interpolate(p, [0, 1], [0.6, 1])})`, opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }) }} />;
};

// `enter`: frames before the scene is revealed. `headStart`: the video opens on this scene, so
// its entrances begin already underway and frame 0 shows the brand.
export const Intro: React.FC<{ scene: IntroScene; theme: Theme; brand: Brand; enter: number; headStart?: boolean }> = ({ scene, theme, brand, enter, headStart }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const layout = layoutOf(width, height);
  const size = layout === "portrait" ? width * 0.1 : height * 0.085;
  const d0 = enter - (headStart ? 10 : 0);
  const art = spring({ frame: frame - d0, fps, config: { ...theme.spring, damping: Math.min(theme.spring.damping, 14) } });
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: size * 0.5, padding: width * 0.08 }}>
        {scene.art ? <Img src={staticFile(scene.art)} style={{ maxHeight: height * (layout === "portrait" ? 0.26 : 0.3), maxWidth: width * 0.7, transform: `translateY(${interpolate(art, [0, 1], [size * 0.6, 0])}px) scale(${interpolate(art, [0, 1], [0.85, 1])})`, opacity: interpolate(art, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }) }} /> : null}
        <Logo brand={brand} height={size * 1.4} theme={theme} delay={d0 + (scene.art ? 6 : 0)} />
        <Kinetic text={scene.headline} theme={theme} size={size} delay={d0 + (brand.logo ? 8 : 0) + (scene.art ? 6 : 0)} />
        {scene.sub ? <Kinetic text={scene.sub} theme={theme} size={size * 0.4} weight={theme.bodyWeight} font={theme.font} color={theme.muted} delay={d0 + (brand.logo ? 18 : 10) + (scene.art ? 6 : 0)} stagger={1} /> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

export const EndCard: React.FC<{ scene: EndScene; theme: Theme; brand: Brand; enter: number; sfx?: SfxSettings | null }> = ({ scene, theme, brand, enter, sfx }) => {
  const frame = useCurrentFrame() - enter;
  const { fps, width, height } = useVideoConfig();
  const layout = layoutOf(width, height);
  const size = layout === "portrait" ? width * 0.09 : height * 0.075;
  const p = spring({ frame: frame - 16, fps, config: theme.spring });
  const onBrand = theme.mood === "playful";
  // Photo bubbles fill the space around the card and bob gently. The spots are listed so the
  // first few spread evenly: any count from 4 to 12 looks balanced.
  const spots = SPOTS[layout];
  const photos = (scene.photos ?? []).slice(0, spots.length);
  const bubble = Math.min(width, height) * (layout === "portrait" ? 0.23 : layout === "square" ? 0.17 : 0.16);
  return (
    <AbsoluteFill>
      {sfx ? photos.slice(0, 6).map((src, i) => <Sfx key={`pop${src}`} sfx={sfx} name={`pop-${(i % 2) + 1}`} at={enter + 4 + i * 3} level={LEVEL.pop} />) : null}
      {photos.map((src, i) => {
        const [x, y] = spots[i];
        const p = spring({ frame: frame - 4 - i * 3, fps, config: theme.spring });
        const bob = Math.sin((frame + i * 17) / (fps * 0.9)) * bubble * 0.04;
        const d = bubble * (i % 3 === 0 ? 1 : i % 3 === 1 ? 0.84 : 0.7);
        return <Img key={src} src={staticFile(src)} style={{ position: "absolute", left: x * width - d / 2, top: y * height - d / 2 + bob, width: d, height: d, objectFit: "cover", borderRadius: "50%", border: `${d * 0.04}px solid #ffffff`, boxShadow: "0 10px 30px rgba(0,0,0,0.18)", transform: `scale(${p})`, opacity: p }} />;
      })}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: "center", gap: size * 0.45, padding: width * 0.08 }}>
        <Logo brand={brand} height={size * 1.6} theme={theme} delay={enter} />
        <Kinetic text={scene.headline} theme={theme} size={size} delay={enter + 6} />
        {scene.cta ? (
          <div style={{ marginTop: size * 0.2, transform: `translateY(${interpolate(p, [0, 1], [size * 0.4, 0])}px) scale(${interpolate(p, [0, 1], [0.9, 1])})`, opacity: interpolate(p, [0, 0.5], [0, 1], { extrapolateRight: "clamp" }), background: onBrand ? "#ffffff" : theme.primary, color: onBrand ? theme.primary : "#ffffff", fontFamily: theme.headlineFont, fontWeight: theme.headlineWeight, fontSize: size * 0.42, padding: `${size * 0.22}px ${size * 0.6}px`, borderRadius: size, boxShadow: `0 ${size * 0.15}px ${size * 0.5}px ${theme.primary}55` }}>
            {scene.cta}
          </div>
        ) : null}
        {brand.url ? <div style={{ fontFamily: theme.font, fontWeight: theme.bodyWeight, fontSize: size * 0.34, color: theme.muted, opacity: interpolate(frame, [24, 34], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) }}>{brand.url}</div> : null}
      </AbsoluteFill>
    </AbsoluteFill>
  );
};

// `enter`: frames before the scene is revealed. `settle`: frames until the incoming transition
// has finished, which the lead-in waits out so the caption lands on a settled, still screen.
export const Shot: React.FC<{ scene: ShotScene; manifest?: CaptureManifest; theme: Theme; brand: Brand; enter: number; settle: number; sfx?: SfxSettings | null }> = ({ scene, manifest, theme, brand, enter: reveal, settle, sfx }) => {
  const frame = useCurrentFrame();
  const { fps, width: W, height: H, durationInFrames } = useVideoConfig();
  if (!manifest) {
    return (
      <AbsoluteFill style={{ background: "#300", color: "#fff", fontSize: 48, alignItems: "center", justifyContent: "center" }}>
        Missing capture: {scene.clip}
      </AbsoluteFill>
    );
  }
  const layout = layoutOf(W, H);
  const frameKind = scene.frame ?? (manifest.viewport.width < 600 ? "phone" : "browser");
  const pointer = scene.pointer ?? (frameKind === "phone" ? "touch" : "cursor");
  const capSize = layout === "portrait" ? W * 0.068 : layout === "square" ? W * 0.058 : H * 0.058;
  const hasCaption = Boolean(scene.caption);
  const band = hasCaption ? capSize * (scene.sub ? 2.2 : 1.35) * (layout === "portrait" ? 1.6 : 1) : 0;
  const gap = H * 0.035;
  // Vertical social formats overlay their own UI: keep text below the top 13% (profile bar)
  // and above the bottom 20% (reply bar).
  const safeTop = layout === "portrait" ? H * 0.13 : 0;
  const safeBottom = layout === "portrait" ? H * 0.2 : 0;
  // In portrait a phone is too tall to fit whole at a useful size, so it rises from the bottom
  // edge and bleeds off it. Keep a shot's action in the top ~60% of the mobile screen.
  const bleed = layout === "portrait" && frameKind === "phone" && scene.bleed !== false;
  const aw = W * (layout === "portrait" ? 0.88 : 0.9);
  const ah = layout === "portrait" ? H - safeTop - safeBottom - band - gap : H * 0.86 - band;
  const vr = manifest.viewport.height / manifest.viewport.width;
  const wx = frameKind === "phone" ? 0.07 : 0;
  const hx = frameKind === "browser" ? 0.032 : frameKind === "phone" ? 0.07 : 0;
  const inner = scene.phoneWidth ? W * scene.phoneWidth : bleed ? W * 0.72 : Math.min(aw / (1 + wx), ah / (vr + hx));

  const enter = spring({ frame: frame - reveal, fps, config: theme.spring, durationInFrames: 20 });
  const push = interpolate(frame, [0, durationInFrames], [1, 1.015]);
  const tilt = theme.mood === "bold-dark" ? interpolate(enter, [0, 1], [14, 0]) : 0;
  const host = brand.url ?? (manifest.url ? manifest.url.replace(/^https?:\/\//, "").replace(/\/$/, "") : undefined);

  const screen = (
    <ScreenClip manifest={manifest} clipStart={scene.trim?.[0] ?? 0} clipEnd={scene.trim?.[1] ?? manifest.duration} leadIn={leadInOf(scene) + settle / fps} speed={scene.speed ?? 1} width={inner} zoom={scene.zoom ?? "auto"} zoomScale={scene.zoomScale ?? (frameKind === "phone" ? 1.25 : 1.4)} pointer={pointer} theme={theme} />
  );

  const clipStart = scene.trim?.[0] ?? 0;
  const clipEnd = scene.trim?.[1] ?? manifest.duration;
  const lead = leadInOf(scene) + settle / fps;
  const sounds = sfx ? shotSounds(manifest, clipStart, clipEnd, (t) => Math.round((lead + (t - clipStart) / (scene.speed ?? 1)) * fps)) : [];

  return (
    <AbsoluteFill>
      {sfx ? sounds.map((s, i) => <Sfx key={i} sfx={sfx} {...s} />) : null}
      <AbsoluteFill style={{ alignItems: "center", justifyContent: layout === "portrait" ? "flex-start" : "center", flexDirection: "column", gap, paddingTop: safeTop, overflow: "hidden" }}>
        {hasCaption ? (
          <div style={{ width: W * 0.86, display: "flex", flexDirection: "column", gap: capSize * 0.25 }}>
            <Kinetic text={scene.caption!} theme={theme} size={capSize} delay={reveal + 4} />
            {scene.sub ? <Kinetic text={scene.sub} theme={theme} size={capSize * 0.45} weight={theme.bodyWeight} font={theme.font} color={theme.muted} delay={reveal + 12} stagger={1} /> : null}
          </div>
        ) : null}
        <div style={{ perspective: 1600 }}>
          <div style={{ transform: `translateY(${interpolate(enter, [0, 1], [H * 0.05, 0])}px) rotateX(${tilt}deg) scale(${interpolate(enter, [0, 1], [0.96, 1]) * push})`, opacity: interpolate(enter, [0, 0.4], [0, 1], { extrapolateRight: "clamp" }) }}>
            {frameKind === "browser" ? (
              <BrowserFrame theme={theme} width={inner} url={host}>
                {screen}
              </BrowserFrame>
            ) : frameKind === "phone" ? (
              <PhoneFrame theme={theme} width={inner}>
                {screen}
              </PhoneFrame>
            ) : (
              <div style={{ borderRadius: theme.radius, overflow: "hidden", boxShadow: theme.shadow }}>{screen}</div>
            )}
          </div>
        </div>
      </AbsoluteFill>
    </AbsoluteFill>
  );
};
