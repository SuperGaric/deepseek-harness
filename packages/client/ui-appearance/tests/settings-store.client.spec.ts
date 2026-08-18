/** Appearance page slot store: revision-guarded mirror of the settings scope. */
import { describe, expect, it } from 'vitest'
import { createAppearanceStore } from '../src/client/settings-store.ts'
import { DEFAULT_SURFACE, DEFAULT_WALLPAPER } from '../src/appearance-settings.ts'

const DEFAULTS = { wallpaper: { ...DEFAULT_WALLPAPER }, surface: DEFAULT_SURFACE }

describe('createAppearanceStore', () => {
  it('init publishes the defaults with a pre-sync revision', () => {
    const store = createAppearanceStore().create()
    expect(store.getSnapshot()).toEqual({
      wallpaper: { ...DEFAULT_WALLPAPER },
      surface: DEFAULT_SURFACE,
      revision: -1,
    })
  })

  it('sync applies only advancing revisions', () => {
    const store = createAppearanceStore().create()
    store.actions.sync(DEFAULTS, 0)
    store.actions.sync({ ...DEFAULTS, surface: 'translucent' }, 0)
    // The duplicate revision is stale: the mirror keeps the first value.
    expect(store.getSnapshot().surface).toBe(DEFAULT_SURFACE)
    store.actions.sync({ ...DEFAULTS, surface: 'glass' }, 1)
    expect(store.getSnapshot()).toEqual({
      wallpaper: { ...DEFAULT_WALLPAPER },
      surface: 'glass',
      revision: 1,
    })
  })
})
