import { fireEvent, render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { RadiusSlider } from './RadiusSlider'

describe('RadiusSlider', () => {
  it('shows the current radius in friendly units', () => {
    render(<RadiusSlider value={1500} onChange={() => {}} />)
    const slider = screen.getByRole('slider', { name: 'Alert me within' })
    expect(slider).toHaveValue('1500')
    expect(slider).toHaveAttribute('aria-valuetext', '1.5 km')
    expect(screen.getByText('1.5 km')).toBeInTheDocument()
  })

  it('reports changes as numbers', () => {
    const onChange = vi.fn()
    render(<RadiusSlider value={300} onChange={onChange} />)
    fireEvent.change(screen.getByRole('slider'), { target: { value: '650' } })
    expect(onChange).toHaveBeenCalledWith(650)
  })
})
