import React from "react";
import { AbsoluteFill, interpolate, useCurrentFrame, useVideoConfig } from "remotion";
import type { Theme } from "../theme";

// Slow-drifting glow behind everything, drawn once under all scenes so it runs continuously
// across cuts.
export const Background: React.FC<{ theme: Theme }> = ({ theme }) => {
  const frame = useCurrentFrame();
  const { width, height, fps } = useVideoConfig();
  const p = frame / (fps * 30); // one slow drift over 30s, whatever the video's length
  const x = interpolate(p, [0, 1], [30, 70], { extrapolateRight: "clamp" });
  const y = interpolate(Math.sin(p * Math.PI * 2), [-1, 1], [25, 45]);
  const dark = theme.mood === "bold-dark";
  return (
    <AbsoluteFill style={{ background: theme.bgBase, overflow: "hidden" }}>
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${width * 0.9}px ${height * 0.8}px at ${x}% ${y}%, ${theme.bgGlow}${dark ? "55" : "cc"} 0%, transparent 70%)`,
        }}
      />
      <AbsoluteFill
        style={{
          background: `radial-gradient(ellipse ${width * 0.6}px ${height * 0.6}px at ${100 - x}% ${100 - y / 2}%, ${theme.accent}${dark ? "33" : "22"} 0%, transparent 70%)`,
        }}
      />
    </AbsoluteFill>
  );
};

export const BrowserFrame: React.FC<{ theme: Theme; width: number; url?: string; children: React.ReactNode }> = ({ theme, width, url, children }) => {
  const bar = Math.max(28, width * 0.032);
  const dark = theme.mood === "bold-dark";
  const dot = bar * 0.26;
  return (
    <div style={{ width, borderRadius: theme.radius, overflow: "hidden", boxShadow: theme.shadow, background: dark ? "#16181f" : "#ffffff" }}>
      <div style={{ height: bar, display: "flex", alignItems: "center", padding: `0 ${bar * 0.45}px`, gap: dot * 0.7, background: dark ? "#1b1d25" : "#eef0f4", borderBottom: dark ? "1px solid #2a2d38" : "1px solid #e2e5eb" }}>
        {["#ff5f57", "#febc2e", "#28c840"].map((c) => (
          <div key={c} style={{ width: dot, height: dot, borderRadius: "50%", background: c }} />
        ))}
        {url ? (
          <div style={{ flex: 1, display: "flex", justifyContent: "center" }}>
            <div style={{ height: bar * 0.62, minWidth: width * 0.32, borderRadius: bar, background: dark ? "#262935" : "#ffffff", color: dark ? "#9aa3b5" : "#64748b", fontFamily: theme.font, fontSize: bar * 0.36, fontWeight: 500, display: "flex", alignItems: "center", justifyContent: "center", padding: `0 ${bar * 0.6}px` }}>
              {url}
            </div>
          </div>
        ) : null}
        {url ? <div style={{ width: dot * 3 + dot * 1.4 }} /> : null}
      </div>
      {children}
    </div>
  );
};

export const PhoneFrame: React.FC<{ theme: Theme; width: number; children: React.ReactNode }> = ({ theme, width, children }) => {
  const bezel = Math.max(8, width * 0.035);
  return (
    <div style={{ padding: bezel, borderRadius: width * 0.14, background: "#0b0b0f", boxShadow: `${theme.shadow}, inset 0 0 0 2px #2b2b33` }}>
      <div style={{ borderRadius: width * 0.14 - bezel, overflow: "hidden" }}>{children}</div>
    </div>
  );
};

export const frameExtraHeight = (frame: "browser" | "phone" | "none", innerWidth: number) =>
  frame === "browser" ? Math.max(28, innerWidth * 0.032) : frame === "phone" ? Math.max(8, innerWidth * 0.035) * 2 : 0;
export const frameExtraWidth = (frame: "browser" | "phone" | "none", innerWidth: number) =>
  frame === "phone" ? Math.max(8, innerWidth * 0.035) * 2 : 0;
