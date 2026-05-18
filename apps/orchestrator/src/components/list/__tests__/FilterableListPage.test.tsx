/* eslint-disable i18next/no-literal-string -- inline test fixtures, not user copy. */
import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it } from 'vitest'

import { i18n } from '@/lib/i18n'

import { FilterableListPage } from '../FilterableListPage'

type Row = { id: string }

function renderPage(node: React.ReactNode): ReturnType<typeof render> {
  const rootRoute = createRootRoute()
  const indexRoute = createRoute({
    getParentRoute: () => rootRoute,
    path: '/',
    component: () => <>{node}</>,
  })
  const router = createRouter({
    routeTree: rootRoute.addChildren([indexRoute]),
    history: createMemoryHistory({ initialEntries: ['/'] }),
  })
  return render(
    <I18nextProvider i18n={i18n}>
      <RouterProvider router={router} />
    </I18nextProvider>,
  )
}

describe('FilterableListPage', () => {
  it('renders title, description, filters, primary action, and table', async () => {
    renderPage(
      <FilterableListPage<Row>
        title="Patiënten"
        description="lijst"
        filters={<div data-testid="filters">f</div>}
        primaryAction={<button type="button">Toevoegen</button>}
        table={<div data-testid="table">t</div>}
      />,
    )
    expect(await screen.findByRole('heading', { level: 1, name: 'Patiënten' })).toBeTruthy()
    expect(screen.getByText('lijst')).toBeTruthy()
    expect(screen.getByTestId('filters')).toBeTruthy()
    expect(screen.getByRole('button', { name: 'Toevoegen' })).toBeTruthy()
    expect(screen.getByTestId('table')).toBeTruthy()
  })

  it('renders table by default when isEmpty is false', async () => {
    renderPage(
      <FilterableListPage<Row>
        title="t"
        table={<div data-testid="table">t</div>}
        emptyState={<div data-testid="empty">e</div>}
      />,
    )
    expect(await screen.findByTestId('table')).toBeTruthy()
    expect(screen.queryByTestId('empty')).toBeNull()
  })

  it('swaps to emptyState only when isEmpty is true', async () => {
    renderPage(
      <FilterableListPage<Row>
        title="t"
        table={<div data-testid="table">t</div>}
        emptyState={<div data-testid="empty">e</div>}
        isEmpty
      />,
    )
    expect(await screen.findByTestId('empty')).toBeTruthy()
    expect(screen.queryByTestId('table')).toBeNull()
  })

  it('keeps table when isEmpty is true but no emptyState slot is provided', async () => {
    renderPage(
      <FilterableListPage<Row> title="t" table={<div data-testid="table">t</div>} isEmpty />,
    )
    expect(await screen.findByTestId('table')).toBeTruthy()
  })
})
