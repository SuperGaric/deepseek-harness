# Agent Note: Web wallpaper and panel transparency — the ui-appearance plugin

Status: implemented

English | [中文](2026-08-18-web-wallpaper-and-panel-transparency.zh.md)

## Problem

The Web GUI had no user-facing background capability: the surface tokens (`--dsw-alias-bg-*`, `--dsw-specific-sidebar-fill`) were opaque, so the app could not show a wallpaper behind its panels, and nothing let a user set one. A wallpaper feature interacts with the theme system in a way neither extension point covers alone: `theme.overrideTokens` can make surfaces translucent but cannot paint a background image, and a plain CSS injection has no sanctioned home in the client plugin architecture (the dynamic-plugin `styles.insert` builtin is sandbox-only; real client packages ship stylesheets through the shell's base.css imports). The feature also had to persist across reloads, which the settings seam provides — but only for namespaces the api-proxy allowlist explicitly admits.

## Decision

A new client plugin package `packages/client/ui-appearance` owns the whole capability as three independent layers that compose freely:

1. **Wallpaper layer**: the package ships `src/styles/wallpaper.css`, imported by the shell's base.css after every ui-theme token sheet. The sheet reads five body-scoped custom properties (`--dshw-image/size/repeat/blur/dim`) and paints `body::before` (the image, blurred via `filter`) and `body::after` (the dim scrim) as `position: fixed; z-index: -1` layers. The browser half's `WallpaperPresenter` writes those properties from the durable section and retracts exactly its own writes on dispose, mirroring ui-layout's `ThemePresenter` discipline. The layers sit behind the app's own surfaces because negative-z-index positioned pseudos paint above the canvas (the body background, which propagates because `html` carries none) and below in-flow content backgrounds — so the wallpaper is visible exactly where token transparency lets it through, and invisible under solid surfaces without any DOM restructuring.
2. **Surface transparency layer**: the surface mode (`solid`/`translucent`/`glass`) maps to a `theme.overrideTokens('ui-appearance', …)` layer over the six surface aliases, valued as `color-mix(in srgb, var(--dsw-static-…) N%, transparent)` against each palette's static source, so the values follow the active color scheme without recomputation and third-party themes are not needed for the built-in pair.
3. **Durable section**: the `ui-appearance` settings namespace (wallpaper kind/value/fit/blur/dim plus surface) is registered host-side and bound in the browser through `ctx.settingsScope`. The api-proxy `WEB_SETTINGS_NAMESPACES` allowlist admits the namespace — the explicit decision point that makes any Settings registration remotely readable or writable.

Wallpaper sources are gradient presets (ids persisted), image URLs (browser loads directly), and local file paths. Local files need no file RPC: the host half registers a `/dsh-wallpaper` prefix route that reads the section's current path per request and streams `fs.readBytes` output (≤ 20 MiB, extension-derived content type, `no-store`). The settings write is the only wire surface — the route is a read of the same section the settings page writes.

## Alternatives considered

**A host file-read RPC (ApiProxy method or Typert remote).** Rejected: it would add a new wire method, request/response schemas, a privileged-methods entry, and an arbitrary-path read surface to the host trust boundary — all to serve one image. The route that reads the already-durable path keeps the blast radius inside the feature and adds zero wire vocabulary; the trade-off (no client-side error feedback for missing files) is documented as a limitation.

**Reuse `body`'s own background (html/body background-image).** Rejected: the base.css body background is the theme's canvas (it propagates because html carries none), and translucent surfaces sit above it, so a body-level image would be hidden under the base color. Pseudo-element layers with `z-index: -1` paint above the canvas and below content backgrounds, which is exactly the stacking position a wallpaper needs, and they need no shell DOM changes.

**Register a third-party theme instead of `overrideTokens`.** Rejected: themes are palette-wide definitions selected by preference; the surface mode is one token-level aspect that must stack with the user's theme choice, which is what override layers are for.

**Persist the wallpaper in browser storage.** Rejected: the settings seam already provides loopback durability with Host-side revision conflict handling; a second persistence path would duplicate it.

## Consequences

The feature ships as a self-contained package with zero changes to product DOM or the theme registry: stopping the plugin fiber retracts every layer, and the shell's only footprint is one base.css import and the bundle roster rows. The stacking model means the wallpaper is only visible through translucent surfaces — the intended composition, but a user who picks a wallpaper while panels are `solid` sees nothing until they change the surface mode, so the settings page copy states the composition explicitly.

The api-proxy allowlist now names `ui-appearance`; every future settings namespace still requires that explicit admission, and the READMEs of both packages record the list. The route re-reads the section per request, so a wallpaper change is visible on the next fetch without cache invalidation (enforced by `no-store`). Local files stay host-resident — the browser never receives a filesystem path beyond what it wrote into settings, and the route caps reads at 20 MiB.
