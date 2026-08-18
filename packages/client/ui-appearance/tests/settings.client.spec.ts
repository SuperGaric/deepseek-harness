/** Durable appearance section: schema defaults/bounds, resolution, and the surface token layer. */
import { describe, expect, it } from 'vitest'
import {
  AppearanceSettingsSchema, DEFAULT_SURFACE, DEFAULT_WALLPAPER, resolveAppearance,
  SURFACE_MODES, WALLPAPER_KINDS, type AppearanceSettings,
} from '../src/appearance-settings.ts'
import { surfaceTokenOverrides, SURFACE_TOKENS } from '../src/client/surface-tokens.ts'

/** Invoke the callable schema against a wire-shaped value (untyped by design). */
function parse(value: unknown): AppearanceSettings {
  return AppearanceSettingsSchema(value as never)
}

describe('AppearanceSettingsSchema', () => {
  it('defaults a bare section to the shipped defaults', () => {
    expect(parse({})).toEqual({
      wallpaper: { ...DEFAULT_WALLPAPER },
      surface: DEFAULT_SURFACE,
    })
  })

  it('rejects unknown kinds, fits, surfaces, and out-of-range sliders', () => {
    for (const kind of ['bogus', 'urls', '']) {
      expect(() => parse({ wallpaper: { kind } })).toThrow()
    }
    expect(() => parse({ wallpaper: { fit: 'zoom' } })).toThrow()
    expect(() => parse({ surface: 'frosted' })).toThrow()
    expect(() => parse({ wallpaper: { dim: 0.8 } })).toThrow()
    expect(() => parse({ wallpaper: { dim: -0.1 } })).toThrow()
  })

  it('keeps the persisted enumerations in sync with their type unions', () => {
    expect(WALLPAPER_KINDS).toEqual(['none', 'gradient', 'url', 'local'])
    expect(SURFACE_MODES).toEqual(['solid', 'translucent', 'glass'])
  })
})

describe('resolveAppearance', () => {
  it('returns the defaults for an absent section', () => {
    expect(resolveAppearance(undefined)).toEqual({ wallpaper: { ...DEFAULT_WALLPAPER }, surface: DEFAULT_SURFACE })
  })

  it('keeps a complete section as-is', () => {
    const complete: AppearanceSettings = {
      wallpaper: { ...DEFAULT_WALLPAPER, kind: 'gradient', value: 'aurora' },
      surface: 'glass',
    }
    expect(resolveAppearance(complete)).toEqual(complete)
  })
})

describe('surfaceTokenOverrides', () => {
  it('returns no layer for the solid mode', () => {
    expect(surfaceTokenOverrides('solid')).toEqual({})
  })

  it('maps every surface alias to a color-mix pair for translucent', () => {
    const tokens = surfaceTokenOverrides('translucent')
    expect(Object.keys(tokens)).toEqual(Object.keys(SURFACE_TOKENS))
    for (const [name, [light, dark]] of Object.entries(SURFACE_TOKENS)) {
      expect(tokens[name]).toEqual({
        light: `color-mix(in srgb, var(${light}) 78%, transparent)`,
        dark: `color-mix(in srgb, var(${dark}) 78%, transparent)`,
      })
    }
  })

  it('uses the deeper alpha for glass', () => {
    const tokens = surfaceTokenOverrides('glass')
    expect(tokens['--dsw-alias-bg-base']).toEqual({
      light: 'color-mix(in srgb, var(--dsw-static-neutral-bluish-00) 55%, transparent)',
      dark: 'color-mix(in srgb, var(--dsw-static-neutral-bluish-950) 55%, transparent)',
    })
  })
})
