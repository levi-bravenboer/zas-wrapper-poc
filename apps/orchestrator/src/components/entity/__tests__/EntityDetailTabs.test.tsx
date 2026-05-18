/* eslint-disable i18next/no-literal-string -- inline test fixtures. */
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it } from 'vitest'

import { EntityDetailTabs } from '../EntityDetailTabs'

describe('EntityDetailTabs', () => {
  it('renders triggers and switches content on click', async () => {
    const user = userEvent.setup()
    render(
      <EntityDetailTabs
        tabs={[
          { value: 'one', label: 'Tab een', content: <div data-testid="c1">een</div> },
          { value: 'two', label: 'Tab twee', content: <div data-testid="c2">twee</div> },
        ]}
      />,
    )
    expect(screen.getByTestId('c1')).toBeTruthy()
    expect(screen.queryByTestId('c2')).toBeNull()
    await user.click(screen.getByRole('tab', { name: 'Tab twee' }))
    expect(screen.getByTestId('c2')).toBeTruthy()
  })
})
