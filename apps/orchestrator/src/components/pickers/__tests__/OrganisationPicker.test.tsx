import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { ReactNode } from 'react'
import { beforeEach, describe, expect, it, vi } from 'vitest'

import { OrganisationPicker } from '../OrganisationPicker'

const { useOrganisationsMock } = vi.hoisted(() => ({ useOrganisationsMock: vi.fn() }))

vi.mock('@/modules/organisation/hooks', () => ({
  useOrganisations: useOrganisationsMock,
}))

const ROOT_ID = '00000000-0000-0000-0000-000000000001'
const CHILD_ID = '00000000-0000-0000-0000-000000000002'
const SIBLING_ID = '00000000-0000-0000-0000-000000000003'

const orgs = [
  {
    id: ROOT_ID,
    parent_organisation_id: null,
    name: 'Zas Hospital',
    type_code: 'prov',
    type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
    type_display: 'Healthcare Provider',
    sort_index: 0,
  },
  {
    id: CHILD_ID,
    parent_organisation_id: ROOT_ID,
    name: 'Cardiology',
    type_code: 'dept',
    type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
    type_display: 'Department',
    sort_index: 1,
  },
  {
    id: SIBLING_ID,
    parent_organisation_id: null,
    name: 'Other Clinic',
    type_code: 'prov',
    type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
    type_display: 'Healthcare Provider',
    sort_index: 2,
  },
]

function Wrap({ children }: { children: ReactNode }) {
  const qc = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } })
  return <QueryClientProvider client={qc}>{children}</QueryClientProvider>
}

describe('OrganisationPicker', () => {
  beforeEach(() => {
    useOrganisationsMock.mockReset()
    useOrganisationsMock.mockReturnValue({ data: orgs, isLoading: false })
  })

  it('renders tree-path labels in the dropdown', async () => {
    render(
      <Wrap>
        <OrganisationPicker value={null} onChange={vi.fn()} />
      </Wrap>,
    )
    await userEvent.click(screen.getByRole('combobox'))
    expect(await screen.findByText('Zas Hospital / Cardiology')).toBeTruthy()
    expect(screen.getByText('Zas Hospital')).toBeTruthy()
    expect(screen.getByText('Other Clinic')).toBeTruthy()
  })

  it('rootId scopes the picker to a subtree (root + descendants only)', async () => {
    render(
      <Wrap>
        <OrganisationPicker value={null} onChange={vi.fn()} rootId={ROOT_ID} />
      </Wrap>,
    )
    await userEvent.click(screen.getByRole('combobox'))
    await screen.findByText('Zas Hospital / Cardiology')
    expect(screen.queryByText('Other Clinic')).toBeNull()
  })

  it('calls onChange(orgId, org) when an item is selected', async () => {
    const onChange = vi.fn()
    render(
      <Wrap>
        <OrganisationPicker value={null} onChange={onChange} />
      </Wrap>,
    )
    await userEvent.click(screen.getByRole('combobox'))
    await userEvent.click(await screen.findByText('Zas Hospital / Cardiology'))
    expect(onChange).toHaveBeenCalledWith(CHILD_ID, expect.objectContaining({ id: CHILD_ID }))
  })
})
