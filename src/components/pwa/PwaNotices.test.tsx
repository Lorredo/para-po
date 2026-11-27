import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { copy } from '../../content/copy'
import { PwaNotices } from './PwaNotices'

function setup(props: Partial<Parameters<typeof PwaNotices>[0]> = {}) {
  const handlers = {
    onUpdate: vi.fn(),
    onDismissUpdate: vi.fn(),
    onDismissOfflineReady: vi.fn(),
  }
  render(
    <PwaNotices
      online
      needRefresh={false}
      offlineReady={false}
      tripActive={false}
      {...handlers}
      {...props}
    />,
  )
  return handlers
}

describe('PwaNotices', () => {
  it('shows nothing when online and up to date', () => {
    setup()
    expect(screen.queryByRole('status')).toBeNull()
  })

  it('explains what still works offline', () => {
    setup({ online: false })
    expect(screen.getByText(copy.pwa.offline)).toBeInTheDocument()
  })

  it('offers an update, with "later"', () => {
    const { onUpdate, onDismissUpdate } = setup({ needRefresh: true })
    fireEvent.click(screen.getByRole('button', { name: copy.pwa.update }))
    fireEvent.click(screen.getByRole('button', { name: copy.pwa.later }))
    expect(onUpdate).toHaveBeenCalled()
    expect(onDismissUpdate).toHaveBeenCalled()
  })

  it('never offers a reload during a trip', () => {
    setup({ needRefresh: true, tripActive: true })
    expect(screen.queryByText(copy.pwa.updateReady)).toBeNull()
  })

  it('says once when the app can open offline', () => {
    const { onDismissOfflineReady } = setup({ offlineReady: true })
    fireEvent.click(screen.getByRole('button', { name: copy.pwa.ok }))
    expect(onDismissOfflineReady).toHaveBeenCalled()
  })
})
