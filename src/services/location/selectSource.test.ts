import { describe, expect, it } from 'vitest'
import { selectLocationSource } from './selectSource'

describe('selectLocationSource', () => {
  it('uses real GPS by default', () => {
    const source = selectLocationSource('')
    expect(source.provider.kind).toBe('browser')
    expect(source.sim).toBeUndefined()
  })

  it('uses the simulated ride with ?sim', () => {
    const source = selectLocationSource('?sim')
    expect(source.provider.kind).toBe('simulated')
    expect(source.sim?.route.id).toBe('edsa')
    expect(source.sim?.controller.getState().rate).toBe(1)
  })

  it('reads the route and speed', () => {
    const source = selectLocationSource('?sim=edsa&speed=10')
    expect(source.sim?.controller.getState().rate).toBe(10)
  })

  it('falls back to the default route for unknown names', () => {
    expect(selectLocationSource('?sim=nowhere').sim?.route.id).toBe('edsa')
  })
})
