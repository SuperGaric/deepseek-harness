// @vitest-environment jsdom
/** ui-appearance apply wiring: service provision, dictionaries, declaration-aware
 * section registration, scope snapshot projection (DOM layer + token layer +
 * store), face writes, HMR collapse recovery, and teardown. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { SlotRegistry } from '@deepseek-ai/dsh-client-runtime/client'
import { LocaleRuntime } from '@deepseek-ai/dsh-client-locale/client'
import { TestRemote, usePinnedBrowserLanguages } from '@deepseek-ai/dsh-client-test-runtime'
import { resolveSlotLabel } from '@deepseek-ai/dsh-client-ui-slots'
import { SettingsScopeBinder } from '@deepseek-ai/dsh-client-ui-settings/client'
import { apply, inject } from '@deepseek-ai/dsh-client-ui-appearance/client'
import type { AppearancePageInjected } from '@deepseek-ai/dsh-client-ui-appearance/client'
import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import { AppearancePage } from '../src/client/AppearancePage.tsx'
import type { createAppearanceStore } from '../src/client/settings-store.ts'
import { BLUR_PROPERTY, DIM_PROPERTY, IMAGE_PROPERTY, SIZE_PROPERTY } from '../src/client/WallpaperPresenter.ts'
import {
  APPEARANCE_SETTINGS_NAMESPACE, AppearanceSettingsSchema, DEFAULT_SURFACE, DEFAULT_WALLPAPER,
} from '../src/appearance-settings.ts'

// The service reads its initial locale from the browser; these specs assert
// the shipped Chinese copy, so they state the browser they assume.
usePinnedBrowserLanguages('zh-CN')

const SLOT = 'settings.section'
const NS = 'appearance'

async function bench(isLoopback = true) {
  const ctx = new Context()
  await ctx.plugin(SlotRegistry).await()
  const locale = new LocaleRuntime(ctx)
  ctx.provide('locale', locale)
  let section: Record<string, unknown> = {}
  let revision = 0
  const namespace = () => ({
    ns: APPEARANCE_SETTINGS_NAMESPACE,
    schema: AppearanceSettingsSchema.toJSON(),
    // The Host settings seam validates the stored section against the schema,
    // filling every default before the wire view is built.
    value: AppearanceSettingsSchema(section as never),
    applies: 'live' as const,
    secrets: [],
    revision,
  })
  const describe = vi.fn(() => Promise.resolve({
    rpcId: 'appearance-describe' as never,
    result: {
      ok: true as const,
      value: { writable: true, hasDocument: true, namespaces: [namespace()] },
    },
  }))
  const mutate = vi.fn((request: { ns: string; ops: { op: string; path: string[]; value?: unknown }[] }) => {
    for (const op of request.ops) {
      if (op.op === 'set') {
        const [field] = op.path
        if (field !== undefined) section = { ...section, [field]: op.value }
      } else if (op.op === 'unset') {
        const [field] = op.path
        if (field !== undefined) {
          section = Object.fromEntries(Object.entries(section).filter(([key]) => key !== field))
        }
      }
    }
    revision += 1
    return Promise.resolve({
      rpcId: 'appearance-mutate' as never,
      result: { ok: true as const, value: namespace() },
    })
  })
  ctx.provide('connection', { api: { settings: { describe, mutate } }, isLoopback } as never)
  // The settings transport and the forwarded-event port the plugin injects.
  new TestRemote(ctx)
  await ctx.plugin(SettingsScopeBinder).await()
  const overrideTokens = vi.fn((_source: string, _tokens: ThemeTokenOverrides) => () => {})
  ctx.provide('theme', { overrideTokens })
  return {
    ctx, slots: ctx.get('slots') as SlotRegistry, locale, describe, mutate, overrideTokens,
    setHostSection: (next: Record<string, unknown>) => { section = next },
  }
}

/** Stand in for the settings shell: declare the section slot from root. */
function declareSection(slots: SlotRegistry): () => void {
  return slots.register(
    { name: 'root', children: { [SLOT]: { kind: 'list', scope: 'root' } } } as never,
    () => null,
  )
}

/** Mirror the framework's inject choreography: bake a real instance from the
 * declared handle and hand its actions to the entry's inject factory. */
function faceOf(slots: SlotRegistry) {
  const entry = slots.entries(SLOT).find(e => e.component === AppearancePage)!
  const handle = entry.store as ReturnType<typeof createAppearanceStore>
  const instance = handle.create()
  const face = (entry.inject as unknown as (a: typeof instance.actions) => AppearancePageInjected)(instance.actions)
  return { entry, instance, face }
}

describe('ui-appearance apply', () => {
  it('declares the services it uses', () => {
    expect(inject).toEqual(['slots', 'locale', 'connection', 'remote', 'settingsScope', 'theme'])
  })

  it('registers localized copy and the section (declaration before or after apply)', async () => {
    const before = await bench()
    declareSection(before.slots)
    await before.ctx.plugin({ inject: [...inject], apply }).await()
    expect(before.locale.bind(NS)('wallpaper.title')).toBe('墙纸背景')
    before.locale.setLocale('en')
    expect(before.locale.bind(NS)('wallpaper.title')).toBe('Wallpaper')
    const entry = before.slots.entries(SLOT).find(e => e.component === AppearancePage)!
    expect(entry.options).toMatchObject({ id: 'appearance', order: 12 })
    expect(entry.locale).toBe(NS)
    // The nav label is a locale-following thunk; owners resolve at read time.
    expect(resolveSlotLabel(entry.options.label)).toBe('Background & Appearance')
    before.locale.setLocale('zh')
    expect(resolveSlotLabel(entry.options.label)).toBe('背景与外观')

    const after = await bench()
    const fiber = after.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    expect(after.slots.entries(SLOT)).toHaveLength(0)
    declareSection(after.slots)
    await Promise.resolve()
    expect(after.slots.entries(SLOT).some(e => e.component === AppearancePage)).toBe(true)
  })

  it('projects the scope snapshot onto the DOM, the token layer, and the store', async () => {
    const b = await bench()
    b.setHostSection({ wallpaper: { kind: 'url', value: 'https://x.test/a.png', fit: 'cover', blur: 4, dim: 0.2 }, surface: 'glass' })
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    await vi.waitFor(() => {
      expect(document.body.style.getPropertyValue(IMAGE_PROPERTY)).toBe("url('https://x.test/a.png')")
    })
    expect(document.body.style.getPropertyValue(SIZE_PROPERTY)).toBe('cover')
    expect(document.body.style.getPropertyValue(BLUR_PROPERTY)).toBe('4px')
    expect(document.body.style.getPropertyValue(DIM_PROPERTY)).toBe('0.2')
    const layer = b.overrideTokens.mock.calls[0]![1] as ThemeTokenOverrides
    expect(layer['--dsw-alias-bg-base']?.light).toContain('55%')

    const { instance } = faceOf(b.slots)
    expect(instance.getSnapshot().wallpaper.kind).toBe('url')
    expect(instance.getSnapshot().surface).toBe('glass')
  })

  it('stays token-clean for the solid surface and re-layers on mode changes', async () => {
    const b = await bench()
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.overrideTokens).not.toHaveBeenCalled()

    const { face } = faceOf(b.slots)
    face.setSurface('translucent')
    await vi.waitFor(() => {
      const layer = b.overrideTokens.mock.calls[0]![1] as ThemeTokenOverrides
      expect(layer['--dsw-specific-sidebar-fill']?.light).toContain('78%')
    })
    face.setSurface('solid')
    await vi.waitFor(() => { expect(b.mutate).toHaveBeenCalledTimes(2) })
  })

  it('routes face writes through the settings scope and mirrors the echo back', async () => {
    const b = await bench()
    declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    const { instance, face } = faceOf(b.slots)

    face.setWallpaper({ kind: 'gradient', value: 'aurora' })
    await vi.waitFor(() => {
      expect(instance.getSnapshot().wallpaper).toEqual({ ...DEFAULT_WALLPAPER, kind: 'gradient', value: 'aurora' })
    })
    expect(b.mutate).toHaveBeenCalledWith(expect.objectContaining({
      ops: [{ op: 'set', path: ['wallpaper'], value: { ...DEFAULT_WALLPAPER, kind: 'gradient', value: 'aurora' } }],
    }))

    face.setSurface('glass')
    await vi.waitFor(() => { expect(instance.getSnapshot().surface).toBe('glass') })

    face.resetAppearance()
    await vi.waitFor(() => {
      expect(instance.getSnapshot().wallpaper).toEqual({ ...DEFAULT_WALLPAPER })
      expect(instance.getSnapshot().surface).toBe(DEFAULT_SURFACE)
    })
  })

  it('syncs from an unloaded scope with an unknown revision (defaults until the read settles)', async () => {
    const b = await bench()
    // Hold the initial settings read open: the inject-time re-sync runs with an
    // undefined revision and publishes defaults into the store.
    const pending = Promise.withResolvers<Awaited<ReturnType<typeof b.describe>>>()
    const original = b.describe.getMockImplementation()!
    b.describe.mockImplementationOnce(() => pending.promise)
    declareSection(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    const { instance } = faceOf(b.slots)
    expect(instance.getSnapshot().surface).toBe(DEFAULT_SURFACE)
    pending.resolve(await original())
    await vi.waitFor(() => { expect(instance.getSnapshot().revision).toBe(0) })
    await fiber.dispose()
  })

  it('recovers after an HMR collapse of the declaring entry (stale disposer must not block)', async () => {
    const b = await bench()
    const host = declareSection(b.slots)
    await b.ctx.plugin({ inject: [...inject], apply }).await()
    expect(b.slots.entries(SLOT)).toHaveLength(1)

    // Collapse: the declarer dies, the cascade removes our entry while the
    // apply closure still holds its (now stale) disposer.
    host()
    expect(b.slots.entries(SLOT)).toHaveLength(0)

    declareSection(b.slots)
    await Promise.resolve()
    expect(b.slots.entries(SLOT).some(e => e.component === AppearancePage)).toBe(true)
  })

  it('teardown retracts the DOM layer and the dictionaries; teardown without a declaration is quiet', async () => {
    const b = await bench()
    b.setHostSection({ wallpaper: { kind: 'url', value: 'https://x.test/a.png', fit: 'cover', blur: 2, dim: 0.1 }, surface: 'translucent' })
    declareSection(b.slots)
    const fiber = b.ctx.plugin({ inject: [...inject], apply })
    await fiber.await()
    await vi.waitFor(() => {
      expect(document.body.style.getPropertyValue(IMAGE_PROPERTY)).not.toBe('')
    })
    await fiber.dispose()
    expect(document.body.style.getPropertyValue(IMAGE_PROPERTY)).toBe('')
    expect(document.body.style.getPropertyValue(BLUR_PROPERTY)).toBe('')
    expect(b.slots.entries(SLOT)).toHaveLength(0)
    expect(b.locale.bind(NS)('wallpaper.title')).toBe('wallpaper.title')

    // Never-declared bench: the effect disposer's dispose arm stays undefined.
    const quiet = await bench()
    const f2 = quiet.ctx.plugin({ inject: [...inject], apply })
    await f2.await()
    await f2.dispose()
    expect(quiet.slots.entries(SLOT)).toHaveLength(0)
  })
})
