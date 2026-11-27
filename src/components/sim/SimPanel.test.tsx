import { act, fireEvent, render, screen } from '@testing-library/react'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copy } from '../../content/copy'
import { DEFAULT_SIM_ROUTE } from '../../services/location/simRoutes'
import { createSimulatedProvider } from '../../services/location/simulatedProvider'
import { SimPanel } from './SimPanel'

beforeEach(() => {
  vi.useFakeTimers()
})
afterEach(() => {
  vi.useRealTimers()
})

function setup() {
  const provider = createSimulatedProvider(DEFAULT_SIM_ROUTE, { jitterM: 0 })
  const onUseStop = vi.fn()
  const onStart = vi.fn(() => {
    provider.start({ onFix: () => {}, onError: () => {} })
  })
  render(
    <SimPanel
      controller={provider.controller}
      suggestedStop={DEFAULT_SIM_ROUTE.suggestedStop}
      onStart={onStart}
      onUseStop={onUseStop}
    />,
  )
  return { controller: provider.controller, onStart, onUseStop }
}

describe('SimPanel', () => {
  it('starts the ride and offers the suggested stop', () => {
    const { onStart, onUseStop } = setup()
    fireEvent.click(
      screen.getByRole('button', { name: copy.sim.useStop('Ayala') }),
    )
    expect(onUseStop).toHaveBeenCalledWith(DEFAULT_SIM_ROUTE.suggestedStop)

    fireEvent.click(screen.getByRole('button', { name: copy.sim.start }))
    expect(onStart).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: copy.sim.pause }),
    ).toBeInTheDocument()
  })

  it('controls playback speed, pause and progress', () => {
    const { controller } = setup()
    fireEvent.click(screen.getByRole('button', { name: copy.sim.start }))

    fireEvent.click(screen.getByRole('button', { name: '10×' }))
    expect(controller.getState().rate).toBe(10)
    expect(screen.getByRole('button', { name: '10×' })).toHaveAttribute(
      'aria-pressed',
      'true',
    )

    act(() => {
      vi.advanceTimersByTime(2000)
    })
    expect(controller.getState().progressM).toBeCloseTo(220, 0)

    fireEvent.click(screen.getByRole('button', { name: copy.sim.pause }))
    expect(controller.getState().playing).toBe(false)

    fireEvent.change(screen.getByRole('slider', { name: copy.sim.progress }), {
      target: { value: '5000' },
    })
    expect(controller.getState().progressM).toBe(5000)
    expect(screen.getByText(/^5 km of/)).toBeInTheDocument()
  })
})
