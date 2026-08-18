/**
 * Background & Appearance settings page registered into the settings section
 * seat: wallpaper source (presets, URL, local path), fit mode, blur and dim
 * sliders, and the panel transparency mode. Selection follows the persisted
 * section from the slot store; drafts (URL/path text) are component-local.
 */
import { useState, type ChangeEvent } from 'react'
import clsx from 'clsx'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import {
  type SurfaceMode, type WallpaperFit, type WallpaperSettings,
} from '../appearance-settings.ts'
import type { AppearanceKey } from './locales.ts'
import { WALLPAPER_PRESETS } from './presets.ts'
import type { createAppearanceStore } from './settings-store.ts'
import css from './AppearancePage.module.css'

/** Injected business face: the durable-section writes behind the controls. */
export interface AppearancePageInjected {
  /** Persist one wallpaper field patch (whole-field write from the latest snapshot). */
  setWallpaper: (patch: Partial<WallpaperSettings>) => void
  /** Persist the panel surface transparency mode. */
  setSurface: (surface: SurfaceMode) => void
  /** Clear wallpaper and surface back to defaults. */
  resetAppearance: () => void
}

/** Full component props: runtime share + store share + locale seat + injected face. */
export type AppearancePageComponentProps =
  PropsRuntime<'settings.section'> & PropsStore<ReturnType<typeof createAppearanceStore>>
  & PropsLocale<'appearance'> & AppearancePageInjected

/** Surface mode cards in display order. */
const SURFACE_OPTIONS: readonly { id: SurfaceMode; labelKey: AppearanceKey; descKey: AppearanceKey }[] = [
  { id: 'solid', labelKey: 'surface.solid', descKey: 'surface.solidDesc' },
  { id: 'translucent', labelKey: 'surface.translucent', descKey: 'surface.translucentDesc' },
  { id: 'glass', labelKey: 'surface.glass', descKey: 'surface.glassDesc' },
]

/** Image fit options in display order. */
const FIT_OPTIONS: readonly { id: WallpaperFit; labelKey: AppearanceKey }[] = [
  { id: 'cover', labelKey: 'fit.cover' },
  { id: 'contain', labelKey: 'fit.contain' },
  { id: 'tile', labelKey: 'fit.tile' },
]

/**
 * Render the Background & Appearance settings page.
 * @param props - composed slot props.
 * @returns the page element tree.
 */
export function AppearancePage({
  t, useStore, setWallpaper, setSurface, resetAppearance,
}: AppearancePageComponentProps) {
  const wallpaper = useStore(s => s.wallpaper)
  const surface = useStore(s => s.surface)
  const [urlDraft, setUrlDraft] = useState('')
  const [pathDraft, setPathDraft] = useState('')

  const applyUrl = (): void => {
    const value = urlDraft.trim()
    if (value !== '') setWallpaper({ kind: 'url', value })
  }
  const applyLocal = (): void => {
    const value = pathDraft.trim()
    if (value !== '') setWallpaper({ kind: 'local', value })
  }

  return (
    <div className={css.page}>
      <section className={css.section}>
        <h3 className={css.title}>{t('wallpaper.title')}</h3>
        <div className={css.presetRow}>
          <button
            type="button"
            className={clsx(css.preset, wallpaper.kind === 'none' && css.selected)}
            aria-pressed={wallpaper.kind === 'none'}
            onClick={() => { setWallpaper({ kind: 'none', value: '' }) }}
          >
            {t('presets.none')}
          </button>
          {WALLPAPER_PRESETS.map(preset => (
            <button
              key={preset.id}
              type="button"
              className={clsx(
                css.preset,
                css.swatch,
                wallpaper.kind === 'gradient' && wallpaper.value === preset.id && css.selected,
              )}
              style={{ backgroundImage: preset.css }}
              title={t(preset.labelKey)}
              aria-label={t(preset.labelKey)}
              aria-pressed={wallpaper.kind === 'gradient' && wallpaper.value === preset.id}
              onClick={() => { setWallpaper({ kind: 'gradient', value: preset.id }) }}
            />
          ))}
        </div>
      </section>

      <section className={css.section}>
        <h3 className={css.title}>{t('custom.title')}</h3>
        <div className={css.inputRow}>
          <input
            className={css.input}
            type="text"
            value={urlDraft}
            placeholder={t('custom.urlPlaceholder')}
            onChange={(event: ChangeEvent<HTMLInputElement>) => { setUrlDraft(event.target.value) }}
          />
          <button type="button" className={css.button} onClick={applyUrl}>{t('custom.urlApply')}</button>
        </div>
        <div className={css.inputRow}>
          <input
            className={css.input}
            type="text"
            value={pathDraft}
            placeholder={t('custom.localPlaceholder')}
            onChange={(event: ChangeEvent<HTMLInputElement>) => { setPathDraft(event.target.value) }}
          />
          <button type="button" className={css.button} onClick={applyLocal}>{t('custom.localApply')}</button>
        </div>
        <p className={css.hint}>{t('custom.localHint')}</p>
      </section>

      <section className={css.section}>
        <h3 className={css.title}>{t('fit.title')}</h3>
        <select
          className={css.select}
          value={wallpaper.fit}
          onChange={(event: ChangeEvent<HTMLSelectElement>) => { setWallpaper({ fit: event.target.value as WallpaperFit }) }}
        >
          {FIT_OPTIONS.map(option => (
            <option key={option.id} value={option.id}>{t(option.labelKey)}</option>
          ))}
        </select>
      </section>

      <section className={css.section}>
        <h3 className={css.title}>{t('blur.title')} {wallpaper.blur}px</h3>
        <input
          className={css.range}
          type="range"
          min={0}
          max={24}
          step={1}
          value={wallpaper.blur}
          onChange={(event: ChangeEvent<HTMLInputElement>) => { setWallpaper({ blur: Number(event.target.value) }) }}
        />
      </section>

      <section className={css.section}>
        <h3 className={css.title}>{t('dim.title')} {Math.round(wallpaper.dim * 100)}%</h3>
        <input
          className={css.range}
          type="range"
          min={0}
          max={0.7}
          step={0.05}
          value={wallpaper.dim}
          onChange={(event: ChangeEvent<HTMLInputElement>) => { setWallpaper({ dim: Number(event.target.value) }) }}
        />
      </section>

      <section className={css.section}>
        <h3 className={css.title}>{t('surface.title')}</h3>
        <div className={css.surfaceRow}>
          {SURFACE_OPTIONS.map(option => (
            <button
              key={option.id}
              type="button"
              className={clsx(css.surfaceCard, surface === option.id && css.selected)}
              aria-pressed={surface === option.id}
              onClick={() => { setSurface(option.id) }}
            >
              <span className={css.surfaceLabel}>{t(option.labelKey)}</span>
              <span className={css.surfaceDesc}>{t(option.descKey)}</span>
            </button>
          ))}
        </div>
      </section>

      <p className={css.hint}>{t('hint')}</p>
      <div>
        <button type="button" className={css.button} onClick={resetAppearance}>{t('reset')}</button>
      </div>
    </div>
  )
}
