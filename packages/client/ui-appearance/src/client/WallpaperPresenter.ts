/**
 * Wallpaper DOM applier: projects the durable appearance settings onto
 * document-level CSS variables consumed by the package's wallpaper stylesheet
 * (the html canvas). Pure DOM writes, no React involvement; the presenter only
 * ever retracts what it wrote itself, so foreign inline styles survive.
 */
import type { AppearanceSettings } from '../appearance-settings.ts'
import { WALLPAPER_PRESETS } from './presets.ts'

/** CSS custom property carrying the wallpaper background image value. */
export const IMAGE_PROPERTY = '--dshw-image'
/** CSS custom property carrying the background-size value. */
export const SIZE_PROPERTY = '--dshw-size'
/** CSS custom property carrying the background-repeat value. */
export const REPEAT_PROPERTY = '--dshw-repeat'
/** CSS custom property carrying the dim overlay alpha. */
export const DIM_PROPERTY = '--dshw-dim'

/** Custom properties this presenter owns on the document root (its retraction set). */
export const OWNED_PROPERTIES: readonly string[] = [
  IMAGE_PROPERTY, SIZE_PROPERTY, REPEAT_PROPERTY, DIM_PROPERTY,
]

/** Escape a value embedded in a CSS url('…') literal. */
function cssUrlEscape(value: string): string {
  return value.replace(/[\\'()\s]/g, ch => (ch === '\\' ? '\\\\' : `\\${ch}`))
}

/** The wallpaper background-image value for one settings object. */
export function wallpaperImageValue(settings: AppearanceSettings): string {
  const { kind, value } = settings.wallpaper
  if (kind === 'gradient') {
    return WALLPAPER_PRESETS.find(preset => preset.id === value)?.css ?? 'none'
  }
  if (kind === 'url' || kind === 'local') return `url('${cssUrlEscape(value)}')`
  return 'none'
}

/** Applies appearance settings to the document; one instance per plugin fiber. */
export class WallpaperPresenter {
  /**
   * Project settings onto the document root: rewrite the four wallpaper custom
   * properties (tile maps to `auto` size + repeat). The stylesheet paints them
   * on the html canvas, behind every surface, so no settings change can cover
   * the app's content.
   * @param settings - complete appearance settings from the settings scope.
   */
  apply(settings: AppearanceSettings): void {
    const { wallpaper } = settings
    const root = document.documentElement
    const tile = wallpaper.kind !== 'none' && wallpaper.fit === 'tile'
    root.style.setProperty(IMAGE_PROPERTY, wallpaperImageValue(settings))
    root.style.setProperty(SIZE_PROPERTY, tile ? 'auto' : wallpaper.fit)
    root.style.setProperty(REPEAT_PROPERTY, tile ? 'repeat' : 'no-repeat')
    root.style.setProperty(DIM_PROPERTY, String(wallpaper.dim))
  }

  /** Retract every custom property this presenter wrote. */
  dispose(): void {
    const root = document.documentElement
    for (const name of OWNED_PROPERTIES) root.style.removeProperty(name)
  }
}
