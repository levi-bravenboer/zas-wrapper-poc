/* eslint-disable testing-library/no-container, testing-library/no-node-access --
   Skeleton primitives are purely presentational placeholders without a11y roles;
   slot-attribute checks are the only meaningful assertion. */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { CardSkeleton, DetailSkeleton, RowSkeleton } from './Skeleton'

describe('Skeleton compositions', () => {
  it('renders the row skeleton slot', () => {
    const { container } = render(<RowSkeleton />)
    expect(container.querySelector('[data-slot="row-skeleton"]')).not.toBeNull()
  })

  it('renders the card skeleton slot', () => {
    const { container } = render(<CardSkeleton />)
    expect(container.querySelector('[data-slot="card-skeleton"]')).not.toBeNull()
  })

  it('renders the detail skeleton with nested row + card slots', () => {
    const { container } = render(<DetailSkeleton />)
    expect(container.querySelector('[data-slot="detail-skeleton"]')).not.toBeNull()
    expect(container.querySelectorAll('[data-slot="row-skeleton"]').length).toBeGreaterThan(0)
    expect(container.querySelectorAll('[data-slot="card-skeleton"]').length).toBeGreaterThan(0)
  })
})
