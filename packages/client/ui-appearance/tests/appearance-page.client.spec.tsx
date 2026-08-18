// @vitest-environment jsdom
/** AppearancePage behavior: preset selection, URL/local applies, fit/dim
 * writes, surface cards, and reset — all through the injected face. */
import { afterEach, describe, expect, it, vi } from 'vitest'
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react'
import { createSnapshotStore, type SessionListState, type WorkspaceListState } from '@deepseek-ai/dsh-client-runtime/client'
import { bindSnapshotSelector } from '@deepseek-ai/dsh-client-web-react'
import { AppearancePage } from '../src/client/AppearancePage.tsx'
import type { AppearancePageComponentProps } from '../src/client/AppearancePage.tsx'
import { createAppearanceStore } from '../src/client/settings-store.ts'
import { DEFAULT_SURFACE, DEFAULT_WALLPAPER, type WallpaperSettings } from '../src/appearance-settings.ts'

afterEach(cleanup)

const COPY: Record<string, string> = {
  'wallpaper.title': '墙纸背景',
  'presets.none': '无',
  'presets.aurora': '极光',
  'custom.title': '自定义图片',
  'custom.urlPlaceholder': 'URL 占位',
  'custom.urlApply': '应用 URL',
  'custom.localPlaceholder': '路径占位',
  'custom.localApply': '应用本地',
  'custom.localHint': '本地提示',
  'fit.title': '显示方式',
  'fit.cover': '铺满',
  'fit.contain': '适应',
  'fit.tile': '平铺',
  'dim.title': '压暗遮罩',
  'surface.title': '面板透明',
  'surface.solid': '不透明',
  'surface.solidDesc': '实心描述',
  'surface.translucent': '半透明',
  'surface.translucentDesc': '半透明描述',
  'surface.glass': '玻璃',
  'surface.glassDesc': '玻璃描述',
  'reset': '重置',
  'hint': '提示',
}

/** Empty global standard-kit hooks (the page reads neither). */
function emptySessions() {
  const store = createSnapshotStore<SessionListState>(
    { ids: [], byId: {}, current: undefined, phase: 'ready', subagentsByParent: {}, jobsBySession: {}, currentAddress: undefined })
  return bindSnapshotSelector(store)
}
function emptyWorkspaces() {
  const store = createSnapshotStore<WorkspaceListState>({
    items: [], archivedSessionIds: [], state: 'idle', phase: 'ready', error: null,
    baselinesReady: true, recentWorkspaceId: undefined,
  })
  return bindSnapshotSelector(store)
}

function mount(wallpaper: WallpaperSettings = { ...DEFAULT_WALLPAPER }, surface = DEFAULT_SURFACE) {
  const store = createAppearanceStore().create()
  store.actions.sync({ wallpaper, surface }, 0)
  const setWallpaper = vi.fn()
  const setSurface = vi.fn()
  const resetAppearance = vi.fn()
  const props: AppearancePageComponentProps = {
    useSessions: emptySessions(),
    useWorkspaces: emptyWorkspaces(),
    useStore: bindSnapshotSelector(store),
    actions: store.actions,
    t: (key: string) => COPY[key] ?? key,
    close: () => undefined,
    setWallpaper,
    setSurface,
    resetAppearance,
  }
  render(<AppearancePage {...props} />)
  return { store, setWallpaper, setSurface, resetAppearance }
}

describe('AppearancePage', () => {
  it('renders the sections and marks the active preset and surface card', () => {
    mount({ ...DEFAULT_WALLPAPER, kind: 'gradient', value: 'aurora' }, 'glass')
    expect(screen.getByText('墙纸背景')).toBeDefined()
    expect(screen.getByRole('button', { name: '极光' }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: '无' }).getAttribute('aria-pressed')).toBe('false')
    expect(screen.getByRole('button', { name: /玻璃/ }).getAttribute('aria-pressed')).toBe('true')
    expect(screen.getByRole('button', { name: /半透明/ }).getAttribute('aria-pressed')).toBe('false')
  })

  it('preset clicks persist kind and preset id; none clears the wallpaper', () => {
    const b = mount()
    fireEvent.click(screen.getByLabelText('极光'))
    expect(b.setWallpaper).toHaveBeenCalledWith({ kind: 'gradient', value: 'aurora' })
    fireEvent.click(screen.getByRole('button', { name: '无' }))
    expect(b.setWallpaper).toHaveBeenCalledWith({ kind: 'none', value: '' })
  })

  it('applies a non-empty URL draft and ignores an empty one', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: '应用 URL' }))
    expect(b.setWallpaper).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText('URL 占位'), { target: { value: '  https://x.test/a.png  ' } })
    fireEvent.click(screen.getByRole('button', { name: '应用 URL' }))
    expect(b.setWallpaper).toHaveBeenCalledWith({ kind: 'url', value: 'https://x.test/a.png' })
  })

  it('applies a non-empty local path draft and ignores an empty one', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: '应用本地' }))
    expect(b.setWallpaper).not.toHaveBeenCalled()
    fireEvent.change(screen.getByPlaceholderText('路径占位'), { target: { value: 'C:\\pics\\wall.jpg' } })
    fireEvent.click(screen.getByRole('button', { name: '应用本地' }))
    expect(b.setWallpaper).toHaveBeenCalledWith({ kind: 'local', value: 'C:\\pics\\wall.jpg' })
  })

  it('persists fit and dim changes', () => {
    const b = mount()
    fireEvent.change(screen.getByRole('combobox'), { target: { value: 'tile' } })
    expect(b.setWallpaper).toHaveBeenCalledWith({ fit: 'tile' })
    const [dim] = screen.getAllByRole('slider')
    fireEvent.change(dim!, { target: { value: '0.3' } })
    expect(b.setWallpaper).toHaveBeenCalledWith({ dim: 0.3 })
  })

  it('surface cards persist their mode; reset clears everything', () => {
    const b = mount()
    fireEvent.click(screen.getByRole('button', { name: /玻璃/ }))
    expect(b.setSurface).toHaveBeenCalledWith('glass')
    fireEvent.click(screen.getByRole('button', { name: '重置' }))
    expect(b.resetAppearance).toHaveBeenCalledOnce()
  })

  it('selection follows the store mirror, not the click echo', async () => {
    const b = mount({ ...DEFAULT_WALLPAPER }, 'solid')
    const translucent = screen.getByRole('button', { name: /半透明/ })
    fireEvent.click(translucent)
    expect(translucent.getAttribute('aria-pressed')).toBe('false')
    act(() => {
      b.store.actions.sync(
        { wallpaper: { ...DEFAULT_WALLPAPER }, surface: 'translucent' },
        1,
      )
    })
    expect(b.store.getSnapshot().surface).toBe('translucent')
    await vi.waitFor(() => {
      expect(screen.getByRole('button', { name: /半透明/ }).getAttribute('aria-pressed')).toBe('true')
    })
  })
})
