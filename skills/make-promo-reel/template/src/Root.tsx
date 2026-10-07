import React from "react";
import { Composition, staticFile } from "remotion";
import { Promo } from "./Promo";
import { cutFrames, totalFrames } from "./timing";
import type { CaptureManifest, PromoProps } from "./types";
import config from "../public/promo.json";

export const Root: React.FC = () => (
  <Composition
    id="Promo"
    component={Promo}
    defaultProps={config as unknown as PromoProps}
    width={1920}
    height={1080}
    fps={30}
    durationInFrames={300}
    calculateMetadata={async ({ props }) => {
      const clips = [...new Set(props.scenes.flatMap((s) => (s.type === "shot" ? [s.clip] : [])))];
      const manifests: Record<string, CaptureManifest> = {};
      for (const clip of clips) {
        const res = await fetch(staticFile(`captures/${clip}/manifest.json`));
        if (res.ok) manifests[clip] = await res.json();
      }
      const full = { ...props, manifests };
      full.cuts = cutFrames(full);
      return { props: full, durationInFrames: totalFrames(full), width: props.width, height: props.height, fps: props.fps };
    }}
  />
);
