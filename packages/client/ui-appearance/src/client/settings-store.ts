/**
 * Appearance page slot store: a mirror of the settings scope snapshot. The
 * plugin's apply-world change listener is the only writer; the page component
 * reads via props.useStore.
 */
import { defineStore, type EngineStoreHandle } from '@deepseek-ai/dsh-client-runtime/client'
import { DEFAULT_SURFACE, DEFAULT_WALLPAPER, type AppearanceSettings, type SurfaceMode, type WallpaperSettings } from '../appearance-settings.ts'

/** Store state mirrored from the durable appearance section. */
export interface AppearanceState {
  /** Wallpaper preferences (selection state reads this, never a draft). */
  wallpaper: WallpaperSettings
  /** Panel surface transparency mode. */
  surface: SurfaceMode
  /** Scope revision; -1 until first sync so revision 0 lands as a change. */
  revision: number
}

/** Declared action shape giving the exported factory a stable return type. */
type AppearanceActions = {
  sync: (draft: AppearanceState, settings: AppearanceSettings, revision: number) => void
}

/**
 * Declares the appearance page state and write surface.
 * @returns the store handle.
 */
export function createAppearanceStore(): EngineStoreHandle<AppearanceState, AppearanceActions> {
  return defineStore({
    init: (): AppearanceState => ({
      wallpaper: { ...DEFAULT_WALLPAPER },
      surface: DEFAULT_SURFACE,
      revision: -1,
    }),
    actions: {
      sync: (d, settings: AppearanceSettings, revision: number) => {
        if (revision <= d.revision) return
        d.wallpaper = { ...settings.wallpaper }
        d.surface = settings.surface
        d.revision = revision
      },
    },
  })
}
