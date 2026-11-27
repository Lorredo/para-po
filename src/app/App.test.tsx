import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'
import { copy } from '../content/copy'
import App from './App'

describe('App shell', () => {
  it('shows the Para Po name and tagline', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { level: 1, name: 'Para Po' }),
    ).toBeInTheDocument()
    expect(screen.getByText(copy.tagline)).toBeInTheDocument()
  })

  it('shows the empty-state prompt', () => {
    render(<App />)
    expect(
      screen.getByRole('heading', { name: copy.emptyState.title }),
    ).toBeInTheDocument()
  })
})
