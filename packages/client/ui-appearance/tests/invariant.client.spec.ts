/** ui-appearance invariant companion: declares the dependency and registers package ownership. */
import { Context } from '@deepseek-ai/cordis'
import { describe, expect, it, vi } from 'vitest'
import { apply, inject, name } from '@deepseek-ai/dsh-client-ui-appearance/invariant'

describe('ui-appearance invariant', () => {
  it('declares the invariants dependency', () => {
    expect(name).toBe('client-ui-appearance-invariant')
    expect(inject).toEqual(['invariants'])
  })

  it('registers package ownership and returns the disposer', async () => {
    const ctx = new Context()
    const register = vi.fn(() => () => {})
    ctx.provide('invariants', { register })
    const dispose = await apply(ctx)
    expect(register).toHaveBeenCalledWith('@deepseek-ai/dsh-client-ui-appearance', expect.any(Function))
    expect(typeof dispose).toBe('function')
  })
})
