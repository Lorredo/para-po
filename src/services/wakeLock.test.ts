import { describe, expect, it, vi } from 'vitest'
import { createFakeWakeLockEnv } from '../test/fakeWakeLockApi'
import { createScreenWakeLock } from './wakeLock'

const flush = () => new Promise((resolve) => setTimeout(resolve, 0))

function setup() {
  const env = createFakeWakeLockEnv()
  const lock = createScreenWakeLock({
    navigator: env.navigator,
    document: env.document,
  })
  const onChange = vi.fn()
  lock.subscribe(onChange)
  return { env, lock, onChange }
}

describe('createScreenWakeLock', () => {
  it('starts off', () => {
    expect(setup().lock.getStatus()).toBe('off')
  })

  it('keeps the screen on when requested', async () => {
    const { env, lock, onChange } = setup()
    await expect(lock.request()).resolves.toBe(true)
    expect(env.wakeLock.request).toHaveBeenCalledWith('screen')
    expect(lock.getStatus()).toBe('active')
    expect(onChange).toHaveBeenCalled()
  })

  it('does not ask twice while active', async () => {
    const { env, lock } = setup()
    await lock.request()
    await lock.request()
    expect(env.wakeLock.request).toHaveBeenCalledTimes(1)
  })

  it('takes the lock back after switching apps', async () => {
    const { env, lock } = setup()
    await lock.request()

    await env.hide()
    expect(lock.getStatus()).toBe('lost')

    env.show()
    await flush()
    expect(lock.getStatus()).toBe('active')
    expect(env.wakeLock.request).toHaveBeenCalledTimes(2)
  })

  it('releases on request and does not come back', async () => {
    const { env, lock } = setup()
    await lock.request()
    lock.release()
    expect(lock.getStatus()).toBe('off')
    expect(env.sentinels[0]!.release).toHaveBeenCalled()

    await env.hide()
    env.show()
    await flush()
    expect(env.wakeLock.request).toHaveBeenCalledTimes(1)
    expect(lock.getStatus()).toBe('off')
  })

  it('releases a lock that arrives after the trip already ended', async () => {
    const { env, lock } = setup()
    const pending = lock.request()
    lock.release()
    await expect(pending).resolves.toBe(false)
    expect(env.sentinels[0]!.release).toHaveBeenCalled()
    expect(lock.getStatus()).toBe('off')
  })

  it('reports a refusal (e.g. Battery Saver)', async () => {
    const { env, lock } = setup()
    env.refuse()
    await expect(lock.request()).resolves.toBe(false)
    expect(lock.getStatus()).toBe('error')
  })

  it('treats a refusal while hidden as "lost", and retries on return', async () => {
    const { env, lock } = setup()
    await env.hide()
    await lock.request()
    expect(lock.getStatus()).toBe('lost')
    env.show()
    await flush()
    expect(lock.getStatus()).toBe('active')
  })

  it('reports browsers without the API', async () => {
    const lock = createScreenWakeLock({
      navigator: {} as Navigator,
      document: undefined,
    })
    await expect(lock.request()).resolves.toBe(false)
    expect(lock.getStatus()).toBe('unsupported')
  })

  it('unsubscribes', async () => {
    const { lock, onChange } = setup()
    const unsubscribe = lock.subscribe(onChange)
    unsubscribe()
    onChange.mockClear()
    await lock.request()
    expect(onChange).toHaveBeenCalledTimes(0)
  })
})
