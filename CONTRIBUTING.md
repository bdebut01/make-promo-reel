# Contributing

Thanks for helping. This repo is a skill: most of its value is in the instructions
(`SKILL.md` and `references/`), and the code exists to make those instructions mechanical. Both
kinds of change are welcome.

## Good first contributions

- **Stack notes** in `references/running-apps.md`: how to run a framework in isolation without
  dev chrome (Phoenix, Go, .NET, Spring, Astro, …). Keep to what a project's own docs tend to
  leave out.
- **Music**: tracks for a mood or energy that's thin in `library/music.json`. Only from sources
  whose license allows commercial use without attribution, with the license URL. Measure
  `startAt`, `rms` and `bpm` the way the existing entries do, and say how in the PR.
- **Moods and motion** in `template/src/theme.ts`, with a contact sheet showing them.
- **Eval results**: a run of `evals/evals.json` against an app you're allowed to show, with what
  passed and failed.

## Working on the skill

```sh
git clone https://github.com/OWNER/make-promo-reel
ln -s "$PWD/make-promo-reel/skills/make-promo-reel" ~/.claude/skills/make-promo-reel
```

Then ask your agent for a promo of any app and watch the run. The symlink means edits take
effect on the next session.

To work on the studio directly:

```sh
cp -R skills/make-promo-reel/template /tmp/studio && cd /tmp/studio
npm install && npx playwright install chromium
npm run studio        # Remotion's preview UI
npx tsc               # typecheck
```

### Writing instructions

- Explain **why**, not only what. An agent follows a reason into cases the rule didn't name.
- Keep `SKILL.md` to the workflow; detail goes in a `references/` file that `SKILL.md` says
  when to read.
- Write for an agent that can't ask you: plain words, one meaning per sentence, concrete
  examples.
- Don't add anything specific to your machine: no absolute paths, usernames or private URLs.
  Use `<reels>`, `<ws>`, `<skill>` and `/Users/<you>/…` as the existing text does.

### Code

- Plain Node ESM for scripts, with no dependencies beyond what `template/package.json` installs.
  POSIX `sh` for shell scripts (`box` is bash).
- Pin versions. Playwright in `template/package.json` must match the `box` image tag.
- Anything that deletes goes through `guard.sh`. A PR that weakens the guard needs a strong
  reason in its description.

## Before you open a PR

CI runs these checks. Run them locally:

```sh
for f in $(git ls-files '*.mjs'); do node --check "$f"; done
shellcheck -S error skills/make-promo-reel/scripts/*.sh skills/make-promo-reel/scripts/box
sh skills/make-promo-reel/tests/guard-test.sh
(cd skills/make-promo-reel/template && npm install --ignore-scripts && npx tsc)
```

If your change affects the video, attach a contact sheet (`npm run sheet` → `out/sheet.png`)
or a short clip. Use demo data only: no real people's names, faces or private app content.

## Reporting a problem

Open an issue with your agent and version, the app's stack, the step that went wrong, and the
relevant part of the transcript or `notes.md`. Leave out secrets and private data.
