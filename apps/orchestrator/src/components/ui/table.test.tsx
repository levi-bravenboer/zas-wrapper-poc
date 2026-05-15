/* eslint-disable testing-library/no-container, testing-library/no-node-access --
   Table primitives are semantic wrappers; querying by tag is the clearest assertion. */
import { render } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import {
  Table,
  TableBody,
  TableCaption,
  TableCell,
  TableFooter,
  TableHead,
  TableHeader,
  TableRow,
} from './table'

describe('Table primitives', () => {
  it('renders a semantic <table> element', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>cell</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    expect(container.querySelector('table')).not.toBeNull()
  })

  it('renders TableHead as <th scope="col">', () => {
    const { container } = render(
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
          </TableRow>
        </TableHeader>
      </Table>,
    )
    const th = container.querySelector('th')
    expect(th).not.toBeNull()
    expect(th?.getAttribute('scope')).toBe('col')
  })

  it('renders TableRow as <tr> with nested TableCell as <td>', () => {
    const { container } = render(
      <Table>
        <TableBody>
          <TableRow>
            <TableCell>value</TableCell>
          </TableRow>
        </TableBody>
      </Table>,
    )
    const tr = container.querySelector('tbody > tr')
    expect(tr).not.toBeNull()
    const td = tr?.querySelector('td')
    expect(td).not.toBeNull()
    expect(td?.textContent).toBe('value')
  })

  it('matches the composed table snapshot', () => {
    const { container } = render(
      <Table>
        <TableCaption>Users</TableCaption>
        <TableHeader>
          <TableRow>
            <TableHead>Name</TableHead>
            <TableHead>Email</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          <TableRow>
            <TableCell>Ada</TableCell>
            <TableCell>ada@example.com</TableCell>
          </TableRow>
        </TableBody>
        <TableFooter>
          <TableRow>
            <TableCell>Total</TableCell>
            <TableCell>1</TableCell>
          </TableRow>
        </TableFooter>
      </Table>,
    )
    expect(container.firstChild).toMatchSnapshot()
  })
})
