# @deepseek-ai/dsh-client-ui-appearance

English | [中文](README.zh.md)

Appearance plugin: the durable wallpaper and panel-transparency preferences behind the **Background & Appearance** settings page. It owns the `ui-appearance` settings namespace (wallpaper kind/value/fit/dim plus the surface mode), the wallpaper DOM layer, the translucent surface token layer, and the settings section seat `settings.section` with id `appearance`.

The wallpaper layer is the `html` canvas background — behind every surface, so it can never cover the app: the package ships a global stylesheet (imported by the shell after the token sheets) that reads document-scoped `--dshw-*` custom properties, and the browser half's `WallpaperPresenter` writes those properties from the durable section. The base token backgrounds stay untouched, so the wallpaper is only visible where surfaces let it through — which is exactly what the surface transparency mode controls. Sources are built-in gradient presets (ids persisted), image URLs (loaded by the browser directly), and local file paths (served by the host half through the `/dsh-wallpaper` prefix route, which reads the current section path per request — the settings write is the only wire surface, no file RPC exists).

The surface mode maps to a `theme.overrideTokens('ui-appearance', …)` layer over the six surface aliases (`--dsw-alias-bg-base`, `--dsw-alias-bg-layer-1/2/3`, `--dsw-alias-bg-overlay`, `--dsw-specific-sidebar-fill`) as `color-mix` over each palette's static source, so translucent/glass values follow the active color scheme without recomputation; `solid` keeps the product tokens untouched. Wallpaper and surface are independent dimensions and combine freely.

The host half registers the namespace with the Host settings seam (`settingsNamespace('ui-appearance')`) and the wallpaper route when `settings`, `fs`, and `webServer` are composed. The namespace is remotely readable/writable only because the api-proxy allowlist (`WEB_SETTINGS_NAMESPACES`) admits it — adding a Settings registration alone never exposes it.

## Model Experience

None, as the plugin renders browser settings UI; nothing here reaches a model request.

#### KV Cache effect

None; this package neither assembles nor sends a provider request.

## Known Limitations and Deferred Work

- The local wallpaper source is a typed file path; there is no native image picker yet, and the route answers 404 (invisible wallpaper) when the file is missing or unreadable.
- The wallpaper layer is per-browser: every loopback browser of one host instance renders the same durable section.
- `solid` panels hide the wallpaper; the dim overlay only matters visually when at least one surface is translucent.
