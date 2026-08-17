/**
 * Desktop shell launching: spawn args and environment over the live loopback
 * server, Loader-settlement ordering, degradation without an Electron
 * install, torn-down and failed trees, and dispose-time child cleanup.
 */

import { EventEmitter } from 'node:events'
import type { ChildProcess, SpawnOptions } from 'node:child_process'
import { afterEach, describe, expect, it, vi } from 'vitest'
import { Context } from '@deepseek-ai/cordis'
import { apply, Config, internals, resolveRuntime, type DesktopRuntime } from '../src/desktop.ts'

const RUNTIME: DesktopRuntime = { electron: 'C:\\electron\\electron.exe', appDir: 'D:\\repo\\apps\\desktop' }

/** The spawn signature internals declares. */
type SpawnHook = (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess

/** A fake child the plugin can listen to and kill. */
type FakeChild = EventEmitter & { kill: ReturnType<typeof vi.fn> }

const originalResolve = internals.resolveRuntime
const originalSpawn = internals.spawn

afterEach(() => {
  vi.restoreAllMocks()
  internals.resolveRuntime = originalResolve
  internals.spawn = originalSpawn
})

/** A fake Loader whose settlement the test controls (the launch waits on it). */
function provideLoader(ctx: Context, settle: () => Promise<void> = async () => {}): void {
  ctx.provide('loader', { await: settle } as never)
}

/** Provide a fake bound webserver at a fixed port. */
function provideWebServer(ctx: Context, port = 4567): void {
  ctx.provide('webServer', { host: '127.0.0.1', port } as never)
}

/** Flush pending microtasks and timers. */
function flush(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 0))
}

/** Stub the runtime and spawn, returning the fake child for emission and kill checks. */
function stubSpawn(): FakeChild {
  const child = new EventEmitter() as FakeChild
  child.kill = vi.fn()
  internals.resolveRuntime = () => RUNTIME
  internals.spawn = vi.fn<SpawnHook>(() => child as unknown as ChildProcess)
  return child
}

/** The spawn options recorded by the last spawn call. */
function lastSpawnOptions(): SpawnOptions {
  const calls = vi.mocked(internals.spawn).mock.calls
  const options = calls.at(-1)?.[2]
  expect(options).toBeDefined()
  return options!
}

describe('web desktop shell', () => {
  it('stays inert when desktop mode is disabled', async () => {
    const ctx = new Context()
    provideWebServer(ctx)
    internals.resolveRuntime = () => RUNTIME
    const spawnMock = vi.fn<SpawnHook>()
    internals.spawn = spawnMock
    apply(ctx, new Config({ enabled: false }))
    await flush()
    expect(spawnMock).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
  })

  it('spawns the shell over the live loopback server after Loader settlement', async () => {
    const ctx = new Context()
    provideWebServer(ctx)
    let release: () => void
    const settlement = new Promise<void>((resolve) => { release = resolve })
    provideLoader(ctx, () => settlement)
    stubSpawn()
    apply(ctx, new Config({ enabled: true }))
    await flush()
    expect(internals.spawn).not.toHaveBeenCalled()
    release!()
    await flush()
    expect(internals.spawn).toHaveBeenCalledExactlyOnceWith(
      RUNTIME.electron,
      [RUNTIME.appDir],
      expect.objectContaining({ stdio: 'inherit' }),
    )
    expect(lastSpawnOptions().env).toMatchObject({
      DSH_DESKTOP_URL: 'http://127.0.0.1:4567',
      DSH_DESKTOP_OWNER_PID: String(process.pid),
    })
    await ctx.fiber.dispose()
  })

  it('launches at once in a hand-built tree without a Loader', async () => {
    const ctx = new Context()
    provideWebServer(ctx, 9001)
    stubSpawn()
    apply(ctx, new Config({ enabled: true }))
    await flush()
    expect(internals.spawn).toHaveBeenCalledExactlyOnceWith(
      RUNTIME.electron,
      [RUNTIME.appDir],
      expect.objectContaining({ stdio: 'inherit' }),
    )
    expect(lastSpawnOptions().env).toMatchObject({ DSH_DESKTOP_URL: 'http://127.0.0.1:9001' })
    await ctx.fiber.dispose()
  })

  it('degrades to the browser URL with a warning when Electron is not installed', async () => {
    const ctx = new Context()
    provideWebServer(ctx)
    internals.resolveRuntime = () => undefined
    const spawnMock = vi.fn<SpawnHook>()
    internals.spawn = spawnMock
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    apply(ctx, new Config({ enabled: true }))
    await flush()
    expect(spawnMock).not.toHaveBeenCalled()
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('Electron is not installed'))
    await ctx.fiber.dispose()
  })

  it('drops the launch when the tree tears down during boot or settlement fails', async () => {
    // Torn-down path: settlement resolves after the webserver is gone — no
    // spawn for a dead server, no crash.
    const torn = new Context()
    const childCtx = torn.plugin((ctx: Context) => {
      provideWebServer(ctx)
    })
    await childCtx
    let releaseTorn: () => void
    const tornSettlement = new Promise<void>((resolve) => { releaseTorn = resolve })
    provideLoader(torn, () => tornSettlement)
    stubSpawn()
    apply(torn, new Config({ enabled: true }))
    await childCtx.dispose() // the webServer service goes away
    releaseTorn!()
    await flush()
    expect(internals.spawn).not.toHaveBeenCalled()
    await torn.fiber.dispose()

    // Failed path: the Loader reports the sibling failure; the shell stays
    // unspawned for a process that is about to exit.
    const failed = new Context()
    provideWebServer(failed)
    provideLoader(failed, async () => { throw new Error('boot failed') })
    stubSpawn()
    apply(failed, new Config({ enabled: true }))
    await flush()
    expect(internals.spawn).not.toHaveBeenCalled()
    await failed.fiber.dispose()
  })

  it('kills the spawned shell when the row disposes', async () => {
    const ctx = new Context()
    provideWebServer(ctx)
    const child = stubSpawn()
    apply(ctx, new Config({ enabled: true }))
    await flush()
    expect(child.kill).not.toHaveBeenCalled()
    await ctx.fiber.dispose()
    expect(child.kill).toHaveBeenCalledExactlyOnceWith()
  })

  it('warns without disturbing the served GUI when the shell fails or exits nonzero', async () => {
    const ctx = new Context()
    provideWebServer(ctx)
    const child = stubSpawn()
    const warn = vi.spyOn(console, 'warn').mockImplementation(() => {})
    apply(ctx, new Config({ enabled: true }))
    await flush()
    child.emit('error', new Error('spawn ENOENT'))
    child.emit('exit', 3)
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('failed to start Electron (spawn ENOENT)'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('exited with code 3'))
    expect(warn).toHaveBeenCalledWith(expect.stringContaining('the browser URL keeps working'))
    await ctx.fiber.dispose()
  })

  it('resolves the real desktop runtime when Electron is installed in this checkout', () => {
    const runtime = resolveRuntime()
    if (runtime !== undefined) {
      expect(runtime.appDir).toMatch(/desktop$/)
      expect(runtime.electron).toContain('electron')
    }
  })
})
