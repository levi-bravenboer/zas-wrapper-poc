/* eslint-disable i18next/no-literal-string -- inline test fixtures. */
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { EntityDetailSingleColumn } from '../EntityDetailSingleColumn'

describe('EntityDetailSingleColumn', () => {
  it('renders children in stacked card layout', () => {
    render(
      <EntityDetailSingleColumn>
        <div data-testid="a">a</div>
        <div data-testid="b">b</div>
      </EntityDetailSingleColumn>,
    )
    expect(screen.getByTestId('a')).toBeTruthy()
    expect(screen.getByTestId('b')).toBeTruthy()
  })
})
