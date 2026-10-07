import React, { useEffect, useState } from "react";
import { AbsoluteFill, Audio, Easing, cancelRender, continueRender, delayRender, interpolate, staticFile, useVideoConfig } from "remotion";
import { TransitionSeries, linearTiming, type TransitionPresentation } from "@remotion/transitions";
import { slide } from "@remotion/transitions/slide";
import { Background } from "./components/Chrome";
import { EndCard, Intro, Shot } from "./components/Scenes";
import { clipWipe, dip } from "./transitions";
import { LEVEL, Sfx, sfxSettings } from "./components/Sound";
import { makeTheme } from "./theme";
import { revealFrames, sceneFrames, transitionOf } from "./timing";
import type { PromoProps } from "./types";

// The app's own fonts (brand.fonts), loaded before any frame renders so text never flashes a fallback.
function useBrandFonts(fonts: PromoProps["brand"]["fonts"]) {
  const [handle] = useState(() => (fonts?.length ? delayRender("brand fonts") : null));
  useEffect(() => {
    if (handle === null || !fonts) return;
    Promise.all(
      fonts.map((f) =>
        new FontFace(f.family, `url(${staticFile(f.src)})`, { weight: String(f.weight ?? "normal"), style: f.style ?? "normal" })
          .load()
          .then((face) => document.fonts.add(face)),
      ),
    )
      .then(() => continueRender(handle))
      .catch((err) => cancelRender(err));
  }, [fonts, handle]);
}

export const Promo: React.FC<PromoProps> = (props) => {
  const { fps, durationInFrames } = useVideoConfig();
  useBrandFonts(props.brand.fonts);
  const theme = makeTheme(props.mood, props.brand, props.motion);
  const frames = sceneFrames(props);
  const { kind, frames: tf } = transitionOf(props);
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const presentation: TransitionPresentation<any> = kind === "slide" ? slide({ direction: "from-right" }) : kind === "wipe" ? clipWipe() : dip();
  const timing = linearTiming({ durationInFrames: tf, easing: Easing.bezier(0.65, 0, 0.35, 1) });

  const reveal = revealFrames(kind, tf);
  const music = props.music;
  const fadeIn = Math.round(fps * 0.6);
  const fadeOut = Math.round(fps * 1.2);
  const sfx = sfxSettings(props);
  // Where each scene starts in the whole video: transitions overlap neighbors by tf frames.
  const starts = frames.map((_, i) => frames.slice(0, i).reduce((a, b) => a + b, 0) - i * tf);
  const last = props.scenes.length - 1;
  const endStart = props.scenes[last]?.type === "end" ? starts[last] : durationInFrames;

  return (
    <AbsoluteFill style={{ background: theme.bgBase }}>
      <Background theme={theme} />
      <TransitionSeries>
        {props.scenes.flatMap((scene, i) => {
          // Entrances wait until the scene is revealed; the opening scene gets a head start so
          // the very first frame (the thumbnail, the autoplay poster) already shows the brand.
          const enter = i > 0 ? reveal : 0;
          const settle = i > 0 && scene.type === "shot" ? tf : 0;
          const body =
            scene.type === "intro" ? (
              <Intro scene={scene} theme={theme} brand={props.brand} enter={enter} headStart={i === 0} />
            ) : scene.type === "end" ? (
              <EndCard scene={scene} theme={theme} brand={props.brand} enter={enter} sfx={sfx} />
            ) : (
              <Shot scene={scene} manifest={props.manifests?.[scene.clip]} theme={theme} brand={props.brand} enter={enter} settle={settle} sfx={sfx} />
            );
          const seq = (
            <TransitionSeries.Sequence key={`s${i}`} durationInFrames={frames[i]}>
              {body}
            </TransitionSeries.Sequence>
          );
          return i > 0 && tf > 0 ? [<TransitionSeries.Transition key={`t${i}`} presentation={presentation} timing={timing} />, seq] : [seq];
        })}
      </TransitionSeries>
      {/* a soft whoosh on each cut, leading the picture by a couple of frames */}
      {sfx && tf > 0 ? starts.slice(1).map((s, i) => <Sfx key={`w${i}`} sfx={sfx} name="whoosh" at={Math.max(0, s - 2)} level={LEVEL.whoosh} />) : null}
      {music ? (
        <Audio
          src={staticFile(music.src)}
          startFrom={Math.round((music.startAt ?? 0) * fps)}
          // A bed under the picture: fade in, sit low, lift a little into the end card, fade out.
          volume={(f) =>
            (music.volume ?? 0.55) *
            interpolate(f, [0, fadeIn, durationInFrames - fadeOut, durationInFrames], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" }) *
            interpolate(f, [endStart, endStart + fps * 0.5], [1, 1.2], { extrapolateLeft: "clamp", extrapolateRight: "clamp" })
          }
        />
      ) : null}
    </AbsoluteFill>
  );
};
