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
  render(
    <SimPanel
      controller={provider.controller}
      suggestedStop={DEFAULT_SIM_ROUTE.suggestedStop}
      onUseStop={onUseStop}
    />,
  )
  // In the app, "Start trip" starts the provider.
  const startRide = () =>
    act(() => {
      provider.start({ onFix: () => {}, onError: () => {} })
    })
  return { controller: provider.controller, onUseStop, startRide }
}

describe('SimPanel', () => {
  it('offers the suggested stop and explains how to start', () => {
    const { onUseStop } = setup()
    fireEvent.click(
      screen.getByRole('button', { name: copy.sim.useStop('Ayala') }),
    )
    expect(onUseStop).toHaveBeenCalledWith(DEFAULT_SIM_ROUTE.suggestedStop)
    expect(screen.getByText(copy.sim.startHint)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: copy.sim.pause })).toBeNull()
  })

  it('shows ride controls once the ride is running', () => {
    const { startRide } = setup()
    startRide()
    expect(screen.queryByText(copy.sim.startHint)).toBeNull()
    expect(
      screen.getByRole('button', { name: copy.sim.pause }),
    ).toBeInTheDocument()
  })

  it('controls playback speed, pause and progress', () => {
    const { controller, startRide } = setup()
    startRide()

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
