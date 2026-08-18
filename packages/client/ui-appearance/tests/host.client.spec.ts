/** ui-appearance host half: durable namespace registration and the wallpaper route. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebServer } from '@deepseek-ai/dsh-host-webserver'
import { SettingsProvider, settingsNamespace, type SettingsNamespace } from '@deepseek-ai/dsh-settings'
import { apply } from '@deepseek-ai/dsh-client-ui-appearance'
import { APPEARANCE_SETTINGS_NAMESPACE, DEFAULT_SURFACE, DEFAULT_WALLPAPER } from '../src/appearance-settings.ts'

class MemorySettings extends SettingsProvider {
  readonly writable = true
  protected load(): Promise<Record<string, unknown>> { return Promise.resolve({}) }
  protected persist(_ns: SettingsNamespace, _section: Record<string, unknown>): Promise<void> {
    return Promise.resolve()
  }
}

/** Minimal ServerResponse stand-in capturing the writeHead/end contract. */
function responseStub() {
  const writeHead = vi.fn()
  const end = vi.fn()
  const res = { writeHead, end } as unknown as ServerResponse
  return { res, writeHead, end }
}

describe('ui-appearance host', () => {
  it('registers, validates, and disposes the durable appearance namespace with its fiber', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    const ns = settingsNamespace(APPEARANCE_SETTINGS_NAMESPACE)
    expect(ctx.settings.get(ns)).toEqual({ wallpaper: DEFAULT_WALLPAPER, surface: DEFAULT_SURFACE })
    await ctx.settings.update(ns, { wallpaper: { kind: 'gradient', value: 'aurora' } })
    // The seam validates the partial patch against the schema, filling defaults.
    expect(ctx.settings.get(ns)).toEqual({
      wallpaper: { ...DEFAULT_WALLPAPER, kind: 'gradient', value: 'aurora' },
      surface: DEFAULT_SURFACE,
    })
    await expect(ctx.settings.update(ns, { surface: 'frosted' })).rejects.toThrow()
    await fiber.dispose()
    expect(ctx.settings.describe().map(row => row.ns)).not.toContain(ns)
  })

  it('serves the section-named local file and answers 404 without one', async () => {
    const ctx = new Context()
    await ctx.plugin(MemorySettings).await()
    let route: Parameters<WebServer['register']>[0] | undefined
    let routeDisposed = false
    const bytes = new Uint8Array([1, 2, 3])
    const fs = {
      resolve: vi.fn(async (path: string) => ({ path })),
      readBytes: vi.fn(async (_target: unknown, _signal: unknown, _max: number) => bytes),
    }
    ctx.provide('webServer', {
      register: (next: Parameters<WebServer['register']>[0]) => {
        route = next
        return () => { routeDisposed = true }
      },
    } as WebServer)
    ctx.provide('fs', fs)
    const fiber = ctx.plugin({ apply })
    await fiber.await()
    expect(route).toBeDefined()
    const ns = settingsNamespace(APPEARANCE_SETTINGS_NAMESPACE)

    // No local wallpaper configured: 404 without touching the filesystem.
    const missing = responseStub()
    await route!.handler({ url: '/dsh-wallpaper' } as IncomingMessage, missing.res)
    expect(missing.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({ 'content-type': 'text/plain; charset=utf-8' }))
    expect(fs.resolve).not.toHaveBeenCalled()

    // A configured local path streams through with a mime type by extension.
    await ctx.settings.update(ns, { wallpaper: { ...DEFAULT_WALLPAPER, kind: 'local', value: 'C:\\pics\\wall.jpg' } })
    const served = responseStub()
    await route!.handler({ url: '/dsh-wallpaper' } as IncomingMessage, served.res)
    expect(fs.resolve).toHaveBeenCalledWith('C:\\pics\\wall.jpg')
    expect(fs.readBytes).toHaveBeenCalledWith(expect.objectContaining({ path: 'C:\\pics\\wall.jpg' }), undefined, 20 * 1024 * 1024)
    expect(served.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'content-type': 'image/jpeg' }))
    expect(served.end).toHaveBeenCalledWith(bytes)

    // A failed read answers 404 with the error text.
    fs.readBytes.mockRejectedValueOnce(new Error('disk exploded'))
    const failed = responseStub()
    await route!.handler({ url: '/dsh-wallpaper' } as IncomingMessage, failed.res)
    expect(failed.writeHead).toHaveBeenCalledWith(404, expect.objectContaining({ 'content-type': 'text/plain; charset=utf-8' }))
    expect(failed.end).toHaveBeenCalledWith('wallpaper unavailable: disk exploded')

    // A non-Error rejection stringifies into the same 404 contract.
    fs.readBytes.mockRejectedValueOnce('gone')
    const raw = responseStub()
    await route!.handler({ url: '/dsh-wallpaper' } as IncomingMessage, raw.res)
    expect(raw.end).toHaveBeenCalledWith('wallpaper unavailable: gone')

    // An unknown extension still serves with a generic content type.
    await ctx.settings.update(ns, { wallpaper: { ...DEFAULT_WALLPAPER, kind: 'local', value: '/tmp/wall' } })
    const generic = responseStub()
    await route!.handler({ url: '/dsh-wallpaper' } as IncomingMessage, generic.res)
    expect(generic.writeHead).toHaveBeenCalledWith(200, expect.objectContaining({ 'content-type': 'application/octet-stream' }))

    await fiber.dispose()
    expect(routeDisposed).toBe(true)
  })

  it('stays quiet without the optional services', async () => {
    const ctx = new Context()
    await ctx.plugin({ apply }).await()
    expect(ctx.get('settings')).toBeUndefined()
    expect(ctx.get('webServer')).toBeUndefined()
  })
})
