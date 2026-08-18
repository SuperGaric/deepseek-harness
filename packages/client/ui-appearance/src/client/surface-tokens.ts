/** Surface transparency token layer: translucent overrides per mode. */

import type { ThemeTokenOverrides } from '@deepseek-ai/dsh-client-ui-theme/client'
import type { SurfaceMode } from '../appearance-settings.ts'

/** Surface alias tokens made translucent, per palette static source [light, dark]. */
export const SURFACE_TOKENS: Readonly<Record<string, readonly [string, string]>> = {
  '--dsw-alias-bg-base': ['--dsw-static-neutral-bluish-00', '--dsw-static-neutral-bluish-950'],
  '--dsw-alias-bg-layer-1': ['--dsw-static-neutral-bluish-00', '--dsw-static-neutral-bluish-875'],
  '--dsw-alias-bg-layer-2': ['--dsw-static-neutral-bluish-00', '--dsw-static-neutral-bluish-850'],
  '--dsw-alias-bg-layer-3': ['--dsw-static-neutral-bluish-00', '--dsw-static-neutral-bluish-800'],
  '--dsw-alias-bg-overlay': ['--dsw-static-neutral-bluish-150', '--dsw-static-neutral-bluish-700'],
  '--dsw-specific-sidebar-fill': ['--dsw-static-neutral-bluish-50', '--dsw-static-neutral-bluish-900'],
}

/** Surface alpha per mode: translucent 0.78, glass 0.55. */
const SURFACE_ALPHA: Readonly<Record<Exclude<SurfaceMode, 'solid'>, number>> = {
  translucent: 0.78,
  glass: 0.55,
}

/**
 * Build the token override layer for one surface mode. `solid` returns an
 * empty layer (the product tokens stay untouched); the other modes map every
 * surface alias to a color-mix over its palette static source, so the values
 * follow the active color scheme without recomputation on theme switches.
 * @param mode - panel surface transparency mode.
 * @returns token-name → `{ light, dark }` pairs, empty for `solid`.
 */
export function surfaceTokenOverrides(mode: SurfaceMode): ThemeTokenOverrides {
  if (mode === 'solid') return {}
  const alpha = SURFACE_ALPHA[mode]
  const tokens: ThemeTokenOverrides = {}
  for (const [name, [light, dark]] of Object.entries(SURFACE_TOKENS)) {
    tokens[name] = {
      light: `color-mix(in srgb, var(${light}) ${Math.round(alpha * 100)}%, transparent)`,
      dark: `color-mix(in srgb, var(${dark}) ${Math.round(alpha * 100)}%, transparent)`,
    }
  }
  return tokens
}
