# Running an app in isolation

The goal is the app running from `<ws>/app` with its own database, on its own ports, and looking
the way a real user sees it: no dev chrome, and every asset loaded. The project's own docs come
first. These notes cover what they tend to leave out.

## General

- **Ports:** check what's already listening (`lsof -iTCP -sTCP:LISTEN -n -P`) and pick unused
  ones. The user's dev servers on the default ports are theirs.
- **Background processes:** start each process with its logs going to a file
  (`> /abs/path/work/logs/web.log 2>&1`, using Bash's background option rather than a trailing
  `&`, `nohup` or `setsid`: the sandbox won't let a later command kill a detached process, so
  it would outlive the reel and hold its port) and record its PID in `notes.md`, so you can stop exactly what you started. If starting
  it takes env vars or several steps, put them in `work/start.sh` and run that.
- **Stopping servers:** `uv run`, `npm run`, `poetry run` and `bundle exec` are wrappers. Killing
  the recorded PID can leave the real server alive and still listening, so a "restarted"
  server is the old one. Stop by port instead: run `lsof -tiTCP:<port> -sTCP:LISTEN`, then
  `kill` the PIDs it prints, typed out (`$(…)` in the command gets a permission prompt), or keep
  both steps in a `work/stop.sh`. Check the port is free before starting again.
- **Readiness:** poll with `curl -s -o /dev/null -w '%{http_code}'` until you get a 200 (or a 302
  to login). Don't sleep a fixed time.
- **Asset servers:** many stacks run a second process for CSS and JS (Vite, webpack,
  tailwind --watch). If the screenshot looks unstyled, a missing asset server or an unbuilt
  bundle is the usual cause. A one-off production build of the assets is often simpler than a
  watcher.
- **Third-party requests from the page:** apps often load analytics, CDN scripts and avatar
  services. `openApp` blocks common analytics hosts by default (`blockAnalytics`), so demo
  sessions don't land in the product's stats. CDN scripts are fine to load. If something must
  not leave the machine, `context.route()` can serve it from a local copy.
- **Editing env files in the copy:** env files often lack a trailing newline, so `>>` glues the
  new line onto the last one (`X=FalseMESSAGING_ENABLED=True`). Append with
  `printf '\nKEY=value\n' >> .env`, then read the file back.
- **Feature flags:** note which filmed features are behind flags, and turn them on in the copy
  only. Tell the user which were off by default.
- **Secrets:** never use production keys or credentials in the copy, even read-only ones: a
  promo run has no reason to reach production. `.env.example` shows which variables are required. Fill required ones with
  harmless local values. Leave third-party integrations off, or use their test mode, unless a
  filmed moment needs them. In that case, ask the user.

## Node (Next.js, Vite, Remix, SvelteKit, Nuxt)

- `npm ci`, or the lockfile's own manager: `pnpm i --frozen-lockfile` or `yarn --frozen-lockfile`.
- Prefer `build` + `start` (production) over `dev`. You get no dev indicator or error overlay,
  and pages load faster, which means shorter holds. Next.js: `next build && next start -p <port>`.
  Vite SPAs: `vite build && vite preview --port <port>`.
- If the app needs `dev` (for example, a production build requires secrets), hide the overlays.
  In Next.js, set `devIndicators: false` in `next.config` in the **copy**.
- Prisma or Drizzle: point `DATABASE_URL` at a new SQLite file in the copy or a new Postgres
  database named `<app>_promo`, then
  run the project's migrate and seed scripts.

## Python (Django, Flask, FastAPI)

- On Apple Silicon, `uv sync` can pick an x86_64 interpreter (for example a Homebrew build under
  Rosetta), and then packages like `cryptography` fall back to slow or failing source builds.
  `uv sync --managed-python --python <version>` gets a native one.
- `uv sync` if there's a `uv.lock`, else `python -m venv .venv && .venv/bin/pip install -r requirements.txt`.
- **Django:** check `settings` for how the database is chosen (often `DATABASE_URL` or `DB_*`
  env vars, or a SQLite path relative to `BASE_DIR`, which in the copy is already separate).
  Then `migrate`, the project's fixture and seed commands, and `createsuperuser --noinput` with
  `DJANGO_SUPERUSER_*` env vars, or a shell script that creates the demo user. Hide the debug
  toolbar (`DEBUG_TOOLBAR_CONFIG = {"SHOW_TOOLBAR_CALLBACK": lambda r: False}` or remove it from
  `INSTALLED_APPS` in the copy). Set `EMAIL_BACKEND = "django.core.mail.backends.console.EmailBackend"`.
  If media uploads matter, make sure `MEDIA_ROOT` is inside the copy.
  - **django-vite and DEBUG:** django-vite's dev mode usually follows `DEBUG`, but
    `DEBUG=False` stops `runserver` serving `/media/`. In the copy, decouple the two: keep DEBUG
    on, set `DJANGO_VITE` `dev_mode` from its own env var, and run `npm run build`. You get
    built assets and working media.
  - **Warm image caches off camera:** open every page a shot will show once before recording,
    so thumbnails generated on first request already exist when the camera gets there.
  - **Thumbnail caches:** libraries like django-imagekit cache "this thumbnail exists" in the
    server process. After wiping and reseeding media, restart the server, or images 404.
  - **Stale fixtures:** a fixture dump can predate newer non-null columns and fail on load. Read
    it as data and recreate the records through the ORM, reusing its images.
- **Flask and FastAPI:** find the DB URL in the config or env. Run migrations with Alembic or
  Flask-Migrate, and the seed script if there is one.

## Ruby (Rails)

- `bundle install`, `bin/rails db:prepare`, `bin/rails db:seed`. Use `bin/dev` if the app uses
  Procfile.dev (it starts the CSS and JS watchers too). Otherwise run
  `bin/rails assets:precompile` and `bin/rails s -p <port>`.
- Use a new database name ending in `_promo` through `DATABASE_URL`, or the copy's own `config/database.yml`
  development entry.

## PHP (Laravel)

- `composer install`, `cp .env.example .env`, `php artisan key:generate`, a SQLite DB file
  (`DB_CONNECTION=sqlite`), `php artisan migrate --seed`, `npm run build`,
  `php artisan serve --port <port>`.

## Docker Compose

- Run with a project name so nothing collides with the user's containers: `docker compose -p
  <app>-promo up -d`. Remap host ports with an override file in the copy. Tear down with
  `docker compose -p <app>-promo down -v` at the end: `-v` removes only this project's volumes.
  Check the project name before running it; `-p` is what keeps it off the user's own stack.

## Static sites and SPAs with a remote backend

- A frontend that talks to a hosted API can't be seeded locally without a backend. Ask the user
  whether there's a staging or local backend. Otherwise, mock the API with Playwright's
  `page.route()` in the shot scripts, serving fixture JSON you write. This keeps the demo world
  fully under your control, and is often the fastest path for SPAs.

## Login

- Create the demo user through the app's own path, then log in once with Playwright and save
  the state: `await app.saveLogin("<ws>/studio/auth.json")`. Later shot scripts pass
  `storageState: "auth.json"`.
- If the app uses OAuth only (Google or GitHub sign-in), look for a dev or test login, a
  password fallback, or a way to mint a session in a shell. Ask the user if there's none; don't
  drive a real OAuth flow with their account.
