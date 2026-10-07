import React from "react";
import { AbsoluteFill, interpolate } from "remotion";
import type { TransitionPresentation, TransitionPresentationComponentProps } from "@remotion/transitions";

// Scenes are transparent over one shared background, so a plain crossfade would double-expose
// two scenes' text. These keep only one scene visible at a time.

const clamp = { extrapolateLeft: "clamp", extrapolateRight: "clamp" } as const;

// Dip: the outgoing scene clears in the first half, the incoming one appears in the second.
const Dip: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const exiting = presentationDirection === "exiting";
  const opacity = exiting ? interpolate(p, [0, 0.5], [1, 0], clamp) : interpolate(p, [0.5, 1], [0, 1], clamp);
  const y = exiting ? interpolate(p, [0, 0.5], [0, -12], clamp) : interpolate(p, [0.5, 1], [12, 0], clamp);
  return <AbsoluteFill style={{ opacity, transform: `translateY(${y}px)` }}>{children}</AbsoluteFill>;
};

export const dip = (): TransitionPresentation<Record<string, never>> => ({ component: Dip, props: {} });

// Wipe: the two scenes are clipped at the same moving edge, so they never overlap.
const ClipWipe: React.FC<TransitionPresentationComponentProps<Record<string, never>>> = ({ children, presentationDirection, presentationProgress: p }) => {
  const edge = p * 100;
  const clipPath = presentationDirection === "exiting" ? `inset(0 0 0 ${edge}%)` : `inset(0 ${100 - edge}% 0 0)`;
  return <AbsoluteFill style={{ clipPath }}>{children}</AbsoluteFill>;
};

export const clipWipe = (): TransitionPresentation<Record<string, never>> => ({ component: ClipWipe, props: {} });
