// @vitest-environment jsdom
/** WallpaperPresenter: variable projection, tile mapping, and retraction. */
import { describe, expect, it } from 'vitest'
import {
  BLUR_PROPERTY, DIM_PROPERTY, IMAGE_PROPERTY, OWNED_PROPERTIES,
  REPEAT_PROPERTY, SIZE_PROPERTY, WallpaperPresenter, wallpaperImageValue,
} from '../src/client/WallpaperPresenter.ts'
import { DEFAULT_WALLPAPER, type AppearanceSettings } from '../src/appearance-settings.ts'

function settings(patch: Partial<AppearanceSettings['wallpaper']>): AppearanceSettings {
  return { wallpaper: { ...DEFAULT_WALLPAPER, ...patch }, surface: 'solid' }
}

const bodyStyle = (): CSSStyleDeclaration => document.body.style

describe('wallpaperImageValue', () => {
  it('resolves preset ids to their gradient css and unknown ids to none', () => {
    expect(wallpaperImageValue(settings({ kind: 'gradient', value: 'aurora' })))
      .toBe('linear-gradient(135deg, #667eea 0%, #764ba2 100%)')
    expect(wallpaperImageValue(settings({ kind: 'gradient', value: 'missing' }))).toBe('none')
  })

  it('wraps url and local values in an escaped url literal', () => {
    expect(wallpaperImageValue(settings({ kind: 'url', value: 'https://x.test/a b.png' })))
      .toBe("url('https://x.test/a\\ b.png')")
    expect(wallpaperImageValue(settings({ kind: 'local', value: 'C:\\pics\\wall.jpg' })))
      .toBe("url('C:\\\\pics\\\\wall.jpg')")
  })

  it('returns none for the no-wallpaper kind', () => {
    expect(wallpaperImageValue(settings({ kind: 'none' }))).toBe('none')
  })
})

describe('WallpaperPresenter', () => {
  it('projects settings onto the five body variables, mapping tile to auto size', () => {
    const presenter = new WallpaperPresenter()
    presenter.apply(settings({ kind: 'url', value: 'https://x.test/a.png', fit: 'tile', blur: 6, dim: 0.3 }))
    expect(bodyStyle().getPropertyValue(IMAGE_PROPERTY)).toBe("url('https://x.test/a.png')")
    expect(bodyStyle().getPropertyValue(SIZE_PROPERTY)).toBe('auto')
    expect(bodyStyle().getPropertyValue(REPEAT_PROPERTY)).toBe('repeat')
    expect(bodyStyle().getPropertyValue(BLUR_PROPERTY)).toBe('6px')
    expect(bodyStyle().getPropertyValue(DIM_PROPERTY)).toBe('0.3')
  })

  it('keeps cover sizing and no-repeat for non-tile wallpapers', () => {
    const presenter = new WallpaperPresenter()
    presenter.apply(settings({ kind: 'url', value: 'https://x.test/a.png', fit: 'cover', blur: 0, dim: 0 }))
    expect(bodyStyle().getPropertyValue(SIZE_PROPERTY)).toBe('cover')
    expect(bodyStyle().getPropertyValue(REPEAT_PROPERTY)).toBe('no-repeat')
  })

  it('rewrites the variables on every apply', () => {
    const presenter = new WallpaperPresenter()
    presenter.apply(settings({ kind: 'url', value: 'https://x.test/one.png' }))
    presenter.apply(settings({ kind: 'url', value: 'https://x.test/two.png' }))
    expect(bodyStyle().getPropertyValue(IMAGE_PROPERTY)).toBe("url('https://x.test/two.png')")
  })

  it('dispose removes exactly the owned variables', () => {
    const presenter = new WallpaperPresenter()
    presenter.apply(settings({ kind: 'url', value: 'https://x.test/a.png' }))
    document.body.style.setProperty('--foreign-probe', 'keep')
    presenter.dispose()
    for (const name of OWNED_PROPERTIES) {
      expect(bodyStyle().getPropertyValue(name)).toBe('')
    }
    expect(bodyStyle().getPropertyValue('--foreign-probe')).toBe('keep')
  })
})
