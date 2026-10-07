# Changelog

## 1.0.0

First public release.

- Workflow: intake, running the app in isolation, demo world, storyboard, Playwright capture,
  Remotion compose and render, delivery with a re-cuttable reel folder.
- 16:9, 1:1 and 9:16 cuts; `clean`, `playful` and `bold-dark` moods; `gentle`, `bouncy` and
  `snappy` motion.
- Design sources (design systems, HTML/CSS, token JSON) and supplied media steer the look.
- Synthesized UI sound kits and a curated Mixkit music library.
- Capture hides chat widgets, banners and dev ribbons (`hide`, `hideTexts`).
- Storyboard approval is recorded in `storyboard.md` and holds when the skill runs as a
  subagent.
- `npm run loudness` checks −14 LUFS and true peak; the contact sheet reports cut spacing in
  beats; an optional parallel review covers readability, pacing and brand.
- Reels ship with an asset and license table, and optional post copy.
- `npm run gif` makes a palette-optimized GIF from a rendered cut, for READMEs and docs.
- Agent-neutral: SKILL.md describes capabilities, and Claude Code specifics (sandbox, `box`,
  background tasks, Artifact tool) live in `references/agent-environments.md`. Frontmatter
  gains `license` and `compatibility`, and CI runs the Agent Skills validator.
- Reel folders are dated `YYYY-MM-DD`.
- `guard.sh` for destructive steps, `slim.sh` to shrink finished reels, and `box` to run
  Chromium in Docker where the host sandbox blocks it.
