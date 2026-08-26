# P1 Bridge — dev tool (PoC only, not production)

`src/app/renderer-poc/P1Section.tsx` (Phase P1 diagnostic page, `/renderer-poc`)
talks to two **manually-started, localhost-only scratch processes**. Neither
is part of the TateSpun app or its dependencies. This folder just makes them
reproducible so a fresh Claude session / fresh machine doesn't have to
reinvent them (a prior ad hoc copy outside the repo was lost between
sessions — this is the fix).

No package.json here on purpose — the bridge uses only Node builtins, and
Vivliostyle CLI is run via `npx` (nothing installed into this repo).

## A. Start the bridge (port 13021)

```
node tools/renderer-poc/p1-bridge-server.mjs
```

Windows (matches this repo's `npm.cmd` convention — plain `node` works the
same):

```
node tools\renderer-poc\p1-bridge-server.mjs
```

This writes `tools/renderer-poc/served/current.html` on every `POST /update`
from P1Section.tsx, and serves it back at `GET /current.html` on its own
origin for quick checks. Leave this running in its own terminal.

## B. Start the Vivliostyle preview server (port 13020)

In a **second** terminal, from this directory (`tools/renderer-poc/`):

```
npx --yes @vivliostyle/cli@9.2.0 preview served/current.html --host 127.0.0.1 --port 13020 --no-open-viewer
```

(`--no-open-viewer` skips auto-opening a browser tab; drop it if you want
one. `-d` adds debug logging.) This is the exact command line confirmed
working against this Vivliostyle CLI version — not guessed. It serves the
Viewer app **and** exposes the file at the fixed virtual path
`http://127.0.0.1:13020/vivliostyle/current.html`, which is what
P1Section.tsx's iframe loads (that URL is hardcoded in P1Section.tsx; this
bridge does not need to return it).

First run downloads the CLI via npx into the npm cache (outside this repo) —
takes longer once, instant after.

## C. Start TateSpun itself

Not this tool's job. Use your own normal dev server:

```
npm.cmd run dev
```

Then open `http://localhost:3000/renderer-poc`.

## D. Ports

| Process | Port | Bind |
|---|---|---|
| p1-bridge-server.mjs | 13021 | 127.0.0.1 only |
| vivliostyle preview | 13020 | 127.0.0.1 only |
| TateSpun dev server | 3000 | (yours, unmanaged by this tool) |

Override bridge port/CORS origin via env vars if needed:
`P1_BRIDGE_PORT`, `P1_VIV_PORT` (docs only, doesn't change the other
process), `P1_ALLOWED_ORIGIN` (default `http://localhost:3000`).

## E. Stop

Ctrl+C in each terminal (bridge and vivliostyle preview). No background
services, no installed daemons.

## F. Dependency note

`@vivliostyle/cli` is **not** a TateSpun dependency — it is never added to
this repo's `package.json` or `package-lock.json`. It runs only via `npx`
(npm's own cache, outside the repo) as shown in step B.

## Known limitation

`POST /update` currently returns `pages: null` — it does not drive a headless
browser to read Vivliostyle's real page count. P1Section.tsx already handles
that gracefully (shows `—`). A working (but heavier, CDP/headless-Edge-based)
version of that measurement step existed in a prior scratch session; it was
intentionally left out here to keep this dev tool small and dependency-free.
Add it back as a separate, explicit step if real page counts are needed for
a future P1-B acceptance run.
