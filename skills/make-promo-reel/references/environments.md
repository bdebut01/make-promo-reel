# Environments

The workflow in SKILL.md is the same on every OS and in every agent. What differs is the shell
(sh or PowerShell), whether commands run in a sandbox, and what the agent can do: keep a server
running in the background, start subagents, or read claude.ai artifacts. This file covers those
differences. Read the sections that match your session, and skip the rest.

The skill's own scripts are Node (`.mjs`) and run the same everywhere, so prefer them over shell
one-liners: `guard.mjs`, `slim.mjs`, `port.mjs`, `serve.mjs`, and the studio's npm scripts.

## Windows

- **Shell.** Claude Code on Windows runs its commands through Git Bash by default, so `sh` scripts usually work there.
  Other agents often use PowerShell. Either way, write any script you'd keep (setup, reset, a
  shot runner) in Node, or in the session's own shell: `setup.sh` for sh, `setup.ps1` for
  PowerShell. Don't mix the two in one command.
- **Paths.** Reels default to `%USERPROFILE%\promo-reels` (Node's `os.homedir()`). Node and
  git accept forward slashes, so `C:/Users/<you>/promo-reels/...` works in commands and JS.
  Quote paths that contain spaces. Keep the reels folder short: `node_modules` nests deep, and
  long paths can still fail where Windows' long-path support is off.
- **The date** for the folder name: `node -p "new Date().toISOString().slice(0,10)"` works in
  any shell (`Get-Date -Format yyyy-MM-dd` in PowerShell).
- **The browser** launches on the host, so install Chromium with
  `npx --prefix <studio> playwright install chromium` and run the npm scripts directly. `playwright-docker` is
  a bash script for macOS and Linux sandboxes and isn't needed here; under WSL it works as on
  Linux.
- **Python apps** keep their virtualenv tools in `.venv\Scripts\`, not `.venv/bin/`, and the
  interpreter is usually `python` or `py`, not `python3`.
- **Environment variables** are set as `$env:NAME = "value"` in PowerShell and `NAME=value cmd`
  in sh. The guard and slim scripts take `--ws` and `--src` flags instead, so their commands
  are identical in both.
- **Line endings.** The repo's `.gitattributes` keeps LF on checkout. If a copied script fails
  with `$'\r': command not found`, it was saved with CRLF; convert it back to LF.

## Sandboxed shells (Claude Code and similar)

Some agents run each shell command inside a sandbox and check its text before it runs. Claude
Code does this. Two things follow.

### Write commands that can be checked

The agent reads a command's text to decide whether it stays inside the allowed folders. It
can't do that for anything the shell works out at run time: `$VAR`, `${…}`, `$(…)`, backticks,
`~`, `export`, globs in a target path, or a `cd … &&` prefix. Such commands get a permission
prompt even when every path really is inside the allowed folders. A reel takes a few hundred
commands, so those prompts pile up.

- **Spell out absolute paths.** Expand `~` and the date yourself once (`date +%Y-%m-%d`, or the
  Node form under Windows above), and
  from then on type the reel's full path, like
  `/Users/<you>/promo-reels/weekly-reel_2026-10-01/work`, and `<skill>` as its full path too.
- **Put shell logic in a script file.** Variables, `$(…)`, loops, `export`, PIDs looked up by
  port: write them into a `.sh` file under `work/`, then run it as `sh /abs/path/work/<name>.sh`.
  The agent checks the command, not what the script does, and the script is reusable on the
  next take.
- **Don't rely on `cd`.** The working directory doesn't reliably carry over to the next
  command, so point each command at its folder instead: `playwright-docker`'s folder argument,
  `npm run <script> --prefix /abs/app`, `git -C /abs/app …`, or absolute paths as arguments. A
  `cd` inside a script file is fine.
- **Look up, then act.** Instead of `kill $(lsof -ti…)`, use `port.mjs stop <port>`, or run
  the lookup, read the PID, and type it into the next command.

If the sandbox can't write to `~/promo-reels`, ask the user for a folder it can write to, and
suggest they set `PROMO_REELS` to it.

### Run the browser in `playwright-docker`

Chromium can't launch inside some sandboxes (Claude Code's on macOS, for one). `<skill>/scripts/playwright-docker`
runs the command in the official Playwright container (Docker) instead. The container sees only
the folder you name, plus the network. It has to run outside the sandbox: the user lists it in
`sandbox.excludedCommands` as `"<path> *"` (the README shows the settings). If it fails with
"operation not permitted" on `~/.docker/config.json`, it ran inside the sandbox: check the
command's spelling (below), then ask the user to check that entry and restart.

Don't install on the host: the first `playwright-docker` run installs a Linux `node_modules` of its own, and
the image already has Chromium. `<playwright-docker>` is the script's absolute path:

- `<playwright-docker> --port <app port> /abs/studio -- npm run shots` (`--port` lets the page reach the
  app's dev server on `localhost`)
- `<playwright-docker> /abs/studio -- npm run frames -- <shot>`
- `<playwright-docker> /abs/studio -- npm run sheet`
- `<playwright-docker> /abs/studio -- npm run render -- out/<name>.mp4`
- `<playwright-docker> /abs/studio -- node avatars.mjs public/avatars "Maya Chen" …`

The container mounts only folders under `<reels>`, `$TMPDIR`, Claude Code's temp folder or
`$PW_DOCKER_ROOTS`. Everything these scripts read or write must be inside the folder you pass: local
pages you film go in the studio, renders go to `studio/out/`, and then a plain `cp` moves the
MP4 to the reel folder.

**Spell every `playwright-docker` command plainly.** Start with the absolute `playwright-docker` path, and pass plain
arguments: no `$VAR`, `cd … &&`, pipes, `$(…)`, `;` or `&&`. Otherwise the agent treats it as a
compound command, prompts, and may run it inside the sandbox, where Chromium and Docker both
fail. For anything more, write a script into the folder and run
`<playwright-docker> /abs/studio -- sh /abs/studio/script.sh`. If Chromium fails to launch, check the
spelling before blaming the settings.

## Background processes

The app copy's servers have to outlive one command and still be stoppable later. Start each
with the agent's own background-task feature (in Claude Code, the Bash tool's
`run_in_background` option), with its log going to a file. Don't detach with `nohup`, a trailing
`&` or `setsid`. In a sandbox, a later command can't signal a process an earlier one detached,
so it can't be stopped and holds its port after the session ends.

With no background-task feature, put the start commands in a start script, stop servers with
`port.mjs stop <port>`, and ask the user to run the start script in a terminal of their own if
a server won't stay up.

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
