# Agent Note: The web GUI gets a native desktop shell behind --desktop

Status: implemented

English | [中文](2026-08-14-desktop-shell-for-web-gui.zh.md)

## Problem

`dsh web` serves the browser GUI on a loopback port and prints a URL; users who want a desktop program get a terminal plus a browser tab. Turning the GUI into a standalone application is not possible from the browser side: the server process is the surface — its sessions, its HMR, its URL line — and a desktop form has to attach to that same server, not replace it with a second one.

## Decision

`dsh web --desktop` (also `--profile web --desktop`, and `pnpm run desktop` from the repository root) opens the GUI in a native Electron window over the same loopback server. The change has three layers:

- **The shell** — a new `apps/desktop` package (`@deepseek-ai/dsh-desktop`) holds a plain-JavaScript Electron main (`electron/main.js`, no lib build). It is driven entirely by environment: `DSH_DESKTOP_URL` (the URL to render), `DSH_DESKTOP_OWNER_PID` (the serving dsh process), and `DSH_DESKTOP_SMOKE_MS` (a bounded smoke mode that quits without stopping the owner). The window polls the URL for up to 30 seconds, then fails with a visible error; `setWindowOpenHandler` routes links to the default browser; the renderer runs sandboxed with context isolation and no Node integration.
- **The launcher row** — `packages/bundle/web-app/src/desktop.ts` exports the `web-desktop` function plugin (`{enabled}` config, injects `webServer`), added to the web bundle patch as the `web-desktop` row with `enabled: !!js ctx.webStartup.desktop ?? false`. It resolves the shell through its declared dependency on `@deepseek-ai/dsh-desktop` (app dir from the package manifest, the Electron binary from the `electron` package linked inside it), waits for the same Loader settlement as the URL line, then spawns the shell with the live server's loopback URL and its own pid. Resolution failure degrades to a warning and the browser URL — desktop mode never fails the boot. Row disposal kills the spawned shell so no orphan window outlives its composition.
- **The flag** — `web-startup` parses `--desktop` into `webStartup.desktop`, exactly like `--host`/`--port`/`--trusted-host`; nothing else in the launcher changes.

Shell and launcher own one lifetime by pid contract: closing the window stops the launcher (a forced `taskkill /T /F` tree kill on Windows — there is no graceful SIGTERM there; `SIGTERM` elsewhere), and a 2-second owner watch in the shell closes the window when the launcher dies first (Ctrl+C). Because the launcher process serves every session and browser tab on that URL, closing the desktop window ends them all — the same lifetime a Ctrl+C already owns.

## Alternatives considered

- **A packaged, standalone Electron app that spawns its own server child** — rejected for this change: the launcher would exit before anything is verified, and the shell would have to re-implement server readiness (stdout URL parsing) and pass-through of every launcher flag. Attaching to the already-booted server keeps one process model, one readiness signal, and graceful degradation to the browser.
- **An `electron` product family beside the web family** (separate capability packages per product) — rejected; the [GUI layering decision](../architecture/2026-07-19-gui-layering-and-rpc-protocol.md) already settled that products share host/client capabilities, and this shell adds zero capability packages: it renders the same served surface.
- **Chromium WebView / Neutralino / Tauri** — rejected: Electron is the maintained default with an npm-installed binary, so the whole desktop mode is one devDependency and one plain-JS file.
- **Killing only the window's session, or not stopping the launcher on close** — rejected: desktop-program semantics say closing the window quits the program, and the launcher is the program; per-session teardown has no lifecycle owner at the surface level.

## Consequences

- `dsh web --desktop` is a real desktop program on Windows, macOS, and Linux, with terminal history (`dsh web:` URL line), HMR, and sessions unchanged because the server process is untouched.
- The shell needs Electron installed in the checkout (`pnpm install`); without it, desktop mode warns and serves the browser URL. The published `@deepseek-ai/dsh-desktop` package ships no binary (Electron is a devDependency), so desktop mode is a checkout-level feature until an installer packaging pass bundles the built server.
- Windows window-close is a forced process-tree kill: no graceful Cordis disposal on that path (the same guarantee as a machine shutdown), while POSIX close still runs the launcher's SIGTERM teardown.
- One new row in the web composition (`web-desktop`) and one new published app package; no session-log, wire, or persistence formats change.

## Deferred

- `electron-builder` packaging into a double-clickable exe/installer: needs the built server and its node_modules inside the app image; the shell's env contract (URL + owner pid) stays the seam that packaging would feed.
- Custom icon and window chrome.
