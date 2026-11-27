/**
 * Small key-value store over localStorage. Every call is wrapped in
 * try/catch because storage can be missing or throw (private browsing,
 * blocked site data, quota exceeded). Callers must treat reads as untrusted.
 */
export type KeyValueStore = {
  read(key: string): unknown
  write(key: string, value: unknown): void
}

export const localStore: KeyValueStore = {
  read(key) {
    try {
      const raw = globalThis.localStorage?.getItem(key)
      return raw == null ? null : (JSON.parse(raw) as unknown)
    } catch {
      return null
    }
  },
  write(key, value) {
    try {
      globalThis.localStorage?.setItem(key, JSON.stringify(value))
    } catch {
      // Storage full or unavailable: caching is best-effort.
    }
  },
}

/** In-memory store, handy for tests. */
export function createMemoryStore(): KeyValueStore & {
  data: Map<string, string>
} {
  const data = new Map<string, string>()
  return {
    data,
    read: (key) => {
      const raw = data.get(key)
      return raw == null ? null : (JSON.parse(raw) as unknown)
    },
    write: (key, value) => {
      data.set(key, JSON.stringify(value))
    },
  }
}
