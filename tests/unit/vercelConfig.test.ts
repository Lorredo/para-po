// @vitest-environment node
import { readFileSync } from 'node:fs'
import { fileURLToPath } from 'node:url'
import { pathToRegexp } from 'path-to-regexp'
import { describe, expect, it } from 'vitest'

/**
 * Vercel rejects the whole deployment if any `source` in vercel.json isn't
 * valid path-to-regexp (v6), and the failure only shows up after pushing.
 * (It happened once: a nested capture group in a header source.)
 */
const config = JSON.parse(
  readFileSync(
    fileURLToPath(new URL('../../vercel.json', import.meta.url)),
    'utf8',
  ),
) as { headers?: Array<{ source: string }> }

const sources = (config.headers ?? []).map((h) => h.source)

describe('vercel.json', () => {
  it.each(sources)('route source %s is valid for Vercel', (source) => {
    expect(() => pathToRegexp(source)).not.toThrow()
  })

  it.each([
    ['/sw.js', true],
    ['/manifest.webmanifest', true],
    ['/workbox-2fbc6a65.js', true],
    ['/assets/index-abc123.js', true],
    ['/index.html', false],
  ])('%s gets a cache header rule: %s', (path, expected) => {
    const matched = sources.some((source) => pathToRegexp(source).test(path))
    expect(matched).toBe(expected)
  })
})
