import { act, fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { copy } from '../../content/copy'
import type {
  InstallPromptStore,
  InstallSnapshot,
} from '../../features/pwa/installPrompt'
import { InstallButton } from './InstallButton'

function fakeStore(initial: Partial<InstallSnapshot>) {
  let snapshot: InstallSnapshot = {
    installed: false,
    canPrompt: false,
    ios: false,
    ...initial,
  }
  const listeners = new Set<() => void>()
  const store = {
    getSnapshot: () => snapshot,
    subscribe: (l: () => void) => {
      listeners.add(l)
      return () => listeners.delete(l)
    },
    prompt: vi.fn(async () => 'accepted' as const),
  } satisfies InstallPromptStore
  const set = (patch: Partial<InstallSnapshot>) =>
    act(() => {
      snapshot = { ...snapshot, ...patch }
      listeners.forEach((l) => l())
    })
  return { store, set }
}

describe('InstallButton', () => {
  it('stays hidden where the app cannot be installed', () => {
    const { store } = fakeStore({})
    render(<InstallButton store={store} />)
    expect(screen.queryByRole('button', { name: copy.pwa.install })).toBeNull()
  })

  it('appears when Chrome offers installing, and shows its prompt', () => {
    const { store, set } = fakeStore({})
    render(<InstallButton store={store} />)
    set({ canPrompt: true })
    fireEvent.click(screen.getByRole('button', { name: copy.pwa.install }))
    expect(store.prompt).toHaveBeenCalled()
  })

  it('shows Add to Home Screen steps on iPhone', () => {
    const { store } = fakeStore({ ios: true })
    render(<InstallButton store={store} />)
    fireEvent.click(screen.getByRole('button', { name: copy.pwa.install }))
    const dialog = screen.getByRole('dialog', { name: copy.pwa.ios.title })
    expect(dialog).toHaveTextContent('Add to Home Screen')
    expect(store.prompt).not.toHaveBeenCalled()
    fireEvent.click(screen.getByRole('button', { name: copy.pwa.ios.done }))
    expect(screen.queryByRole('dialog')).toBeNull()
  })

  it('disappears once installed', () => {
    const { store, set } = fakeStore({ canPrompt: true })
    render(<InstallButton store={store} />)
    set({ installed: true })
    expect(screen.queryByRole('button', { name: copy.pwa.install })).toBeNull()
  })
})
