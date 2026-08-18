/** Host registration for the durable appearance section and the wallpaper route. */

import type { Context } from '@deepseek-ai/cordis'
import type { IncomingMessage, ServerResponse } from 'node:http'
import type { WebRoute } from '@deepseek-ai/dsh-host-webserver'
// Type-only: pulls the `ctx.fs` Context merge into this program.
import type {} from '@deepseek-ai/dsh-fs'
import { settingsNamespace } from '@deepseek-ai/dsh-settings'
import {
  APPEARANCE_SETTINGS_NAMESPACE, AppearanceSettingsSchema, type AppearanceSettings,
} from './appearance-settings.ts'

/** Largest local wallpaper the route will serve (bytes). */
const MAX_WALLPAPER_BYTES = 20 * 1024 * 1024

/** Extension → image content type for the wallpaper route. */
const MIME_BY_EXTENSION: Readonly<Record<string, string>> = {
  png: 'image/png',
  jpg: 'image/jpeg',
  jpeg: 'image/jpeg',
  gif: 'image/gif',
  webp: 'image/webp',
  svg: 'image/svg+xml',
  bmp: 'image/bmp',
  avif: 'image/avif',
}

/** Guess an image content type from a path extension. */
function contentTypeFor(path: string): string {
  const dot = path.lastIndexOf('.')
  const ext = dot >= 0 ? path.slice(dot + 1).toLowerCase() : ''
  return MIME_BY_EXTENSION[ext] ?? 'application/octet-stream'
}

/**
 * Register the durable appearance section and the local-wallpaper route when
 * their optional Host services are composed. The route serves whatever local
 * path the section currently names, so the browser needs no file RPC: the
 * settings write is the only wire surface.
 * @param ctx - Host context that may acquire settings, fs, and HTTP services.
 */
export function apply(ctx: Context): void {
  ctx.inject(['settings'], (settingsCtx) => {
    settingsCtx.settings.register(settingsNamespace(APPEARANCE_SETTINGS_NAMESPACE), AppearanceSettingsSchema)
  })
  ctx.inject(['webServer', 'settings', 'fs'], (httpCtx) => {
    httpCtx.effect(
      () => httpCtx.webServer.register(wallpaperRoute(httpCtx)),
      'ui-appearance: wallpaper route',
    )
  })
}

/** The local-wallpaper route: reads the section's current path per request. */
function wallpaperRoute(ctx: {
  settings: NonNullable<Context['settings']>
  fs: NonNullable<Context['fs']>
}): WebRoute {
  return {
    kind: 'prefix',
    path: '/dsh-wallpaper',
    handler: async (_req: IncomingMessage, res: ServerResponse) => {
      const section = ctx.settings.get(settingsNamespace(APPEARANCE_SETTINGS_NAMESPACE)) as AppearanceSettings | undefined
      const path = section?.wallpaper.kind === 'local' ? section.wallpaper.value : ''
      if (path === '') {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end('wallpaper not set')
        return
      }
      try {
        const target = await ctx.fs.resolve(path)
        const bytes = await ctx.fs.readBytes(target, undefined, MAX_WALLPAPER_BYTES)
        res.writeHead(200, { 'content-type': contentTypeFor(path), 'cache-control': 'no-store' })
        res.end(bytes)
      } catch (err) {
        res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' })
        res.end(`wallpaper unavailable: ${err instanceof Error ? err.message : String(err)}`)
      }
    },
  }
}
