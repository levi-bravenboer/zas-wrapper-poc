import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { GroupedList, GroupedListSection } from './GroupedList'

describe('GroupedListSection', () => {
  it('renders its label and children rows', () => {
    render(
      <GroupedList>
        <GroupedListSection label="MORGEN">
          {/* eslint-disable-next-line i18next/no-literal-string -- inline test fixture */}
          <div>Eerste rij</div>
          {/* eslint-disable-next-line i18next/no-literal-string -- inline test fixture */}
          <div>Tweede rij</div>
        </GroupedListSection>
      </GroupedList>,
    )

    expect(screen.getByRole('heading', { name: 'MORGEN', level: 2 })).toBeInTheDocument()
    expect(screen.getByText('Eerste rij')).toBeInTheDocument()
    expect(screen.getByText('Tweede rij')).toBeInTheDocument()
  })
})
