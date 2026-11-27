import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { copy } from '../../content/copy'
import { createFakeAudio } from '../../test/fakeAlarm'
import { SoundSettings } from './SoundSettings'

function setup({ supported = true } = {}) {
  const fake = createFakeAudio({ supported })
  const onRingtoneChange = vi.fn()
  const onTestAlarm = vi.fn()
  const view = render(
    <SoundSettings
      audio={fake.audio}
      ringtoneId="jeepney"
      onRingtoneChange={onRingtoneChange}
      onTestAlarm={onTestAlarm}
    />,
  )
  return { ...fake, onRingtoneChange, onTestAlarm, ...view }
}

describe('SoundSettings', () => {
  it('lists every ringtone and reports changes', () => {
    const { onRingtoneChange } = setup()
    const select = screen.getByRole('combobox', { name: copy.sound.label })
    expect(select).toHaveValue('jeepney')
    expect(screen.getAllByRole('option').map((o) => o.textContent)).toEqual([
      'Jeepney beep',
      'Bell',
      'Chime',
      'Beeps',
    ])
    fireEvent.change(select, { target: { value: 'chime' } })
    expect(onRingtoneChange).toHaveBeenCalledWith('chime')
  })

  it('previews once, unlocking audio inside the tap', () => {
    const { audio, finish } = setup()
    fireEvent.click(screen.getByRole('button', { name: copy.sound.preview }))

    expect(audio.unlock).toHaveBeenCalled()
    expect(audio.play).toHaveBeenCalledWith('jeepney', {
      loop: false,
      onEnded: expect.any(Function),
    })
    const stop = screen.getByRole('button', { name: copy.sound.stopPreview })
    expect(stop).toHaveAttribute('aria-pressed', 'true')

    act(() => finish())
    expect(
      screen.getByRole('button', { name: copy.sound.preview }),
    ).toBeVisible()
  })

  it('can stop a preview early', () => {
    const { audio } = setup()
    fireEvent.click(screen.getByRole('button', { name: copy.sound.preview }))
    fireEvent.click(
      screen.getByRole('button', { name: copy.sound.stopPreview }),
    )
    expect(audio.stop).toHaveBeenCalled()
  })

  it('stops the preview when switching ringtone', () => {
    const { audio } = setup()
    fireEvent.click(screen.getByRole('button', { name: copy.sound.preview }))
    fireEvent.change(screen.getByRole('combobox'), {
      target: { value: 'bell' },
    })
    expect(audio.stop).toHaveBeenCalled()
    expect(
      screen.getByRole('button', { name: copy.sound.preview }),
    ).toBeVisible()
  })

  it('stops the preview if the panel goes away', () => {
    const { audio, unmount } = setup()
    fireEvent.click(screen.getByRole('button', { name: copy.sound.preview }))
    unmount()
    expect(audio.stop).toHaveBeenCalled()
  })

  it('opens the test alarm and reminds about volume', () => {
    const { onTestAlarm } = setup()
    fireEvent.click(screen.getByRole('button', { name: copy.sound.test }))
    expect(onTestAlarm).toHaveBeenCalled()
    expect(screen.getByText(copy.sound.volumeHint)).toBeInTheDocument()
  })

  it('explains and disables itself without Web Audio', () => {
    setup({ supported: false })
    expect(screen.getByText(copy.sound.unsupported)).toBeInTheDocument()
    expect(screen.getByRole('combobox')).toBeDisabled()
    expect(
      screen.getByRole('button', { name: copy.sound.preview }),
    ).toBeDisabled()
    expect(screen.getByRole('button', { name: copy.sound.test })).toBeDisabled()
  })
})
