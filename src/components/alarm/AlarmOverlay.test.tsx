import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { copy } from '../../content/copy'
import { AlarmOverlay } from './AlarmOverlay'

describe('AlarmOverlay', () => {
  it('announces arrival with the stop and distance', () => {
    render(
      <AlarmOverlay
        reason="arrived"
        stopName="Ayala"
        distanceM={240}
        onStop={() => {}}
        onSnooze={() => {}}
      />,
    )
    const dialog = screen.getByRole('alertdialog', { name: 'Para po!' })
    expect(dialog).toHaveAccessibleDescription("You're near your stop.")
    expect(screen.getByText('Ayala · 240 m away')).toBeInTheDocument()
  })

  it('is honest when the stop may have been passed', () => {
    render(<AlarmOverlay reason="passed" onStop={() => {}} />)
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      copy.alarm.body.passed,
    )
  })

  it('focuses the main button and wires both actions', () => {
    const onStop = vi.fn()
    const onSnooze = vi.fn()
    render(
      <AlarmOverlay reason="arrived" onStop={onStop} onSnooze={onSnooze} />,
    )

    const stop = screen.getByRole('button', { name: copy.alarm.stop })
    expect(stop).toHaveFocus()
    fireEvent.click(stop)
    fireEvent.click(screen.getByRole('button', { name: copy.alarm.snooze }))
    expect(onStop).toHaveBeenCalledTimes(1)
    expect(onSnooze).toHaveBeenCalledTimes(1)
  })

  it('shows "Done" and no snooze for a test alarm', () => {
    render(<AlarmOverlay reason="test" onStop={() => {}} />)
    expect(screen.getByRole('button', { name: copy.alarm.done })).toBeVisible()
    expect(screen.queryByRole('button', { name: copy.alarm.snooze })).toBeNull()
    expect(screen.getByRole('alertdialog')).toHaveAccessibleDescription(
      copy.alarm.body.test,
    )
  })

  it('shows just the stop name when distance is unknown', () => {
    render(<AlarmOverlay reason="arrived" stopName="Ayala" onStop={() => {}} />)
    expect(screen.getByText('Ayala')).toBeInTheDocument()
  })
})
