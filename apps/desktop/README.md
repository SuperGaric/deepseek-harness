# `@deepseek-ai/dsh-desktop`

English | [中文](README.zh.md)

The Electron desktop shell for the dsh web GUI: a native window over the same loopback server `dsh web` serves. The shell itself is plain JavaScript executed by Electron — no lib build. The [`web-desktop`](../../packages/bundle/web-app/README.md) launcher row in the web bundle spawns it when `dsh web --desktop` is invoked; run `pnpm run desktop` from the repository root for the same thing.

## The shell contract

The launcher passes everything through the environment; the shell never starts its own server:

| Variable | Meaning |
|---|---|
| `DSH_DESKTOP_URL` | The canonical loopback URL to render (required). |
| `DSH_DESKTOP_OWNER_PID` | The serving dsh process; the shell stops it when the window closes. |
| `DSH_DESKTOP_SMOKE_MS` | Smoke-probe mode: open, log `dsh-desktop: ready <url>`, and quit after this many milliseconds without stopping the owner. |

Shell and launcher own one lifetime: closing the window stops the launcher (a forced process-tree kill on Windows, `SIGTERM` elsewhere), and a 2-second owner watch closes the window when the launcher dies first (Ctrl+C in the terminal). The window waits up to 30 seconds for the URL to answer, then reports a visible error and exits; the launcher keeps serving in the terminal.

## Development

```sh
pnpm install        # links electron into apps/desktop (devDependency)
pnpm --filter @deepseek-ai/dsh-desktop start   # needs DSH_DESKTOP_URL in the environment
DSH_DESKTOP_URL=http://127.0.0.1:3080 DSH_DESKTOP_SMOKE_MS=8000 pnpm --filter @deepseek-ai/dsh-desktop start
```

## Known Limitations and Deferred Work

- **No packaged installer** — the shell runs from the repository checkout; the served GUI is the launcher process, so an exe would need to bundle the built server and its node_modules. `electron-builder` packaging is deferred until that layout exists.
- **Electron is a devDependency** — consumers of the published package install no binary; desktop mode is a checkout-level feature and degrades to the browser URL with a warning otherwise.
- **No custom app icon or window chrome** — the default Electron icon and menu-bar-less standard frame ship for now.
