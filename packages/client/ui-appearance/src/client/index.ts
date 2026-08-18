/**
 * Appearance plugin, browser half: owns the durable appearance section, the
 * wallpaper DOM layer, the translucent surface token layer, and the
 * feature-owned "Background & Appearance" settings page.
 * Export discipline: packages/client/AGENTS.md.
 */
import type { Context } from '@deepseek-ai/cordis'
import type { BoundActions } from '@deepseek-ai/dsh-client-ui-slots'
import type { ClientContext } from '@deepseek-ai/dsh-client-runtime/client'
// Type-only: pulls the settings slot declarations and the ctx.settingsScope
// Context merge into this program.
import type {} from '@deepseek-ai/dsh-client-ui-settings/client'
// Type-only: pulls ctx.locale into this program.
import type {} from '@deepseek-ai/dsh-client-locale/client'
import {
  APPEARANCE_SETTINGS_NAMESPACE, SURFACE_TOKEN_SOURCE, resolveAppearance,
  type AppearanceSettings,
} from '../appearance-settings.ts'
import { AppearancePage, type AppearancePageInjected } from './AppearancePage.tsx'
import { en, zh, type AppearanceKey } from './locales.ts'
import { createAppearanceStore } from './settings-store.ts'
import { surfaceTokenOverrides } from './surface-tokens.ts'
import { WallpaperPresenter } from './WallpaperPresenter.ts'

declare module '@deepseek-ai/dsh-client-ui-slots' {
  interface LocaleNamespaceMap {
    /** Appearance settings page copy. */
    appearance: AppearanceKey
  }
}

/** Locale namespace owned by this plugin. */
const NS = 'appearance'

/** Required services (cordis fiber inject); `theme` is provided by ui-theme. */
export const inject = ['slots', 'locale', 'connection', 'remote', 'settingsScope', 'theme']

/**
 * Register the appearance dictionaries, bind the durable section, and seat the
 * Background & Appearance page once its slot declaration is on the ledger.
 * @param ctx - client root context.
 */
export function apply(ctx: ClientContext): void {
  const host = ctx.settingsScope.bind<AppearanceSettings>({ namespace: APPEARANCE_SETTINGS_NAMESPACE })
  const theme = ctx.get('theme') as Context['theme']
  const presenter = new WallpaperPresenter()
  const store = createAppearanceStore()
  let bound: BoundActions<typeof store> | undefined
  let surfaceDisposer: (() => void) | undefined

  /** Project the current scope snapshot onto the DOM, token layer, and store. */
  const sync = (): void => {
    const settings = resolveAppearance(host.getSnapshot().value)
    presenter.apply(settings)
    if (surfaceDisposer !== undefined) {
      surfaceDisposer()
      surfaceDisposer = undefined
    }
    const overrides = surfaceTokenOverrides(settings.surface)
    if (Object.keys(overrides).length > 0) {
      surfaceDisposer = theme.overrideTokens(SURFACE_TOKEN_SOURCE, overrides)
    }
    bound?.sync(settings, host.getSnapshot().revision ?? 0)
  }

  ctx.effect(() => host.subscribe(sync), 'ui-appearance: settings scope adoption')
  ctx.effect(() => () => {
    presenter.dispose()
    if (surfaceDisposer !== undefined) surfaceDisposer()
  }, 'ui-appearance: wallpaper and token layer cleanup')
  sync()

  ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-appearance: dictionaries')

  const t = ctx.locale.bind(NS)
  const injected = (actions: BoundActions<typeof store>): AppearancePageInjected => {
    bound = actions
    // Re-sync so no snapshot is lost between registration and first render.
    sync()
    return {
      setWallpaper: (patch) => {
        const current = resolveAppearance(host.getSnapshot().value).wallpaper
        void host.set('wallpaper', { ...current, ...patch })
      },
      setSurface: (surface) => { void host.set('surface', surface) },
      resetAppearance: () => {
        void host.unset('wallpaper')
        void host.unset('surface')
      },
    }
  }

  ctx.slots.inject('settings.section', () => ctx.slots.register({
    name: 'settings.section',
    id: 'appearance',
    order: 12,
    label: () => t('nav'),
    locale: NS,
    store,
    inject: injected,
  }, AppearancePage))
}

export type {
  AppearancePageComponentProps, AppearancePageInjected,
} from './AppearancePage.tsx'
export { createAppearanceStore } from './settings-store.ts'
export { WallpaperPresenter, wallpaperImageValue } from './WallpaperPresenter.ts'
export type { AppearanceKey } from './locales.ts'
export { surfaceTokenOverrides, SURFACE_TOKENS } from './surface-tokens.ts'
