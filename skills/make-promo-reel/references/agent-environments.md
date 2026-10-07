# Agent environments

The workflow in SKILL.md is the same in every agent. What differs is what the agent can do: run
commands outside a sandbox, keep a server running in the background, start subagents, or read
claude.ai artifacts. This file covers those differences. Read the sections that match your
session, and skip the rest.

## Sandboxed shells (Claude Code and similar)

Some agents run each shell command inside a sandbox and check its text before it runs. Claude
Code does this. Two things follow.

### Write commands that can be checked

The agent reads a command's text to decide whether it stays inside the allowed folders. It
can't do that for anything the shell works out at run time: `$VAR`, `${…}`, `$(…)`, backticks,
`~`, `export`, globs in a target path, or a `cd … &&` prefix. Such commands get a permission
prompt even when every path really is inside the allowed folders. A reel takes a few hundred
commands, so those prompts pile up.

- **Spell out absolute paths.** Expand `~` and the date yourself once (`date +%Y-%m-%d`), and
  from then on type the reel's full path, like
  `/Users/<you>/promo-reels/weekly-reel_2026-10-01/work`, and `<skill>` as its full path too.
- **Put shell logic in a script file.** Variables, `$(…)`, loops, `export`, PIDs looked up by
  port: write them into a `.sh` file under `work/`, then run it as `sh /abs/path/work/<name>.sh`.
  The agent checks the command, not what the script does, and the script is reusable on the
  next take.
- **Don't rely on `cd`.** The working directory doesn't reliably carry over to the next
  command, so point each command at its folder instead: `box`'s folder argument,
  `npm run <script> --prefix /abs/app`, `git -C /abs/app …`, or absolute paths as arguments. A
  `cd` inside a script file is fine.
- **Look up, then act.** Instead of `kill $(lsof -ti…)`, run the lookup, read the PID, and run
  `kill 48213`. Or put both steps in a script.

If the sandbox can't write to `~/promo-reels`, ask the user for a folder it can write to, and
suggest they set `PROMO_REELS` to it.

### Run the browser in `box`

Chromium can't launch inside some sandboxes (Claude Code's on macOS, for one). `<skill>/scripts/box`
runs the command in the official Playwright container (Docker) instead. The container sees only
the folder you name, plus the network. It runs outside the sandbox, so the user may need to
allow it once. The README shows the permission rule.

Don't install on the host: the first `box` run installs a Linux `node_modules` of its own, and
the image already has Chromium. `<box>` is the script's absolute path:

- `<box> --port <app port> /abs/studio -- npm run shots` (`--port` lets the page reach the
  app's dev server on `localhost`)
- `<box> /abs/studio -- npm run frames -- <shot>`
- `<box> /abs/studio -- npm run sheet`
- `<box> /abs/studio -- npm run render -- out/<name>.mp4`
- `<box> /abs/studio -- node avatars.mjs public/avatars "Maya Chen" …`

The box mounts only folders under `<reels>`, `$TMPDIR`, Claude Code's temp folder or
`$BOX_ROOTS`. Everything these scripts read or write must be inside the folder you pass: local
pages you film go in the studio, renders go to `studio/out/`, and then a plain `cp` moves the
MP4 to the reel folder.

**Spell every `box` command plainly.** Start with the absolute `box` path, and pass plain
arguments: no `$VAR`, `cd … &&`, pipes, `$(…)`, `;` or `&&`. Otherwise the agent treats it as a
compound command, prompts, and may run it inside the sandbox, where Chromium and Docker both
fail. For anything more, write a script into the folder and run
`<box> /abs/studio -- sh /abs/studio/script.sh`. If Chromium fails to launch, check the
spelling before blaming the settings.

## Background processes

The app copy's servers have to outlive one command and still be stoppable later. Start each
with the agent's own background-task feature (in Claude Code, the Bash tool's
`run_in_background` option), with its log going to a file. Don't detach with `nohup`, a trailing
`&` or `setsid`. In a sandbox, a later command can't signal a process an earlier one detached,
so it can't be stopped and holds its port after the session ends.

With no background-task feature, put the start commands in `work/start.sh` and the stop
commands in `work/stop.sh` (stopping by port, as `running-apps.md` describes), and ask the user
to run `start.sh` in a terminal of their own if a server won't stay up.

## Subagents

Two optional steps use subagents: the parallel review after the contact sheet, and any work you
choose to split up. Without subagents, do the review yourself, one lens at a time
(readability, then pacing, then brand), and keep each pass short.

**The storyboard gate holds either way.** If you are the subagent, stop at the storyboard and
hand it back for approval (see SKILL.md step 4).

## claude.ai artifacts

A claude.ai artifact link (a Design System, a page, a Design canvas) can only be read with
Claude's Artifact tool. `design-sources.md` explains how. Without that tool, don't fetch the
link with curl or a web fetch: it's a private page behind a login. Ask the user to export the
parts you need instead: the HTML file, `tokens.json`, the font files and the logo.

## Showing the result

Give the user the command to open the video rather than opening it yourself: `open` on macOS,
`xdg-open` on Linux, `start` on Windows. Sandboxes usually block it. In Claude Code, prefix it
with `!` (`! open /abs/path/<app>-reel-16x9.mp4`) so it runs in the user's own shell.
