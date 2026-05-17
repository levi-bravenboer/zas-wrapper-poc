import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'

import { i18n } from '@/lib/i18n'

import type { OrganisationRead } from '../../schemas'
import { OrganisationTree } from '../OrganisationTree'

const root: OrganisationRead = {
  id: '00000000-0000-0000-0000-000000000001',
  parent_organisation_id: null,
  name: 'Root Org',
  type_code: 'prov',
  type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
  type_display: 'Healthcare Provider',
  sort_index: 0,
}

const child: OrganisationRead = {
  id: '00000000-0000-0000-0000-000000000002',
  parent_organisation_id: root.id,
  name: 'Child Org',
  type_code: 'dept',
  type_system: 'http://terminology.hl7.org/CodeSystem/organization-type',
  type_display: 'Hospital Department',
  sort_index: 0,
}

function renderTree(overrides: Partial<Parameters<typeof OrganisationTree>[0]> = {}) {
  const onOpenDetail = vi.fn()
  const onEdit = vi.fn()
  const onCreateChild = vi.fn()
  const onArchive = vi.fn()
  render(
    <I18nextProvider i18n={i18n}>
      <OrganisationTree
        organisations={[root, child]}
        onOpenDetail={onOpenDetail}
        onEdit={onEdit}
        onCreateChild={onCreateChild}
        onArchive={onArchive}
        {...overrides}
      />
    </I18nextProvider>,
  )
  return { onOpenDetail, onEdit, onCreateChild, onArchive }
}

describe('OrganisationTree', () => {
  it('renders root and child by default (all expanded)', () => {
    renderTree()
    expect(screen.getByText('Root Org')).toBeTruthy()
    expect(screen.getByText('Child Org')).toBeTruthy()
  })

  it('fires onOpenDetail when name button clicked', async () => {
    const { onOpenDetail } = renderTree()
    await userEvent.click(screen.getByText('Root Org'))
    expect(onOpenDetail).toHaveBeenCalledWith(root)
  })

  it('fires onCreateChild from action menu', async () => {
    const { onCreateChild } = renderTree()
    const [firstAction] = screen.getAllByRole('button', { name: /acties/i })
    if (!firstAction) throw new Error('expected at least one action button')
    await userEvent.click(firstAction)
    await userEvent.click(await screen.findByText(/nieuwe sub-organisatie/i))
    expect(onCreateChild).toHaveBeenCalled()
  })
})
