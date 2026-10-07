# Building a demo world

A promo's footage is only as convincing as the data in it. An app populated by "Test User 1" and
three items reads as abandoned. An app with a dozen specific people, varied content and a little
history reads as a place people already live. The viewer never studies the data. They just
*feel* whether it's real.

## Look before you invent

In rough order of preference:

1. **Curated demo data the team already made:** fixtures or `demo` folders, seed scripts
   (`seeds.rb`, `prisma/seed.ts`, `manage.py` commands with "demo" or "seed" in the name), sibling
   repos (`<app>-demo-data`) or a folder of demo images. Someone already chose names and photos
   that fit the product.
2. **Test factories and e2e fixtures:** good for structure, but usually thin or silly on
   content. Borrow the shapes, rewrite the words.
3. **Your own world**, built as below.

Existing demo data can be dated: last year's timestamps, or a schema that has moved on, so the
fixture no longer loads. Load it if you can. If it fails, read it as data and recreate the
records through the app's code, keeping its images. Then fix what reads wrong: shift dates to be
recent, rewrite one-word titles, and fill gaps in the screens you'll film.

**Check the people before using them.** Teams sometimes build demo data from themselves: their
own accounts, names and profile photos. Compare every person against the repo's authors
(`git log --format='%an <%ae>' | sort -u`), any CONTRIBUTORS or team page, and the app's about
page. A match gets a fictional name and a different photo, and the rest of the record stays.
The other demo headshots are usually stock or placeholder faces the team collected, and fine to
use. If you can't tell, ask the user; they usually know at a glance. If a real person clearly
wants to be in it (the founder, say), that's for the user to confirm.

## Designing the world

- **One protagonist:** the logged-in user. Give them a name, a face and a reason to use the app.
  Everything on screen is from their point of view, so their feed, inbox and dashboard need
  content.
- **A small cast, 6–12 others,** with diverse, plausible, fictional names (a mix of cultures and
  lengths), each with a consistent role. "Maya lends tools", "Sam always borrows the ladder". A
  consistent cast makes the cuts feel like one story.
- **Specific content:** "DeWalt 20V cordless drill (two batteries)", not "Drill". "Q3 roadmap
  review – pricing tiers", not "Meeting 1". Vary the lengths: some short titles, some that wrap.
- **Lived-in numbers:** 37, 214, 1,284 — not 10, 100, 1000. Include a few small ones: a new item
  with 1 view, a group with 3 members.
- **A recent history:** timestamps spread over the last few weeks relative to today, with a
  couple within the last hour so "2m ago" and "Just now" appear. Mix the states: pending,
  approved, completed, overdue.
- **Fictional people only:** `maya.chen@example.com` and `(555) 010-2231`. Use the
  `example.com` and `555-01xx` ranges, which exist for exactly this. Never a real person's data,
  even a public figure's.
- **Scale to the screens you'll film:** a feed needs enough items to scroll through twice, and a
  chart needs 30–90 data points with a believable trend (mostly up, with noise and a dip).
  Screens you won't film can stay thin.

## Images

Images do more for the mood than anything else, and they're where demo worlds most often fail.

Media the user supplied at intake (question 5) comes before everything below. Its rules are
in `design-sources.md` under "Supplied media".

- **People:** photos read warmer than initials. In order of preference:
  1. The demo repo's headshots, minus any real team member's.
  2. Free-to-use portraits: generated faces, or portrait sets published for UI mockups under a
     license that permits this use. Record where each came from in `notes.md`.
  3. `avatars.mjs` initials, which many real apps show and so still read as authentic. They're
     also good for a few people in a mostly-photo cast, for variety.
- **Content photos** (items, listings, products, places): use demo or repo assets or files the
  user provides. If none exist, ask the user whether to use a stock source they're licensed for.
  Don't hotlink or scrape images: licensing is theirs to decide, and a broken image on camera is
  worse than none. For some content, a well-designed placeholder the app itself renders (a
  colored tile with an icon) looks better than mismatched photos.
- **Aspect and quality:** crop content photos to the ratio the UI displays, so the app's object-fit
  doesn't show awkward crops, and keep them at least 2× the displayed size (the capture runs at
  dpr 2).

## Loading it

- Go through the app's own code paths: ORM calls in a script or shell, management or rake
  commands, the public API, or the UI via Playwright for small amounts. Raw SQL skips signals
  and hooks that keep derived data right (counts, notifications, search indexes, image
  thumbnails).
- Write the seed as a script in the workspace (`<ws>/seed.py`, `seed.ts`, …) rather than
  one-off shell commands, so the world can be rebuilt from scratch after a bad take. The reset
  script that wipes the database and media first runs `guard.mjs` on exactly the paths or
  database names it's about to delete (see SKILL.md, "Guard every destructive step").
- Some apps disable signals during bulk loads. If the app ships a custom loader for its
  fixtures, use it. If that loader fails against the current schema, go back to the ORM (see
  "Look before you invent").

## Checking it

Before storyboarding, screenshot every screen you might film and look at each one:

- nothing empty, no "No results", no zero counts where you want life
- no placeholder text, "test" or "asdf" strings, or broken images
- text that fits (no overflowing names or ugly truncation in the spots the camera will zoom to)
- dates that read as recent
- the protagonist's screens feel like theirs
