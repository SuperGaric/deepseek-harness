/**
 * The web surface's native desktop shell launcher: when the web-startup
 * `--desktop` flag is present, this row spawns the Electron shell from
 * `@deepseek-ai/dsh-desktop` over the already-served loopback server. Shell
 * and launcher own one lifetime: closing the window stops this process, and
 * the shell watches this process so a Ctrl+C closes the window.
 * @module @deepseek-ai/dsh-web-app/desktop
 */

import { spawn, type ChildProcess, type SpawnOptions } from 'node:child_process'
import { createRequire } from 'node:module'
import { dirname } from 'node:path'
import type { Context } from '@deepseek-ai/cordis'
import z from '@deepseek-ai/schemastery'

/** Stable Cordis plugin name. */
export const name = 'web-desktop'

/** Services required before the desktop shell can attach. */
export const inject = ['webServer']

/** Plugin config: per-invocation opt-in through the web-startup `--desktop` flag. */
export interface Config {
  /** Spawn the native desktop window; absent `--desktop` leaves the row inert. */
  enabled: boolean
}

export const Config: z<Config> = z.object({
  enabled: z.boolean().default(false),
})

/** Environment variable naming the canonical local URL the shell renders. */
const DSH_DESKTOP_URL = 'DSH_DESKTOP_URL'
/** Environment variable naming this launcher process's pid, the shell's owner. */
const DSH_DESKTOP_OWNER_PID = 'DSH_DESKTOP_OWNER_PID'

/** One resolved desktop runtime: the Electron binary and the shell app directory. */
export interface DesktopRuntime {
  /** Path of the Electron executable. */
  electron: string
  /** Directory holding the Electron shell's package.json (`apps/desktop`). */
  appDir: string
}

/**
 * Resolve the desktop runtime from this package's dependency on
 * `@deepseek-ai/dsh-desktop`: its directory is the shell app, and the
 * `electron` devDependency linked inside it names the executable. Returns
 * undefined when either piece is missing — desktop mode then degrades to
 * the browser URL instead of failing the boot.
 * @returns the runtime, or undefined when Electron is not installed here.
 */
export function resolveRuntime(): DesktopRuntime | undefined {
  const require = createRequire(import.meta.url)
  try {
    const appDir = dirname(require.resolve('@deepseek-ai/dsh-desktop/package.json'))
    // The electron package's entry exports the executable path as a string.
    const binary = require(require.resolve('electron', { paths: [appDir] })) as unknown
    if (typeof binary !== 'string' || binary === '') return undefined
    return { electron: binary, appDir }
  } catch {
    return undefined
  }
}

/** Test hook: tests substitute the resolver and spawner to avoid a real Electron install. */
export const internals: {
  resolveRuntime: () => DesktopRuntime | undefined
  spawn: (command: string, args: readonly string[], options: SpawnOptions) => ChildProcess
} = {
  resolveRuntime,
  // Adapt the overloaded node:child_process spawn to this plugin's one call shape.
  spawn: (command, args, options) => spawn(command, args, options),
}

/** The shell's spawn options shared by the default spawner. */
function spawnOptions(url: string): { env: NodeJS.ProcessEnv; stdio: 'inherit' } {
  return {
    env: {
      ...process.env,
      [DSH_DESKTOP_URL]: url,
      [DSH_DESKTOP_OWNER_PID]: String(process.pid),
    },
    stdio: 'inherit',
  }
}

/**
 * Mount the desktop shell over the live loopback server. Launching waits for
 * Loader settlement exactly like the URL line: a window for a dead server
 * would only mislead. A missing Electron install warns and leaves the
 * browser URL as the surface; a shell that later fails or exits nonzero
 * warns without disturbing the served GUI.
 * @param ctx - plugin context carrying the webserver.
 * @param config - validated {@link Config}.
 */
export function apply(ctx: Context, config: Config): void {
  if (!config.enabled) return
  let child: ChildProcess | undefined
  const launch = (): void => {
    // The tree can be disposed while the boot was in flight (early SIGTERM):
    // spawning a shell over a torn-down server would only mislead.
    const webServer = ctx.get('webServer')
    if (webServer === undefined) return
    const runtime = internals.resolveRuntime()
    if (runtime === undefined) {
      console.warn('dsh desktop: Electron is not installed in this checkout; run `pnpm install` and retry. Serving the browser URL only.')
      return
    }
    const url = `http://127.0.0.1:${String(webServer.port)}`
    child = internals.spawn(runtime.electron, [runtime.appDir], spawnOptions(url))
    child.on('error', (error) => {
      console.warn(`dsh desktop: failed to start Electron (${error.message}); the browser URL keeps working`)
    })
    child.on('exit', (code) => {
      if (code !== 0 && code !== null) {
        console.warn(`dsh desktop: the Electron shell exited with code ${String(code)}; the browser URL keeps working`)
      }
    })
  }
  const settled = ctx.get('loader')?.await()
  if (settled === undefined) launch()
  else void settled.then(launch, () => {})
  // The shell owns the launcher's lifetime, not this row's: disposing the row
  // (a removed patch row, or shutdown) also stops the spawned shell so no
  // orphan window outlives its composition.
  ctx.effect(() => () => {
    child?.kill()
  }, 'web-desktop: spawned shell teardown')
}
