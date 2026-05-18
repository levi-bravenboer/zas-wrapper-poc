import { fireEvent, render, screen } from '@testing-library/react'
import { useRef, type RefObject } from 'react'
import { describe, expect, it } from 'vitest'

import { useStickyHorizontalScroll } from './use-sticky-horizontal-scroll'

function Probe() {
  const ref = useRef<HTMLDivElement>(null)
  const scrolled = useStickyHorizontalScroll(ref as RefObject<HTMLElement>)
  return (
    <div ref={ref} data-testid="scroller" data-scrolled={scrolled ? 'true' : 'false'}>
      <div style={{ width: 9999 }} />
    </div>
  )
}

describe('useStickyHorizontalScroll', () => {
  it('reports false initially', () => {
    render(<Probe />)
    expect(screen.getByTestId('scroller').dataset.scrolled).toBe('false')
  })

  it('reports true after scrollLeft > 0', () => {
    render(<Probe />)
    const el = screen.getByTestId('scroller')
    Object.defineProperty(el, 'scrollLeft', { value: 10, configurable: true })
    fireEvent.scroll(el)
    expect(el.dataset.scrolled).toBe('true')
  })
})
