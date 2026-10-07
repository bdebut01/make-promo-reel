// promo.json is the whole video: one file the skill writes, the studio reads.

export type Mood = "clean" | "playful" | "bold-dark";

export type Brand = {
  name: string;
  logo?: string; // path under public/
  primary: string; // main brand color
  accent?: string;
  background?: string; // overrides the mood's background base
  // From a supplied design system or the app's tokens; each overrides the mood's own value.
  text?: string; // headline and caption ink
  muted?: string; // sub-lines and the end card URL
  radius?: number; // px: the frame's corners
  shadow?: string; // CSS box-shadow for the frame, e.g. a design system's hard offset shadow
  font?: string; // body/UI font family; falls back to the mood's font
  headlineFont?: string; // captions and headlines; falls back to `font`
  // The app's own font files, copied into public/ (e.g. public/fonts/RobotoSlab-Bold.woff2).
  fonts?: { family: string; src: string; weight?: number | string; style?: string }[];
  url?: string; // shown in the browser bar and on the end card
};

export type FocusBox = { from: number; to: number; x: number; y: number; scale?: number };

export type IntroScene = {
  type: "intro";
  duration: number; // seconds
  headline: string;
  sub?: string;
  art?: string; // an illustration or mascot from the app (path under public/), shown above the logo
};

export type ShotScene = {
  type: "shot";
  clip: string; // folder under public/captures/
  caption?: string;
  sub?: string;
  trim?: [number, number]; // seconds into the capture
  speed?: number; // 1 = real time
  // Seconds the first frame holds still while the caption lands, before the action plays.
  // Default 1.0 with a caption, 0.3 without.
  leadIn?: number;
  // "auto": one gentle punch-in, on the payoff (the last moment with a focus mark, else the
  // last moment). A number n zooms on the last n moments, "all" on every one, "none" stays wide.
  // A moment is events less than 1.6s apart; its zoom holds one steady frame that fits all of
  // them. An array scripts it by hand (times relative to the trimmed clip, x/y in capture CSS px).
  zoom?: "auto" | "all" | "none" | number | FocusBox[];
  zoomScale?: number; // the most a zoom scales (default 1.4 desktop, 1.25 phone)
  frame?: "browser" | "phone" | "none";
  bleed?: boolean; // portrait + phone: the phone runs off the bottom edge (default true)
  phoneWidth?: number; // portrait + phone: phone screen width as a share of the frame (default 0.72 with bleed, else fit)
  pointer?: "cursor" | "touch" | "none";
};

export type EndScene = {
  type: "end";
  duration: number;
  headline: string;
  cta?: string;
  photos?: string[]; // 8–12 images (paths under public/) floating around the card: items, people, places
};

export type Scene = IntroScene | ShotScene | EndScene;

export type PromoConfig = {
  width: number;
  height: number;
  fps: number;
  maxSeconds?: number; // the user's length cap; sheet.mjs warns if the cut runs over
  mood: Mood;
  brand: Brand;
  // From the bundled mood library (`node music.mjs pick …` writes this) or the user's own file.
  music?: { src: string; volume?: number; startAt?: number; track?: string; bpm?: number } | null;
  // Synthesized UI sounds placed on the capture's own events; false turns them off.
  sfx?: { kit?: "auto" | "soft" | "round" | "crisp"; volume?: number } | false;
  transition?: "fade" | "slide" | "wipe" | "none"; // overrides the mood's default
  // Overrides the mood's entrance springs, so look and motion can be picked apart
  // (a light, clean look with friendly bounce: mood "clean", motion "bouncy").
  motion?: "gentle" | "bouncy" | "snappy";
  scenes: Scene[];
};

// Written by scripts/capture.mjs next to the frames.
export type CaptureManifest = {
  name: string;
  viewport: { width: number; height: number };
  dpr: number;
  duration: number;
  url?: string;
  frames: { t: number; file: string }[];
  cursor: { t: number; x: number; y: number }[];
  // x/y is the cursor (clicks) or the element's center (focus); w/h (and cx/cy for clicks) is
  // the element's box when known, which the zoom frames.
  clicks: { t: number; x: number; y: number; w?: number; h?: number; cx?: number; cy?: number }[];
  focus: { from: number; to: number; x: number; y: number; w?: number; h?: number; kind?: "type" | "focus" }[];
  keys?: { t: number }[]; // one per typed character
};

export type PromoProps = PromoConfig & { manifests?: Record<string, CaptureManifest> };
