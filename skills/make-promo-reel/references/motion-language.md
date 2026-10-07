# Motion language for app promos

The look to aim for is the one used in current SaaS launch videos (Linear, Arc, Raycast, Notion
and Screen Studio–style product clips): real UI, framed and slightly zoomed, with short kinetic
captions over a soft branded background. The graphics serve the footage. When in doubt, take
something away.

## Structure

A promo follows one arc: **hook → 2–4 moments → payoff**.

- **Hook (the first 1.5–2s):** the product name or logo plus a one-line promise. Social feeds
  decide in about a second, so the first frames should already show the brand or the product.
- **Moments:** each one is a single benefit, shown by one action with a visible result. A moment
  that needs explaining is the wrong moment.
- **Payoff (the last 2.5–3.5s):** logo, a tagline that restates the promise, one CTA, and the
  URL. Hold it long enough to read twice.

Choose moments by what the viewer *feels*, not by feature count. The strongest moments usually
are:

1. the core loop working end to end (search → find → act → done)
2. something that feels effortless or fast (instant results, one-tap actions)
3. the social or "alive" proof (other people's content, activity, notifications)
4. the delight detail (a nice empty state, an animation, a satisfying confirmation)

Let the moments tell one small story about one thing: this invoice gets drafted, sent and
paid. The viewer follows an object, not a menu.

## Timing templates

A shot's length is `leadIn + (trimEnd − trimStart) / speed`. Transitions don't eat into
shots: a shot that follows a cut is lengthened by the cut, so its lead-in starts on a settled
screen. With an intro, shots and an end card, the video comes to **the sum of the scene
lengths minus one transition** (the cut into the end card). A transition is 0.4s for fade, 0.47s
for slide and 0.33s for wipe. `sheet.mjs` prints the real total.

Length follows the content, never the reverse: count the moments the app genuinely has, then
read off the shape. The user's number is a cap. These rows are typical shapes, not targets:

| Shape | Intro | Shots (each including a 1s lead-in) | End |
|---|---|---|---|
| ~10s, two quick moments | 2.0s | 2 × 3.2s | 2.0s |
| ~15s, two full moments | 2.0s | 2 × 5.0s | 3.4s |
| ~20s, three moments | 2.2s | 3 × 5.0s | 3.2s |
| ~30s, four moments (a launch tour) | 2.5s | 4 × 6.1s | 3.5s |

(The rows add up for fade: each sums to the target plus 0.4s.)

Fewer, longer moments beat many quick ones. A viewer needs about 1s to read a short caption,
and only then starts watching the screen, so the caption lands on a still frame (`leadIn`) before
the action plays. After that, give the action 2–3.5s, plus a beat on the payoff. A shot under
3.2s all-in feels rushed, while one over 6.5s lets attention drift. Don't trim a lead-in below
the default to hit a length; cut a moment or use `speed` up to 1.2 instead.

**The intro needs at least 2.0s, and the end card at least 2.0s.** The intro's headline lands
about 0.8s in and needs over a second on screen to be read. The end card is the frame people
remember. At 10s, those minimums leave room for exactly two quick moments.

**With music**, if the user knows the BPM, make every scene a multiple of one beat (60 / BPM
seconds), so cuts land on beats. At 120 BPM a beat is 0.5s, and a 3.5s shot is 7 beats.

## Captions

- **Five words or fewer, benefit-first, present tense:** "Your team, in sync", "Paid in two
  taps", "Every lead in one place". Avoid feature names ("Request Management") and filler ("Easily…",
  "Seamlessly…").
- **One hot word or short phrase per caption** gets the accent (`*one tap*` in promo.json): the
  words carrying the benefit, not the product name.
- **Sub-lines are optional** (≤ 8 words) and rarely needed. If the caption needs one, the caption
  is probably wrong.
- **Describe the control the user has, not an outcome the product can't promise.** "You
  approve" or "Your call", not "You say yes". "Find it nearby", not "Always available". A
  caption that overclaims reads as marketing, and can be untrue for some users.
- **Write the words the user would say to a friend,** in the app's own voice. A playful app
  shouldn't sound corporate.
- **Sentence case.** Title Case Reads Like An Ad.

## Transitions

Every scene sits on one shared background that drifts continuously. `fade` is a dip: the
outgoing scene clears before the incoming one appears, so two scenes' text is never on screen at
once. `wipe` clips both scenes at the same moving edge. `slide` pushes one out as the other
comes in. A classic crossfade double-exposes captions and reads as muddy, which is why the
template doesn't use one.

## Look like the product

The presets make any app look tidy. What makes a promo feel like *this* product is its own
material:

- **The app's own fonts** for captions (`brand.fonts`, `brand.headlineFont`).
- **Its illustrations, mascot or landing-page art** in the intro (`intro.art`).
- **Its real content photos:** items, places, people's avatars. They go on the end card
  (`end.photos`) or wherever else they fit.
- **A background tinted from its palette**, not the preset's default glow (`brand.background`).
- **One signature touch** written for this product in the studio copy. Examples: a marker-style
  underline in the brand's highlight color, an animated empty-state illustration, or photos of
  shared things drifting between avatars for a sharing app. One such idea is plenty.

## Mood presets

Pick the preset that matches the app's own UI and audience, then let the brand colors do the
rest. Set it with `"mood"` in promo.json.

| Mood | Suits | Background | Type | Motion | Transition |
|---|---|---|---|---|---|
| `clean` | B2B, productivity, tools, calm consumer | light, brand-tinted glow | Inter 700 | soft ease-out, no bounce | fade (a dip, not a crossfade) |
| `playful` | community, social, consumer, food, kids | solid brand color | Nunito 900, rounded | springy, slight overshoot | slide |
| `bold-dark` | dev tools, AI, fintech, gaming, pro creative | near-black with an accent glow | Space Grotesk | snappy, tilt-in | wipe |

Brand overrides:

- `brand.primary` and `brand.accent` recolor the backgrounds, highlights and CTA. In `playful`,
  hot words are a white pill with primary-colored text, and the glow is the accent mixed with
  white. A warm accent over a cool primary turns muddy, so pick an accent from the same family.
- `brand.background` replaces the base.
- `brand.font` and `brand.headlineFont` take a family name: either one of the preloaded fonts
  (Inter, Nunito, Space Grotesk) or one declared in `brand.fonts` from files in
  `public/fonts/`.

## Camera

- **Restraint first.** Default to one punch-in per shot, on the payoff, and keep about half the
  shots wide. A second zoom in a shot is fine when it shows a second thing the viewer must see
  up close. A camera that is always moving makes the viewer work to find the UI and reads as
  over-produced. Motion should point at the one thing that matters in the shot.
- **Gentle scale:** about 1.4× for desktop captures and 1.25× for a phone. Go higher only when
  the payoff is a small element. Beyond 2×, UI pixels start to show.
- **Establishing shots stay wide** (`"zoom": "none"`): a dashboard or feed overview, where the
  point is how much is there.
- **Hold the frame steady while zoomed.** A zoom frames the whole moment and holds still. A
  camera that trails the cursor slides back and forth and reads as shake.
- **The cursor moves like a confident user:** one smooth arc to the target, a beat, then the
  click. No wandering, no hovering over things that don't matter.
- **One action per shot where possible.** Two is fine when they're one gesture, like typing a
  query and then picking the result.

## Things that make promos look amateur

- Empty states, placeholder text, test data, or the same avatar everywhere.
- Dev chrome: debug toolbars, framework overlays, console-error toasts, "localhost" in the URL
  bar (the frame shows `brand.url`).
- Captions that describe what's on screen ("Click the button to request") instead of why it
  matters.
- Too many moments. Three well-held ones beat six rushed ones.
- Pacing that makes the viewer choose between reading the caption and watching the app.
- A camera that never stops zooming and panning, or one that drifts after the cursor.
- Real people. Demo data often carries teammates' names and photos.
- Motion on everything: if the caption, the frame and the zoom all move at once, nothing reads.
  The template staggers them, so keep it that way when editing.
- Ending on a feature instead of the brand. The last frame is the one people remember.
