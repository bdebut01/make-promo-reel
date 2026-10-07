import React, { useMemo } from "react";
import { Easing, Img, interpolate, staticFile, useCurrentFrame, useVideoConfig } from "remotion";
import type { CaptureManifest, FocusBox } from "../types";
import type { Theme } from "../theme";

type Props = {
  manifest: CaptureManifest;
  clipStart: number; // seconds into the capture where this scene starts
  clipEnd: number;
  leadIn: number; // seconds the first frame holds before playback starts
  speed: number;
  width: number; // display width of the screen area, px
  zoom: "auto" | "all" | "none" | number | FocusBox[];
  zoomScale: number; // the most a zoom will scale; a moment that needs more room zooms less
  pointer: "cursor" | "touch" | "none";
  theme: Theme;
};

// A zoom holds one steady frame for its whole duration, rather than trailing the cursor: a
// camera that chases every move reads as shake.
type Segment = { a: number; b: number; scale: number; x: number; y: number };
type Point = { t: number; x: number; y: number };

const LEAD = 0.45; // start zooming this long before the first event of a moment
const TAIL = 1.1; // stay zoomed this long after the last one
const RAMP = 0.55; // seconds to ease in or out
const CLUSTER_GAP = 1.6; // events closer than this are one moment
const MARGIN = 0.12; // breathing room kept around a moment's events, as a share of the viewport
const MIN_ZOOM = 1.12; // a moment too spread out to zoom further than this stays wide
const ease = Easing.bezier(0.65, 0, 0.35, 1);

function lastIndexAtOrBefore<T extends { t: number }>(arr: T[], t: number): number {
  let lo = 0;
  let hi = arr.length - 1;
  let ans = 0;
  while (lo <= hi) {
    const mid = (lo + hi) >> 1;
    if (arr[mid].t <= t) {
      ans = mid;
      lo = mid + 1;
    } else hi = mid - 1;
  }
  return ans;
}

function pointAt(track: Point[], t: number): { x: number; y: number } | null {
  if (!track.length) return null;
  if (t <= track[0].t) return track[0];
  if (t >= track[track.length - 1].t) return track[track.length - 1];
  const i = lastIndexAtOrBefore(track, t);
  const p = track[i];
  const q = track[i + 1];
  const k = (t - p.t) / Math.max(1e-6, q.t - p.t);
  return { x: p.x + (q.x - p.x) * k, y: p.y + (q.y - p.y) * k };
}

// An element's box as points, so a moment is framed around whole elements, not their centers.
// A box too wide to zoom around (a full-width mobile card) makes that moment stay wide, rather
// than cropping the element; focus a tighter element to get a zoom.
function corners(m: CaptureManifest, cx: number, cy: number, w?: number, h?: number) {
  if (!w || !h) return [];
  return [{ x: cx - w / 2, y: cy - h / 2 }, { x: cx + w / 2, y: cy + h / 2 }];
}

// Frame every point of a moment: centered on their bounding box, zoomed no further than
// `max` and no further than keeps them all in view with a margin.
function fit(pts: { x: number; y: number }[], max: number, vw: number, vh: number) {
  const xs = pts.map((p) => p.x);
  const ys = pts.map((p) => p.y);
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs), Math.min(...ys), Math.max(...ys)];
  const scale = Math.min(max, vw / (x1 - x0 + 2 * MARGIN * vw), vh / (y1 - y0 + 2 * MARGIN * vh));
  return { scale, x: (x0 + x1) / 2, y: (y0 + y1) / 2 };
}

// "auto" = 1: zoom on the last moment with a payoff (a focus mark), else the last moment.
// A number n zooms on the last n moments, "all" on every one.
function autoSegments(m: CaptureManifest, max: number, count: number, from: number, to: number): Segment[] {
  const inRange = (t: number) => t >= from && t <= to;
  const events = [
    ...m.clicks.filter((c) => inRange(c.t)).map((c) => ({ a: c.t, b: c.t, payoff: false, pts: [{ x: c.x, y: c.y }, ...corners(m, c.cx ?? c.x, c.cy ?? c.y, c.w, c.h)] })),
    ...m.focus.filter((f) => inRange(f.from)).map((f) => ({ a: f.from, b: Math.min(f.to, to), payoff: true, pts: [{ x: f.x, y: f.y }, ...corners(m, f.x, f.y, f.w, f.h)] })),
  ].sort((p, q) => p.a - q.a);
  const moments: typeof events = [];
  for (const e of events) {
    const last = moments[moments.length - 1];
    if (last && e.a - last.b < CLUSTER_GAP) {
      last.b = Math.max(last.b, e.b);
      last.payoff = last.payoff || e.payoff;
      last.pts.push(...e.pts);
    } else moments.push({ ...e, pts: [...e.pts] });
  }
  const payoffs = moments.filter((c) => c.payoff);
  const chosen = (payoffs.length >= Math.min(count, moments.length) ? payoffs : moments).slice(-count);
  return chosen
    .map((c) => ({ a: c.a - LEAD, b: c.b + TAIL, ...fit(c.pts, max, m.viewport.width, m.viewport.height) }))
    .filter((g) => g.scale >= MIN_ZOOM);
}

function manualSegments(boxes: FocusBox[], clipStart: number, max: number): Segment[] {
  return boxes.map((b) => ({ a: b.from + clipStart, b: b.to + clipStart, scale: b.scale ?? max, x: b.x, y: b.y }));
}

function amount(g: Segment, t: number): number {
  const up = interpolate(t, [g.a, g.a + RAMP], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  const down = interpolate(t, [g.b, g.b + RAMP], [1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: ease });
  return Math.min(up, down);
}

// Scale and center at time t. Where two zooms' ramps overlap, the center glides between their
// frames. Pure per frame, so parallel rendering agrees.
function cameraAt(segs: Segment[], t: number, vw: number, vh: number) {
  let s = 1;
  let w = 0;
  let x = 0;
  let y = 0;
  for (const g of segs) {
    const a = amount(g, t);
    s = Math.max(s, 1 + (g.scale - 1) * a);
    w += a;
    x += g.x * a;
    y += g.y * a;
  }
  return w > 0 ? { s, x: x / w, y: y / w } : { s, x: vw / 2, y: vh / 2 };
}

const Cursor: React.FC<{ size: number; press: number }> = ({ size, press }) => (
  <svg width={size} height={size * 1.4} viewBox="0 0 20 28" style={{ transform: `scale(${press})`, transformOrigin: "2px 2px", filter: "drop-shadow(0 2px 3px rgba(0,0,0,0.35))" }}>
    <path d="M2 2 L2 22 L7 17.5 L10.5 25.5 L13.8 24 L10.4 16.2 L17 16.2 Z" fill="#111" stroke="#fff" strokeWidth={1.6} strokeLinejoin="round" />
  </svg>
);

export const ScreenClip: React.FC<Props> = ({ manifest: m, clipStart, clipEnd, leadIn, speed, width, zoom, zoomScale, pointer, theme }) => {
  const frame = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = clipStart + Math.max(0, frame / fps - leadIn) * speed;
  const k = width / m.viewport.width;
  const height = m.viewport.height * k;

  const segs = useMemo(() => {
    if (zoom === "none" || zoom === 0) return [];
    if (Array.isArray(zoom)) return manualSegments(zoom, clipStart, zoomScale);
    const count = zoom === "all" ? Infinity : zoom === "auto" ? 1 : zoom;
    return autoSegments(m, zoomScale, count, clipStart, clipEnd);
  }, [m, zoom, zoomScale, clipStart, clipEnd]);

  const img = m.frames[lastIndexAtOrBefore(m.frames, t)];
  const cursor = pointAt(m.cursor, t);
  const { s, ...f } = cameraAt(segs, t, m.viewport.width, m.viewport.height);
  const tx = Math.min(0, Math.max(width - width * s, width / 2 - f.x * k * s));
  const ty = Math.min(0, Math.max(height - height * s, height / 2 - f.y * k * s));

  const recent = m.clicks.filter((c) => t >= c.t - 0.2 && t <= c.t + 0.6);
  const pressing = m.clicks.some((c) => Math.abs(t - c.t) < 0.09);

  return (
    <div style={{ position: "relative", width, height, overflow: "hidden", background: "#fff" }}>
      <div style={{ position: "absolute", left: 0, top: 0, width, height, transformOrigin: "0 0", transform: `translate(${tx}px, ${ty}px) scale(${s})` }}>
        {img ? <Img src={staticFile(`captures/${m.name}/${img.file}`)} style={{ width, height, display: "block" }} /> : null}
        {pointer !== "none" &&
          recent.map((c, i) => {
            const p = interpolate(t, [c.t, c.t + 0.5], [0, 1], { extrapolateLeft: "clamp", extrapolateRight: "clamp", easing: Easing.out(Easing.cubic) });
            if (t < c.t) return null;
            const r = (pointer === "touch" ? 34 : 26) * k * (0.4 + p);
            return (
              <div key={i} style={{ position: "absolute", left: c.x * k - r, top: c.y * k - r, width: r * 2, height: r * 2, borderRadius: "50%", border: `${2.5 * k}px solid ${theme.primary}`, background: `${theme.primary}33`, opacity: 1 - p }} />
            );
          })}
        {pointer === "cursor" && cursor ? (
          <div style={{ position: "absolute", left: cursor.x * k - 2 * k * 1.2, top: cursor.y * k - 2 * k * 1.2 }}>
            <Cursor size={20 * k * 1.2} press={pressing ? 0.84 : 1} />
          </div>
        ) : null}
        {pointer === "touch"
          ? recent.map((c, i) => {
              const o = interpolate(t, [c.t - 0.2, c.t - 0.05, c.t + 0.25, c.t + 0.45], [0, 1, 1, 0], { extrapolateLeft: "clamp", extrapolateRight: "clamp" });
              const r = 22 * k;
              return <div key={`t${i}`} style={{ position: "absolute", left: c.x * k - r, top: c.y * k - r, width: r * 2, height: r * 2, borderRadius: "50%", background: "rgba(255,255,255,0.55)", border: `${2 * k}px solid rgba(0,0,0,0.25)`, opacity: o }} />;
            })
          : null}
      </div>
    </div>
  );
};
