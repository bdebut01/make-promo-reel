// Records app footage for the promo studio.
//
// Frames come from Chrome's screencast (crisp JPEGs at device pixels), not Playwright's
// recordVideo (blurry 1 Mbps VP8). The cursor is not in the frames: every mouse move and
// click is logged instead, and the studio draws the cursor, click pulses and auto-zoom.
//
//   import { openApp } from "./capture.mjs";   // copied into the studio folder
//   const app = await openApp({ baseURL: "http://127.0.0.1:8123", outDir: "public/captures",
//     hide: ["#intercom-container", ".cookie-banner"], hideTexts: ["Staging"] });
//   await app.page.goto("/items");                     // set up state off camera
//   await app.record("browse", async (d) => {           // everything in here is on camera
//     await d.hold(0.5);
//     await d.click("text=Cordless drill");
//     await d.type("#message", "Could I borrow it Saturday?");
//     await d.click(d.page.getByRole("button", { name: "Agree" }));  // a Playwright locator works
//                                              // too; use one for modals, where text= can match
//                                              // hidden copies
//     await d.hold(1);
//   });
//   await app.close();
//
// Copy this file into the studio folder and run shot scripts from there, so the import of
// playwright resolves to the studio's node_modules: node shots.mjs

import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";

const now = () => Date.now() / 1000;
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const easeInOut = (x) => (x < 0.5 ? 4 * x * x * x : 1 - Math.pow(-2 * x + 2, 3) / 2);

export async function openApp({
  baseURL,
  outDir,
  viewport = { width: 1440, height: 810 }, // 16:9, the shape of the output
  dpr = 2,
  mobile = false,
  colorScheme = "light",
  storageState, // path to a saved Playwright login state
  headless = true,
  quality = 92,
  blockAnalytics = true, // demo sessions shouldn't show up in the product's analytics
  // Things that must never be on camera but that the app shows anyway: chat launchers, cookie
  // banners, "staging" ribbons, dev-only buttons. CSS selectors go in `hide`; `hideTexts`
  // hides the smallest element whose own text contains one of the strings (case-insensitive).
  // Both keep hiding as the page changes, so a widget that loads late never flashes in.
  hide = [],
  hideTexts = [],
} = {}) {
  fs.mkdirSync(outDir, { recursive: true });
  const browser = await chromium.launch({ headless });
  const context = await browser.newContext({
    baseURL,
    viewport,
    deviceScaleFactor: dpr,
    isMobile: mobile,
    hasTouch: mobile,
    colorScheme,
    storageState,
    reducedMotion: "no-preference",
  });
  if (blockAnalytics) {
    const trackers = /(plausible\.io|google-analytics\.com|googletagmanager\.com|segment\.(io|com)|mixpanel\.com|posthog\.com|hotjar\.com|clarity\.ms|fullstory\.com|heap(analytics)?\.(io|com)|amplitude\.com|intercom\.io|doubleclick\.net)/;
    await context.route(trackers, (route) => route.abort());
  }
  const page = await context.newPage();
  // Hide scrollbars: they flicker in and out on screencast frames and read as noise in a promo.
  await page.addInitScript(() => {
    const css = "::-webkit-scrollbar{display:none!important} *{scrollbar-width:none!important}";
    const add = () => {
      const s = document.createElement("style");
      s.textContent = css;
      document.documentElement.appendChild(s);
    };
    if (document.documentElement) add();
    else document.addEventListener("DOMContentLoaded", add);
  });

  if (hide.length || hideTexts.length) {
    await page.addInitScript(({ hide, hideTexts }) => {
      const needles = hideTexts.map((t) => t.toLowerCase());
      const css = hide.length ? `${hide.join(",")}{visibility:hidden!important;pointer-events:none!important}` : "";
      const sweep = () => {
        if (css && !document.getElementById("__promo_hide")) {
          const s = document.createElement("style");
          s.id = "__promo_hide";
          s.textContent = css;
          document.documentElement.appendChild(s);
        }
        if (!needles.length || !document.body) return;
        const walk = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
        for (let n = walk.nextNode(); n; n = walk.nextNode()) {
          const text = n.nodeValue.toLowerCase();
          if (needles.some((x) => text.includes(x)) && n.parentElement) n.parentElement.style.setProperty("visibility", "hidden", "important");
        }
      };
      const start = () => {
        sweep();
        // Batch a burst of mutations into one sweep; a microtask still runs before paint.
        let queued = false;
        const later = () => {
          if (queued) return;
          queued = true;
          queueMicrotask(() => ((queued = false), sweep()));
        };
        new MutationObserver(later).observe(document.documentElement, { childList: true, subtree: true, characterData: true });
      };
      if (document.documentElement) start();
      else document.addEventListener("DOMContentLoaded", start);
    }, { hide, hideTexts });
  }

  let mouse = { x: viewport.width * 0.62, y: viewport.height * 0.58 };

  // Wait for the page to look finished: network quiet, fonts ready, every image decoded.
  // Apps that build thumbnails on first request (imagekit, sharp, CDN resizers) otherwise show
  // blank tiles on camera.
  // Only images on screen count: lazy images below the fold never load until scrolled to, and
  // waiting on them would leave seconds of dead footage. On camera every second shows, so the
  // whole wait is capped (`timeout`); warm slow thumbnails off camera instead.
  async function settle(ms = 400, { timeout = 3000 } = {}) {
    const t0 = Date.now();
    const left = () => Math.max(100, timeout - (Date.now() - t0));
    await page.waitForLoadState("networkidle", { timeout: left() }).catch(() => {});
    await Promise.race([page.evaluate(() => document.fonts && document.fonts.ready).catch(() => {}), sleep(left())]);
    await page
      .waitForFunction(
        () =>
          [...document.images].every((i) => {
            const r = i.getBoundingClientRect();
            const onScreen = r.bottom > 0 && r.right > 0 && r.top < innerHeight && r.left < innerWidth && r.width > 0;
            return !onScreen || !i.src || (i.complete && i.naturalWidth > 0);
          }),
        null,
        { timeout: left() },
      )
      .catch(() => console.warn("capture: an on-screen image was still loading; warm thumbnails off camera, or check the frames for blank tiles"));
    await sleep(ms);
  }

  async function record(name, script) {
    const dir = path.join(outDir, name);
    fs.rmSync(dir, { recursive: true, force: true });
    fs.mkdirSync(dir, { recursive: true });
    await settle();

    const cdp = await context.newCDPSession(page);
    const frames = [];
    const cursor = [];
    const clicks = [];
    const focus = [];
    const keys = [];
    const writes = [];
    let t0 = null;
    let n = 0;
    cdp.on("Page.screencastFrame", ({ data, metadata, sessionId }) => {
      cdp.send("Page.screencastFrameAck", { sessionId }).catch(() => {});
      if (t0 === null) return;
      const file = `f${String(++n).padStart(5, "0")}.jpg`;
      const t = Math.max(0, (metadata.timestamp ?? now()) - t0);
      const buf = Buffer.from(data, "base64");
      frames.push({ t, file, bytes: buf.length });
      writes.push(fs.promises.writeFile(path.join(dir, file), buf));
    });
    await cdp.send("Page.startScreencast", {
      format: "jpeg",
      quality,
      maxWidth: Math.round(viewport.width * dpr),
      maxHeight: Math.round(viewport.height * dpr),
      everyNthFrame: 1,
    });
    t0 = now();
    const log = () => cursor.push({ t: now() - t0, x: mouse.x, y: mouse.y });
    log();

    // Chrome only sends frames when something repaints; a still page yields no frames,
    // so capture a guaranteed first frame by nudging a repaint.
    await page.evaluate(() => document.body && (document.body.style.outline = "0px solid transparent"));

    let lastBox = null;
    // Fail fast on a wrong selector: Playwright's default 30s wait would otherwise be recorded
    // as 30s of dead footage.
    const box = async (target, { scroll = true } = {}) => {
      const loc = typeof target === "string" ? page.locator(target).first() : target;
      await loc.waitFor({ state: "visible", timeout: 4000 }).catch(() => {
        throw new Error(`capture: "${target}" not visible within 4s. Fix the selector, or stage the page before record()`);
      });
      if (scroll) await loc.scrollIntoViewIfNeeded({ timeout: 2000 }).catch(() => {});
      const b = await loc.boundingBox({ timeout: 2000 });
      if (!b) throw new Error(`capture: no box for "${target}"`);
      return { loc, b };
    };

    const d = {
      page,
      /** Wait on camera. */
      hold: async (s) => sleep(s * 1000),
      /** On camera, wait for the page to finish loading (after a navigation or submit). */
      settle: async (ms = 150) => settle(ms),
      /** Glide the cursor along a slight arc with ease-in-out, like a person would. */
      moveTo: async (target, { duration } = {}) => {
        let to;
        if (typeof target === "object" && target && "x" in target) to = target;
        else {
          const { b } = await box(target);
          to = { x: b.x + b.width / 2, y: b.y + b.height / 2 };
        }
        const from = { ...mouse };
        const dist = Math.hypot(to.x - from.x, to.y - from.y);
        const ms = (duration ?? Math.min(0.95, 0.35 + dist / 1800)) * 1000;
        const bend = (Math.random() - 0.5) * 0.25 * dist;
        const nx = -(to.y - from.y) / (dist || 1);
        const ny = (to.x - from.x) / (dist || 1);
        const start = Date.now();
        for (;;) {
          const k = Math.min(1, (Date.now() - start) / ms);
          const e = easeInOut(k);
          const arc = Math.sin(Math.PI * e) * bend;
          mouse = { x: from.x + (to.x - from.x) * e + nx * arc, y: from.y + (to.y - from.y) * e + ny * arc };
          await page.mouse.move(mouse.x, mouse.y);
          log();
          if (k >= 1) break;
          await sleep(14);
        }
      },
      /** Move to the element, pause a beat, click. */
      click: async (target, opts = {}) => {
        // Remember the element's box: the studio frames zooms around boxes, not just points.
        const bx = typeof target === "string" || (target && typeof target === "object" && !("x" in target)) ? (await box(target).catch(() => null))?.b : null;
        lastBox = bx ? { w: bx.width, h: bx.height, cx: bx.x + bx.width / 2, cy: bx.y + bx.height / 2 } : null;
        await d.moveTo(target, opts);
        await sleep(120);
        clicks.push({ t: now() - t0, x: mouse.x, y: mouse.y, ...(lastBox ? { w: lastBox.w, h: lastBox.h, cx: lastBox.cx, cy: lastBox.cy } : {}) });
        if (mobile) await page.touchscreen.tap(mouse.x, mouse.y);
        else await page.mouse.click(mouse.x, mouse.y);
        log();
        await sleep(opts.after ?? 250);
      },
      /** Click into a field, then type at a human pace (~14 chars/s, jittered). */
      type: async (target, text, { cps = 14, clear = true } = {}) => {
        await d.click(target);
        if (clear) await page.keyboard.press(process.platform === "darwin" ? "Meta+A" : "Control+A").catch(() => {});
        const from = now() - t0;
        for (const ch of text) {
          keys.push({ t: now() - t0 });
          await page.keyboard.type(ch);
          await sleep((1000 / cps) * (0.6 + Math.random() * 0.8));
        }
        focus.push({ from, to: now() - t0, x: lastBox?.cx ?? mouse.x, y: lastBox?.cy ?? mouse.y, ...(lastBox ? { w: lastBox.w, h: lastBox.h } : {}), kind: "type" });
      },
      /** Hold the zoom on an element without clicking it, e.g. a result that just appeared.
       *  Aim at the tightest element that shows the payoff (the chat bubble, not its full-width
       *  row): the zoom fits the element's box. */
      // `scroll: false` keeps the page still. By default an off-screen target is scrolled into
      // view, which happens on camera.
      focus: async (target, seconds = 1.2, { scroll = true } = {}) => {
        const { b } = await box(target, { scroll });
        const from = now() - t0;
        await sleep(seconds * 1000);
        focus.push({ from, to: now() - t0, x: b.x + b.width / 2, y: b.y + b.height / 2, w: b.width, h: b.height, kind: "focus" });
      },
      hover: async (target, s = 0.6) => {
        await d.moveTo(target);
        await sleep(s * 1000);
      },
      /** Eased wheel scroll over `duration` seconds; scrolls whatever is under the cursor. */
      scrollBy: async (dy, { duration = 0.9 } = {}) => {
        // Paced by the clock, not a step count: each wheel event can take a frame or more in
        // headless Chrome, so fixed steps plus fixed sleeps run long.
        const start = Date.now();
        let done = 0;
        for (;;) {
          const k = Math.min(1, (Date.now() - start) / (duration * 1000));
          const target = dy * easeInOut(k);
          if (Math.abs(target - done) >= 1 || k >= 1) {
            await page.mouse.wheel(0, target - done);
            done = target;
          }
          if (k >= 1) break;
          await sleep(12);
        }
        log();
      },
      scrollTo: async (target, { duration = 0.9, offset = 120 } = {}) => {
        const b = await page.locator(target).first().boundingBox();
        if (b) await d.scrollBy(b.y - offset, { duration });
      },
    };

    try {
      await script(d);
    } finally {
      await sleep(150);
      log();
      const duration = now() - t0;
      await cdp.send("Page.stopScreencast").catch(() => {});
      await Promise.all(writes);
      await cdp.detach().catch(() => {});
      if (!frames.length) throw new Error(`No frames captured for ${name}`);
      frames[0].t = 0; // the first frame stands in for the start
      // Chrome paints a blank frame between page loads. It compresses to a fraction of its
      // neighbors' size, so drop frames far smaller than those around them; the previous frame
      // holds instead of a white flash.
      const dropped = [];
      for (let i = 1; i < frames.length; i++) {
        const near = frames.slice(Math.max(0, i - 4), i + 5).filter((_, j) => j !== Math.min(i, 4)).map((f) => f.bytes).sort((a, b) => a - b);
        const median = near[Math.floor(near.length / 2)] ?? frames[i].bytes;
        if (frames[i].bytes < median * 0.3) dropped.push(i);
      }
      for (const i of dropped.reverse()) {
        fs.rmSync(path.join(dir, frames[i].file), { force: true });
        frames.splice(i, 1);
      }
      if (dropped.length) console.log(`${name}: dropped ${dropped.length} blank frame(s)`);
      for (const f of frames) delete f.bytes;
      const manifest = { name, viewport, dpr, duration, url: page.url(), frames, cursor, clicks, focus, keys };
      fs.writeFileSync(path.join(dir, "manifest.json"), JSON.stringify(manifest));
      console.log(`${name}: ${frames.length} frames, ${duration.toFixed(1)}s, ${clicks.length} clicks → ${dir}`);
    }
  }

  return {
    browser,
    context,
    page,
    settle,
    record,
    /** Save the logged-in state so later shot scripts can skip the login. */
    saveLogin: async (file) => context.storageState({ path: file }),
    /** Where the cursor sits when the next shot starts. Park it somewhere its first move won't
     *  cross (and hover-highlight) something on the way to the first target. */
    placeCursor: async (x, y) => {
      mouse = { x, y };
      await page.mouse.move(x, y);
    },
    close: async () => browser.close(),
  };
}
