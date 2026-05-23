/* eslint-disable testing-library/no-container, testing-library/no-node-access --
   Skeleton primitives are purely presentational placeholders without a11y roles;
   slot-attribute checks are the only meaningful assertion. */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { RowSkeleton } from './Skeleton'

describe('Skeleton compositions', () => {
  it('renders the row skeleton slot', () => {
    const { container } = render(<RowSkeleton />)
    expect(container.querySelector('[data-slot="row-skeleton"]')).not.toBeNull()
  })
})
