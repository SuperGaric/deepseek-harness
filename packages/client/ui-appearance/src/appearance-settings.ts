/** Durable appearance preferences: wallpaper source and panel surface transparency. */

import z from '@deepseek-ai/schemastery'

/** Settings namespace owned by the appearance plugin. */
export const APPEARANCE_SETTINGS_NAMESPACE = 'ui-appearance'

/** Theme override-layer identity for the translucent surface tokens. */
export const SURFACE_TOKEN_SOURCE = 'ui-appearance'

/** Wallpaper source kinds persisted in the settings section. */
export const WALLPAPER_KINDS = ['none', 'gradient', 'url', 'local'] as const

/** Image fit modes for `url`/`local` wallpapers. */
export const WALLPAPER_FITS = ['cover', 'contain', 'tile'] as const

/** Panel surface transparency modes. */
export const SURFACE_MODES = ['solid', 'translucent', 'glass'] as const

/** Wallpaper source kind stored in the settings section. */
export type WallpaperKind = typeof WALLPAPER_KINDS[number]

/** Image fit mode for `url`/`local` wallpapers. */
export type WallpaperFit = typeof WALLPAPER_FITS[number]

/** Panel surface transparency mode. */
export type SurfaceMode = typeof SURFACE_MODES[number]

/** Durable wallpaper preferences. */
export interface WallpaperSettings {
  /** Source kind; `none` hides the wallpaper layer. */
  kind: WallpaperKind
  /** Preset id (`gradient`), image URL (`url`), or local file path (`local`). */
  value: string
  /** Image fit mode for `url`/`local` wallpapers. */
  fit: WallpaperFit
  /** Wallpaper blur in px (0–24). */
  blur: number
  /** Scrim darkness 0–0.7, the readability overlay above the wallpaper. */
  dim: number
}

/** Durable appearance section shared by the Host schema and the browser scope. */
export interface AppearanceSettings {
  wallpaper: WallpaperSettings
  /** Panel surface transparency mode. */
  surface: SurfaceMode
}

/** Default wallpaper: no layer at all. */
export const DEFAULT_WALLPAPER: WallpaperSettings = {
  kind: 'none', value: '', fit: 'cover', blur: 0, dim: 0,
}

/** Default surface mode: untouched product tokens. */
export const DEFAULT_SURFACE: SurfaceMode = 'solid'

const wallpaperSchema = z.object({
  kind: z.union([...WALLPAPER_KINDS]).default(DEFAULT_WALLPAPER.kind),
  value: z.string().default(DEFAULT_WALLPAPER.value),
  fit: z.union([...WALLPAPER_FITS]).default(DEFAULT_WALLPAPER.fit),
  blur: z.number().min(0).max(24).default(DEFAULT_WALLPAPER.blur),
  dim: z.number().min(0).max(0.7).default(DEFAULT_WALLPAPER.dim),
})

/** Durable appearance schema; also the wire envelope the browser scope validates against. */
export const AppearanceSettingsSchema: z<AppearanceSettings> = z.object({
  wallpaper: wallpaperSchema.default(DEFAULT_WALLPAPER),
  surface: z.union([...SURFACE_MODES]).default(DEFAULT_SURFACE),
})

/**
 * Normalize a possibly absent wire section into a complete appearance
 * settings object (the browser scope validates against the wire schema, which
 * applies every default, so a published value is already complete; this only
 * guards the presenter and store against an absent section).
 * @param value - the scope's published section value, or undefined.
 * @returns the complete settings applied by the presenter.
 */
export function resolveAppearance(value: AppearanceSettings | undefined): AppearanceSettings {
  if (value === undefined) return { wallpaper: { ...DEFAULT_WALLPAPER }, surface: DEFAULT_SURFACE }
  return {
    wallpaper: { ...DEFAULT_WALLPAPER, ...value.wallpaper },
    surface: value.surface,
  }
}
