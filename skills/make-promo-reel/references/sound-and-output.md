# Sound and output

Read this at step 6 of SKILL.md, once the contact sheet looks right.

## Sound

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
  With a `bpm` in the music block, `npm run sheet` prints the spacing between cuts in beats;
  nudge `trim` or `duration` until it reads whole numbers. It knows the tempo, not where the
  downbeat falls, so listen to the first cut once.
  Record the track and its license in the reel's README. The license requires no attribution,
  but it's what makes the reel's music traceable.
## Rendering

- **Render, then copy to the reel folder:**
  `npm run render -- out/<app>-reel-16x9.mp4`, then
  `npm run loudness -- out/<app>-reel-16x9.mp4`, then
  `cp /abs/studio/out/<app>-reel-16x9.mp4 /abs/reel/`. The loudness check wants about -14 LUFS
  with true peak under -1 dBTP, which is where social platforms normalize. When it fails, it
  prints a factor: scale `music.volume` and `sfx.volume` by it and render again. In the box, Remotion uses the image's
  Chromium (`remotion.config.ts` and `sheet.mjs` read `$CHROME`). For another aspect ratio,
  write `promo-9x16.json` with the new `width`/`height` (and mobile clips) and run
  `npm run render -- out/<app>-reel-9x16.mp4 --props=public/promo-9x16.json`.
## GIF

- **A GIF** (a README, docs, an issue): render the MP4 first, then
  `npm run gif -- out/<app>-reel-16x9.mp4 out/<app>-reel.gif 800 15`. Don't use Remotion's own
  `--codec=gif`: the template's quality settings don't apply to it, and its palette is worse. A
  GIF has no sound, so set `"sfx": false` and `"music": null` for that cut, and keep it to about
  10s. The script prints the size: GitHub shows GIFs up to 10 MB inline, ideally under 5 MB.
  Shorten the cut first, then drop the fps to 12, then the width.
