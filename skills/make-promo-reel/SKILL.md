---
name: make-promo-reel
description: Make a short (10–30s) promo or teaser video for a web app from real screen recordings of the app in use, filled with believable demo data and finished with industry-standard motion graphics (browser or phone frame, a restrained payoff zoom, kinetic captions, a branded intro and CTA end card) built from the app's own fonts, art and photos, or steered by what the user supplies: a design system, HTML/CSS file or claude.ai artifact (which can also be filmed in place of an app, for a prototype or mockup reel), and their own logos, art and photos. Handles the whole pipeline — learning to run the app in isolation, seeding demo data, storyboarding, scripted Playwright capture, and Remotion rendering to MP4 in 16:9, 1:1 or 9:16. Use this whenever someone wants a promo, launch video, sizzle reel, product teaser, demo clip, app trailer, social video, Product Hunt or landing-page hero video, or "a quick video showing off the app", even if they don't say "promo".
---

# App promo video

The goal is a 10–30 second video that gives a stranger a feel for an app — what it does and what
it's like to use — the way a SaaS launch video does. It's built from real footage of the app,
filled with a believable world of demo data, and finished with restrained, familiar motion
graphics. A viewer should come away with a product they understand and a mood they remember, not
a feature tour.

Three parts of the work carry most of the quality:

- **The demo data.** An empty or obviously fake app kills the vibe instantly.
- **The storyboard.** Three or four moments, each landing one benefit, paced so a viewer can read
  the caption *and* see the action.
- **Making it look like the app.** The template's presets are a clean floor, not the finished
  look. The best result comes from pulling in the app's own fonts, illustrations and photos, and
  from adding one custom touch that fits this product.

The capture and compositing are mechanical, and the bundled scripts handle most of that.

## What's bundled

- `template/`: a Remotion project (the "studio"). It reads `public/promo.json` and composes
  intro → shots → end card with transitions, captions, device frame, cursor, a payoff zoom, the
  app's own fonts, intro art and end-card photos.
  Schema: `template/src/types.ts`. It renders MP4 with Remotion's own ffmpeg, so there's nothing
  to install system-wide.
- `scripts/capture.mjs`: Playwright helper. It records crisp frames through Chrome's screencast
  and logs every cursor move and click, which the studio uses to draw the cursor and aim the
  zoom. The on-camera actions (`click`, `type`, `scrollBy`, `focus`, `hold`) move at a human
  pace.
- `template/sheet.mjs`: renders a labeled contact sheet (one PNG of evenly spaced frames), so you
  can look at the video without watching it.
- `scripts/avatars.mjs`: initials-on-gradient profile pictures for demo people.
- `template/sfx.mjs`: synthesizes the UI sound kits (clicks, keys, whoosh, chime, pops) on
  `npm install`. Nothing to find or license.
- `scripts/music.mjs` and `library/music.json`: a curated bed library (Mixkit Free License, no
  attribution) picked by mood and energy, fetched once into `<reels>/_music/`.
- `scripts/design-tokens.mjs`: reads a design source's CSS, HTML or token JSON and prints its
  colors (as hex), fonts, font files and radius, with suggested `brand` fields.
- `scripts/guard.sh`: refuses any destructive target outside the workspace. See below.
- `scripts/box`: runs a browser command in a Playwright Docker container that sees one folder,
  for hosts where Chromium can't launch (the Claude Code sandbox). See "Where the browser runs"
  in step 5.
- `references/motion-language.md`: pacing, caption copy, mood presets and timing templates.
  Read it before storyboarding.
- `references/running-apps.md`: per-stack notes on running an app in isolation. Read it during
  step 2.
- `references/demo-data.md`: how to build a demo world that feels lived-in. Read it during
  step 3.
- `references/design-sources.md`: using what the user supplies to steer the look. That's a
  design system, HTML/CSS file or claude.ai artifact (as the look, or as the thing to film),
  and logos, art, photos or headshots. Read it whenever the user supplies any of these.

## Workspace

Each request gets one reel folder outside the app's repo, named for the app and the day it's
made (`MM-DD-YY`), so the user's checkout is never touched. Reels live under `<reels>`: the
folder in `$PROMO_REELS` if it's set (check once with `echo $PROMO_REELS`), else
`~/promo-reels/`. If the session's sandbox can't write there, ask the user for a folder it can. The finished videos sit at the top,
where the user will look, and everything that made them is tucked into `work/`:

```
<reels>/<app>-reel_<MM-DD-YY>/       e.g. weekly-reel_10-01-26/
  <app>-reel-<cut>.mp4   the deliverables: weekly-reel-16x9.mp4, or named by use when
                         there are several (weekly-reel-landing-16x9.mp4, …-stories-9x16.mp4)
  README.md              per cut: format, length, shot list with captions, what's demo data,
                         how to re-cut
  sheets/                a contact sheet and the final promo.json for each cut
  work/                  the workspace (<ws> below), and PROMO_WS for the guard
    notes.md             how to run, log in and seed; lets a later re-cut skip recon
    setup.sh             install, build, seed and start the app copy: the commands that worked
    app/                 isolated copy of the app, with its own database (removed at handover)
    design/              copies of a supplied design source and its tokens.json, and media/
                         for supplied logos, art and photos (if any)
    seed.py, reset.sh    rebuild the demo world (reset.sh is guarded)
    studio/              copy of template/ plus capture.mjs, shots.mjs, avatars.mjs
      public/captures/   one folder per shot: frames + manifest.json
      public/promo.json  the video (promo-<cut>.json for each extra cut)
      out/               scratch: sheets and stills while iterating
```

All of a reel's cuts share one `work/`: one app copy, one studio, one set of captures, and a
`promo-<cut>.json` per cut. Use the app's short name in lowercase (`acmecrm`, not `Acme CRM`).
A second reel of the same app on the same day gets a `-2` suffix (`weekly-reel_10-01-26-2`).
If the user names another location, use that, as long as it isn't inside the app's checkout.
Keep `notes.md` current as you learn things, and once the app runs, put the commands that
worked into `setup.sh`, so a later re-film is one command.

**Write every Bash command so it can be checked before it runs.** In Claude Code, it reads a
command's text to decide whether it stays inside the allowed folders. It can't do that for
anything the shell works out at run time: `$VAR`, `${…}`, `$(…)`, backticks, `~`, `export`,
globs in a target path, or a `cd … &&` prefix. Such commands get a permission prompt even when
every path really is inside the allowed folders. This is a long, many-command job, so those prompts
pile up. So:

- **Spell out absolute paths.** Expand `~` and the date yourself once (`date +%m-%d-%y`), and
  from then on type the reel's full path, like
  `/Users/<you>/promo-reels/weekly-reel_10-01-26/work`, and `<skill>` as its full
  path too.
- **Put shell logic in a script file.** Variables, `$(…)`, loops, `export`, PIDs looked up by
  port: write them into a `.sh` file under `work/` with the Write tool, then run it as
  `sh /abs/path/work/<name>.sh`. Claude Code checks the command, not what the script does, and
  the script is reusable on the next take.
- **Don't rely on `cd`.** The working directory doesn't reliably carry over to the next Bash
  call, so point each command at its folder instead: `box`'s folder argument,
  `npm run <script> --prefix /abs/app`, `git -C /abs/app …`, or absolute paths as arguments. A `cd`
  inside a script file is fine.
- **Look up, then act.** Instead of `kill $(lsof -ti…)`, run the lookup, read the PID, and run
  `kill 48213`. Or put both steps in a script.

**Guard every destructive step.** Resetting the copy is routine: deleting its database, wiping
its media, dropping or flushing a database, `docker compose down -v`. The one thing that must
never happen is doing it to the user's own data. So every such command goes through
`scripts/guard.sh` first. The guard reads `PROMO_WS` and `PROMO_SRC` from the environment, so
call it from a script that sets them, never from a one-line `export … &&` command. Make the
reset script the place for this:

```sh
# work/reset.sh: run as  sh /Users/<you>/promo-reels/<app>-reel_<MM-DD-YY>/work/reset.sh
export PROMO_WS=/Users/<you>/promo-reels/<app>-reel_<MM-DD-YY>/work
export PROMO_SRC=/path/to/users/checkout
cd "$PROMO_WS"
sh <skill>/scripts/guard.sh app/db.sqlite3 app/media || exit 1   # files and folders
sh <skill>/scripts/guard.sh --db weekly_promo || exit 1          # database names
rm -f app/db.sqlite3 …
```

It resolves symlinks and `..`, and passes a path only when it's inside `PROMO_WS` and not inside
`PROMO_SRC`. Databases you create are named `<app>_promo`, and the guard refuses any other
name. If the guard refuses, stop and find out why; don't work around it. A refusal means a path
or variable points somewhere it shouldn't.

**Look for an earlier reel of the same app first.** Recon is the slowest part, and a second
promo for the same app should be able to start from step 4. Before step 2, list
`<reels>` for `<app>-reel_*` folders. If one exists, read its `notes.md`,
`setup.sh`, seed and reset scripts, `shots.mjs` and README, and reuse what still works: the
run commands, the demo world, the login, the shot scripts. That reel may have been made with an
older version of this skill, though. So check each reused setting against the current
instructions before keeping it: the viewport, the captions, the brand assets, the timing.
Re-check the app's state too, since it may have moved on since then. Start the new reel in its
own folder, and copy the scripts in. Never edit the old reel's files.

## 1. Intake

The first thing to settle is **which app**: a local path, a git URL, or a URL where it's already
running. A running URL works, but it limits seeding to what the UI can create, and you must not
write data into a shared or production instance.

With no app at all, a design can be the subject instead: a prototype, mockup or landing page
given as an HTML file or a claude.ai artifact (see question 5).

Then ask the rest in **one round**, each with a default the user can just accept:

1. **Where will it be used?** This one answer sets most of the defaults below, so ask it first:

   | Use | Aspect | Length cap | Feel | Call to action |
   |---|---|---|---|---|
   | Landing-page hero | 16:9 | 20s | calm, loops cleanly | sign up / try it |
   | Stories, Reels, TikTok | 9:16 | 15s | quick, punchy | visit / follow |
   | Feed post (LinkedIn, X, Instagram) | 1:1 | 15s | clean, professional | visit |
   | Launch (Product Hunt, announcement) | 16:9 | 30s | a fuller tour | try it / upvote |

   Several uses means several cuts from the same footage.
2. **Longest it should run:** a cap, not a target. Default 20s, or the use's cap above. The
   storyboard decides the actual length from what the app has to show: a small app with one
   strong loop may land at 10–12s, and that's better than padding to the cap.
3. **Any features you definitely want in?** Optional. These must appear; you propose the rest
   from the code at the storyboard.
4. **Sound:** music and UI sound effects are on by default for Stories, Reels, TikTok, feed
   posts and launch cuts, and off for a landing-page hero, which autoplays muted. Music comes
   from the bundled library unless the user supplies a track. Download music only from the
   library's own sources; anything else, the user decides on licensing.
5. **Anything to steer the look?** Optional, and the default is "no, use what's in the app".
   Offer two kinds, which can come together:
   - **A design source:** a claude.ai Design System or other artifact link, an HTML file, a
     CSS or tokens file, or a folder of these. It sets the colors, fonts, radius, logo and
     art, and where it disagrees with the app, the design source wins.
   - **Media:** a logo, mascot or illustrations, product or lifestyle photos, headshots for
     the demo people, or a newer logo than the repo's. These can be files, a folder, an
     artifact's assets or a link the session's tools can read.

   Users often have better material than the repo holds (a rebrand that hasn't shipped, the
   marketing team's photos, a mascot from the landing page), and this is the one chance to
   steer the look before it's built. If the user answers, read `references/design-sources.md`
   right away. If it's unclear whether a design is meant as the look or as the thing to film,
   ask that in the same round.

Don't ask what you can learn from the repo: product name, logo, colors, fonts, URL, what the
features are. Question 5 offers a way to override those; it doesn't ask the user to supply
them. Mood and motion are picked after seeing the app, and shown for approval at the
storyboard.

## 2. Learn to run it, in isolation

When the design itself is the subject, follow "When the design is the subject" in
`design-sources.md` in place of this step and the next. The storyboard onward is the same.

Read what the project says about itself first: README, AGENTS.md or CLAUDE.md, CONTRIBUTING,
`package.json` / `pyproject.toml` / `Gemfile` / `docker-compose.yml`, and `.env.example`. Then:

1. **Make a disposable copy.** If the checkout isn't on its main branch, or is behind its
   remote, ask which state to film (the checked-out branch, or `main` / `origin/main`): a
   promo should usually show what users can actually use. Run
   `git clone --local <path> <ws>/app` for that state. If the sandbox refuses it (writing
   `.git/config` or hooks is often denied), export that commit instead. Write the commit hash to
   `<ws>/app.commit`, then run `git -C <path> archive <commit>`, piped into `tar -x -C <ws>/app`,
   from a script file. `git archive` only reads the checkout, and `slim.sh` handles a copy
   with no `.git` from `app.commit`. Then copy the untracked env files (`.env`, `.env.local`) across, replacing any production keys,
   tokens or database URLs in the copy with local or test-mode values. If the checkout has uncommitted
   changes, ask whether the video should show them; if yes, rsync the working tree instead
   (excluding `node_modules`, `.venv`, build output and databases). The user's own checkout,
   database, running servers and branches are theirs: don't migrate, seed, edit, stash or kill
   anything there. The promo needs a world you can wreck and rebuild.
2. **Give the copy its own database and ports.** Use a fresh SQLite file inside the copy, a new
   Postgres database named `<app>_promo`, or a throwaway container. Choose ports the user's dev
   servers aren't using. Point outbound email, payments and SMS at console/test backends, so
   seeding never sends anything real. Never use production keys or credentials, for anything,
   even read-only: the copy runs on local values and test-mode keys only.
3. **Install and start it** with the Bash tool's own background option (`run_in_background`),
   logging to a file, and poll until it answers with a 200. Don't detach it with `nohup`,
   `&` or `setsid`. Inside the sandbox, a later command can't signal a process an earlier one
   detached, so it can't be stopped, and it holds its port after you're gone. A background
   task can always be stopped. Record each server's port and task in `notes.md`, and stop them
   all before handing over.
4. **Prove it renders.** Take a Playwright screenshot of the main screen and look at it. Missing
   CSS or fonts, a dev asset server that isn't running, a debug toolbar, a framework dev overlay
   or a cookie banner will all end up in the video. Fix them now, preferably with a production
   build or settings the app already has for it (see `running-apps.md`).
5. **Make a demo login.** Use the app's own mechanism: a CLI or management command, the signup
   flow, or a seed. Log in once through Playwright and save the state with `saveLogin`, so shot
   scripts start logged in.

Write the working commands into `notes.md` as you go.

## 3. Build the demo world

Read `references/demo-data.md`. In short:

- **Look for existing demo data first**: fixtures, seed scripts, factories in the tests, sibling
  repos or folders named like `*-demo-data`. Curated demo data beats anything you'll invent. Ask
  the user if you find some and aren't sure it's current.
- **Otherwise build a small, coherent world** around one protagonist, the logged-in user whose
  eyes the viewer borrows. Use specific, plausible names, content and numbers, recent timestamps
  relative to today, and a mix of states.
- **Load it through the app's own code paths** (ORM, commands, API, or the UI itself), so that
  counters, derived records and search indexes come out right.
- **Images matter.** First choice is media the user supplied at intake: their product photos
  and headshots go into the demo world itself (item pictures, profile photos), not only into
  the graphics. Then repo assets and demo-data images, then `avatars.mjs` for people. Ask
  before downloading stock photos, and never hotlink.
- **Show no identifiable real people.** Demo data often slips in a teammate's own account: check
  every person's name against the repo's git authors and contributors
  (`git log --format='%an' | sort -u`), and drop any match, both name and photo. A promo is
  public, and a developer's face on the landing page isn't a call to make on their behalf.
  Profile photos are good for the vibe. Demo-set headshots that aren't a team member's, and
  headshots from free-to-use sources, are fine: generated faces, or portrait sets published for
  mockups under a license that allows it. Note each photo's source in `notes.md`. When you
  can't tell whether a demo photo is someone real, ask. Fall back to `avatars.mjs` initials only
  when there's nothing better.
- **Check every screen you plan to film** with a screenshot. Nothing should be empty, and there
  should be no "test", "asdf" or lorem ipsum.

## 4. Storyboard, and confirm it

Read `references/motion-language.md`, then pick the moments that best sell the app. Start with
the user's must-have features. If one can't be filmed well (it's behind a paywall, or has no
visible result), say so and suggest the closest moment that shows it. Fill the rest from the
README pitch, the main navigation and the most-developed feature areas in the code.

**Let the content set the length, up to the cap.** Count the moments the app genuinely has, at
3.2–6s each, plus about 2s of intro and 2–3.5s of end card. Two moments come to about 10–15s,
three to about 20s, and four to 30s at most. A small app with one strong loop should be short.
Never add a weak moment to reach the cap. **Follow one thread through the moments:** the same item, person or project carries from
shot to shot. Scenes about three unrelated things read as a feature list, while one thread
reads as a story. Write the storyboard and show it to the user before filming. It covers the look and the ask
as well as the shots, so the whole video is approved here, not discovered in the render:

```
Weekly reel: landing-page hero, 16:9, 20.4s (cap 25s); three moments, so 20s is enough
Look: mood clean, motion gentle; the app's teal and its "calendar fox" mascot; Inter
Sound: off (landing hero autoplays muted); for a social cut: "Infinity" (calm corporate) + soft UI sounds
CTA "Try it free" → weekly.app (from the pricing page, which offers a free tier)

#  scene   secs  on screen                                               caption
1  intro   2.2   the app's current mascot, logo, "Plan the week *together*"      sub: Shared schedules for small teams
2  shot    5.0   (wide) the team's week view, full of real-looking events        Everyone's week, *one view*
3  shot    5.0   drag Priya's review to Thursday → zoom on the "moved" toast     Reschedule in *one drag*
4  shot    5.0   Priya's phone view: the moved review, "Accept" / "Suggest…"      Priya *confirms* in a tap
5  end     3.2   logo, tagline, CTA, 10 photos from the demo world              Try it free
```

In the example, the review Priya confirms in shot 4 is the one moved in shot 3. When a shot
creates or changes something on camera, stage the next moment's state off camera between
the shots. For example, a small script acting as the other user requests the item that shot 2
just listed, and then shot 3 is filmed. Make sure at least one moment shows the lived-in world:
a feed, a group or an inbox with people in it. That matters most in mobile cuts, where forms
and detail pages can fill every shot. With only two moments, start one of them on a populated
screen and act from there. Never thin the world to make the new thing stand out: to get the
new item to the top, back-date the others, don't remove them. Back-date staged records too
("2 minutes ago", not "0 minutes ago").

Ask the user to confirm or change, in particular:

- **The CTA and URL.** Don't promise "free" or a trial unless the app or its site says so.
- **The look:** mood, motion, art and end-card photos.
- **The length,** if it's well under the cap.
- **Any must-have** you couldn't fit.

This is the cheapest point to change direction: a caption rewrite costs nothing here, and a
re-shoot costs minutes later. Check the timing adds up with the formula in
`motion-language.md` before filming. If a moment depends on a feature behind a flag that's off by
default, say so when you show the list. It may already be live in production, but that's the
user's call to confirm. Keep captions to five words or fewer and benefit-first ("Ask in
one tap", not "Request feature"). Mark one hot word or short phrase per caption with `*asterisks*`.

## 5. Capture

Set up the studio: copy `template/` to `<ws>/studio` and copy `scripts/capture.mjs` (and
`avatars.mjs` if needed) into it. Write `studio/shots.mjs` with one `app.record(name, d => …)`
per shot. The header of `capture.mjs` shows the API.

**Where the browser runs.** Capture, contact sheets and rendering all launch Chromium. Pick
one way to run them, once, and use it for the whole reel:

- **On the host,** when Chromium can launch there (no sandbox, or one that allows it). Run
  `npm install --prefix /abs/studio` (which also synthesizes the sound kits) and
  `npx --prefix /abs/studio playwright install chromium`, then the scripts directly:
  `npm run shots --prefix /abs/studio`.
- **In `box`,** when it can't. Chromium can't launch inside the Claude Code sandbox, and
  `<skill>/scripts/box` runs it in a Playwright container (Docker) that sees only the studio
  folder. Don't install on the host: the first `box` run installs a Linux `node_modules`, and
  the image already has Chromium. `<box>` is the script's absolute path:

  - `<box> --port <app port> /abs/studio -- npm run shots` (`--port` lets the page reach the
    app's dev server on `localhost`)
  - `<box> /abs/studio -- npm run frames -- <shot>`
  - `<box> /abs/studio -- npm run sheet`
  - `<box> /abs/studio -- npm run render -- out/<name>.mp4`
  - `<box> /abs/studio -- node avatars.mjs public/avatars "Maya Chen" …`

  The box mounts only folders under `<reels>`, `$TMPDIR`, Claude's temp folder or
  `$BOX_ROOTS`, so everything these scripts read or write must be inside the studio: render
  into `studio/out/`, then copy the MP4 to the reel folder with a plain `cp`. The command starts
  with the absolute `box` path and takes plain arguments: no `cd … &&`, pipes, `$(…)` or `;`,
  or it prompts and runs in the sandbox, where Chromium fails. If Chromium fails to launch,
  check that spelling before blaming the settings.

The short forms below (`npm run sheet`, …) mean whichever form you picked. To test the host,
run `npm run frames` once after the first capture, or a one-line Playwright screenshot.

- **Stage off camera, perform on camera.** Before each `record`, navigate to the start state,
  scroll into place and dismiss banners. Inside `record`, do only the moment itself: every second
  of capture is a second of video.
- **Start and end with a short `hold` (0.3–0.5s)**, so trims have room. After the action
  completes, hold on the payoff (the toast, the result, the updated list) for about 0.8s.
- **Use `d.focus(selector)` on the payoff:** the toast, the new message, the updated list. Aim
  at the tightest element that shows it, like the chat bubble rather than its full-width row:
  the zoom frames that element's box. The zoom lands on the moment containing the last focus
  mark. Events less than 1.6s apart (typing,
  the Send click, the payoff) count as one moment, and it's framed with one steady shot that
  fits them all.
- **Scroll the right box.** `scrollBy` wheels whatever is under the cursor. When a list scrolls
  inside its own container (a member list, a sidebar, a chat pane), move the cursor over that
  container first, or the page scrolls instead.
- **Park the cursor before recording** with `app.placeCursor(x, y)`, close to the first target
  (a long first glide wastes half a second) but where the move won't cross other buttons and
  light them up.
- **After a submit or navigation on camera,** call `await d.settle()` before the payoff, so
  the images on screen have finished loading when the camera lands on them. It waits 3s at
  most, because every second of it is footage. If the app makes thumbnails on first request,
  warm them off camera: load the result page (or run the search) once before recording.
- **Vertical (9:16):** the phone rises from the bottom edge and bleeds off it, with the caption
  kept below the top 13% (the Stories and Reels profile bar). Stage every shot so its action
  and payoff sit in the **top ~60% of the mobile screen**. The rest is cut off by the frame
  edge or covered by the platform's reply bar. When the payoff lives at the bottom of the phone
  screen (a bottom sheet, a sticky submit bar, a toast), switch that shot to a whole phone.
  Capture a shorter viewport (375×667), set `"bleed": false`, and size it with `phoneWidth`
  (about 0.62). Then check the payoff sits above the bottom 20% of the frame.
- **Viewport:** use 1440×810 at dpr 2 for 16:9 (the `openApp` default: it matches the output's
  shape, so the screen fills the frame), 1280×720 when the UI is dense and text needs to read
  larger, or 1200×960 for 1:1. For 9:16, capture at 390×844, dpr 3, `mobile: true` if the app is
  responsive; otherwise capture desktop and rely on the zoom.
- **Shots that change data need a reset before a retake.** Sending a message, requesting an
  item or approving something leaves the database changed, so a second take starts from a
  different state. Run the (guarded) reset script, restart the server if the app caches
  anything in-process, and note which shots mutate in `notes.md`.
- **Check each shot** with `npm run frames -- <shot>`: it tiles 8 of the shot's captured frames
  into one image, `out/frames-<shot>.png`. Or read 3–4 of its frame JPEGs, spread across the shot. Confirm the
  action visibly happened and that there are no spinners, error toasts, dev overlays or empty
  states. If one shot is bad, re-record only that shot.

## 6. Compose

Write `studio/public/promo.json`. The example in the template and `src/types.ts` define it.

- **Make it look like the app.** Anything the user supplied at intake comes first. A design
  source's colors, fonts, radius, logo and art go into `brand`, `intro.art` and
  `studio/public/`, and supplied media fills `brand.logo`, `intro.art` and `end.photos`
  (`design-sources.md` covers reading each kind). Then fill whatever they leave out from the
  app, as below. With nothing supplied, harvest the app's design language into
  `studio/public/`, and don't fall back to a preset's look:
  - **Name and logo:** look in `static/`, `public/`, `assets/` and favicons. A PNG or SVG with
    transparency works best.
  - **Colors:** from the app's CSS variables or Tailwind config.
  - **Fonts:** find them in the app's CSS or Google Fonts links, put the woff2 files in
    `public/fonts/`, then set `brand.fonts` and `brand.headlineFont`.
  - **Illustrations and mascots:** use art the app **currently shows**. Asset folders keep
    retired art long after a rebrand, so find what the live landing page and templates actually
    reference (grep the templates for the file name), and prefer the most recently changed
    (`git log -1 --format=%cr -- <file>`). If two candidates look current, ask. Use one as
    `intro.art`.
  - **Content photos and people:** 8–12 of the demo world's pictures as `end.photos`, a mix of
    items and faces. Fewer than 8 looks sparse. Bubbles are circles, so square-crop each one
    around its subject (a face's crop keeps the whole face, not the center of a tall photo) and
    look at them on the sheet.

  - **Fonts with one weight:** if the app bundles only one weight of its font, load the rest of
    that family with `@remotion/google-fonts` in `theme.ts`. The family is what makes it look
    like the app.

  Then pick the look and the feel separately. The mood sets the background, type and frame.
  `motion` (`gentle`, `bouncy` or `snappy`) sets how things move, so a light `clean` look can
  still bounce. If the logo doesn't read on a preset's background (a dark wordmark on
  `playful`'s solid color), use the app's light variant or recolor the SVG, rather than dropping
  the preset. Then add **one custom touch** that belongs to this product,
  editing the components in the studio copy. Examples: a highlight that swipes under the hot
  word in the brand's marker color, the app's own empty-state illustration, or items drifting
  between avatars for a sharing app. Promos made this way read as the product's own. Preset-only
  ones read as a template.
- **Pacing:** a viewer can't read a caption and follow the action at the same time. Each shot
  holds its first frame for `leadIn` seconds (1.0 by default) while the caption lands, then
  plays. Keep the action after that to a single gesture of about 2–3.5s, then hold on the
  payoff. If a shot feels rushed on the sheet, cut a moment rather than speeding it up.
- **Trims:** start each shot just before the first movement, and end it about 0.8s after the
  payoff. `speed` up to 1.2 is invisible; beyond that, motion looks fake.
- **Camera restraint:** constant zooming and panning is the most common tell of an over-produced
  promo, so the defaults are conservative:
  - `"auto"` gives one gentle punch-in per shot, on the payoff, at up to 1.4×.
  - At least half the shots stay wide (`"none"`), including establishing shots like a feed or
    dashboard, where the whole screen is the point.

  If an `"auto"` shot shows no zoom on the sheet, its events ran together (each gap under 1.6s)
  into a moment too spread out to frame. Hand-aim the zoom box, or leave a longer beat before
  the payoff so it becomes its own moment.

  One zoom is a default, not a rule. When a shot has two distinct payoffs that each need to be
  seen up close, use `"zoom": 2` (the last two moments), `"all"`, or a hand-aimed array. Just
  make the second move earn its place on the contact sheet.
- **Iterate on the contact sheet, not the video.** Run `npm run sheet` and look at
  `out/sheet.png`; `npm run sheet -- 16 90 200` zooms into a range. Check that:
  - captions are readable and don't collide with the frame
  - every shot's first visible frame has content
  - the zoom never crops away the thing being clicked
  - the end card is legible
  - the total length (printed) is within the target
  - no `PACING WARNING` lines were printed. They flag an intro or end card under 2.0s, a
    caption lead-in under 0.8s, a shot sped past 1.2×, or a cut longer than `maxSeconds` (set it
    to the user's cap). Fix each one before rendering; to
    find the time, cut a moment rather than squeezing the floors.
- **Sound:** set `"sfx": { "kit": "auto" }` to place synthesized UI sounds on the capture's own
  events: a click per click, a key per typed character, a whoosh on each cut, a chime on the
  payoff (the shot's last `d.focus`) and pops as the end-card bubbles land. `auto` picks the kit
  from the mood (`soft` for clean, `round` for playful, `crisp` for bold-dark), and `"volume"`
  scales the whole kit. Keystrokes only exist in captures made after keystroke logging was
  added, so older captures get clicks without typing. Use `"sfx": false` for a cut that will
  autoplay muted anyway.
- **Music:** pick a bed from the library to match the mood and the use's energy (`calm` for a
  landing or feed cut, `lively` for Stories and launch), seeded by the app's name so re-renders
  keep the same track:

  ```sh
  node <skill>/scripts/music.mjs pick --mood <mood> --energy <calm|medium|lively> \
    --seconds <length> --seed <app> --out <ws>/studio/public
  ```

  Paste the printed `"music"` block into `promo.json`. It carries a per-track `volume`, so beds
  sit at the same level under the effects, and a `startAt` that skips any quiet intro. Name the
  track on the storyboard's Look line so the user can swap it (`--track <id>`; `music.mjs list`
  shows all ten). For beat-matched cuts, make scene lengths whole multiples of the printed beat.
  Record the track and its license in the reel's README. The license requires no attribution,
  but it's what makes the reel's music traceable.
- **Render, then copy to the reel folder:**
  `npm run render -- out/<app>-reel-16x9.mp4`, then
  `cp /abs/studio/out/<app>-reel-16x9.mp4 /abs/reel/`. In the box, Remotion uses the image's
  Chromium (`remotion.config.ts` and `sheet.mjs` read `$CHROME`). For another aspect ratio,
  write `promo-9x16.json` with the new `width`/`height` (and mobile clips) and run
  `npm run render -- out/<app>-reel-9x16.mp4 --props=public/promo-9x16.json`.

The template is a starting point, not a cage. If the storyboard wants something the config can't
express, such as a number counting up, a split screen or two clips side by side, edit the
components in the studio copy. Keep the skill's own `template/` untouched.

## 7. Deliver

Before handing over, make sure the reel folder reads on its own:

- the MP4s at its top, named `<app>-reel-<cut>.mp4`
- each cut's final contact sheet and `promo.json` copied into `sheets/`
- `README.md` written: per cut, what it's for, the format, length and shot list with captions;
  what is demo data and which people were renamed or left out; the design source, if one was
  used, and which `brand` fields came from it; each supplied media file and where it was used;
  and how to re-cut (below)

Stop every server and container you started, then **slim the workspace**. The app copy and the
installs are about 1 GB per reel and all rebuildable, so they shouldn't sit on disk:

```sh
# work/slim-reel.sh, with absolute paths filled in
export PROMO_WS=/Users/<you>/promo-reels/<app>-reel_<MM-DD-YY>/work
export PROMO_SRC=/path/to/users/checkout
sh <skill>/scripts/slim.sh "$@"
```

Run `sh /abs/path/work/slim-reel.sh --dry-run` and read what it will save and remove, then
run `sh /abs/path/work/slim-reel.sh`.

It saves what makes the app copy unique (`app.commit`, `app.patch`, the copy's `.env` files) and
writes `rebuild-app.sh`. Then it removes `app/`, `studio/node_modules`, `studio/out`, logs and
stale login states, through the guard. It keeps the studio source, every `promo.json`, the
captures and the scripts, which is everything a spot fix needs. A reel ends up at tens of MB.

Write the re-cut instructions into the README to match:

- **Copy, timing, zoom or look:** `npm ci --prefix work/studio`, edit the `promo.json`, check
  with `npm run sheet --prefix work/studio`, then `npm run render --prefix work/studio` back to
  the top. That's about a minute, with no app
  needed.
- **New footage:** `sh work/rebuild-app.sh`, then `sh work/setup.sh`, then re-run the shot.

Then give the user the command to open the video (`! open /abs/path/<app>-reel-16x9.mp4` on
macOS, `xdg-open` on Linux). Inside a sandbox, `open` is blocked, so running it yourself only
fails or prompts. Report the reel folder's path, each
file's length and resolution, the shot list as it ended up, and that the data shown is demo
data.
