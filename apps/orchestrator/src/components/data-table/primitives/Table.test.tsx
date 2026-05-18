import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import * as Table from './Table'

describe('Table primitives', () => {
  it('renders Root → Header → HeaderRow → HeaderCell → Body → Row → Cell', () => {
    render(
      <Table.Root aria-label="people">
        <Table.Header>
          <Table.HeaderRow>
            <Table.HeaderCell>Name</Table.HeaderCell>
          </Table.HeaderRow>
        </Table.Header>
        <Table.Body>
          <Table.Row>
            <Table.Cell>Alice</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>,
    )
    expect(screen.getByRole('table')).toBeInTheDocument()
    expect(screen.getByRole('columnheader', { name: 'Name' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'Alice' })).toBeInTheDocument()
  })

  it('Root applies card chrome classes', () => {
    const { container } = render(
      <Table.Root>
        <Table.Body>
          <Table.Row>
            <Table.Cell />
          </Table.Row>
        </Table.Body>
      </Table.Root>,
    )
    expect(container.querySelector('[data-slot="table-root"]')?.className).toMatch(/rounded-lg/)
  })

  it('Row passes data-state for selected', () => {
    render(
      <Table.Root>
        <Table.Body>
          <Table.Row data-state="selected">
            <Table.Cell>a</Table.Cell>
          </Table.Row>
        </Table.Body>
      </Table.Root>,
    )
    expect(screen.getByRole('cell').closest('tr')).toHaveAttribute('data-state', 'selected')
  })
})
