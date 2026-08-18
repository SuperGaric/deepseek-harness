/** Built-in gradient presets shown on the appearance page. */

import type { AppearanceKey } from './locales.ts'

/** One built-in gradient preset. */
export interface WallpaperPreset {
  /** Stable preset id persisted in settings. */
  id: string
  /** Display label key in the locale dictionary. */
  labelKey: AppearanceKey
  /** CSS gradient value applied as the wallpaper background image. */
  css: string
}

/** Built-in gradient presets; ids are the persisted values. */
export const WALLPAPER_PRESETS: readonly WallpaperPreset[] = Object.freeze([
  { id: 'aurora', labelKey: 'presets.aurora', css: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)' },
  { id: 'ocean', labelKey: 'presets.ocean', css: 'linear-gradient(135deg, #0f2027 0%, #203a43 50%, #2c5364 100%)' },
  { id: 'sunset', labelKey: 'presets.sunset', css: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)' },
  { id: 'forest', labelKey: 'presets.forest', css: 'linear-gradient(135deg, #134e5e 0%, #71b280 100%)' },
  { id: 'graphite', labelKey: 'presets.graphite', css: 'linear-gradient(135deg, #2b2b2b 0%, #111111 100%)' },
])
