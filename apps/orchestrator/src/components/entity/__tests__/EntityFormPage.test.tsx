import {
  RouterProvider,
  createMemoryHistory,
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router'
import { render, screen } from '@testing-library/react'
import { renderHook } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { I18nextProvider } from 'react-i18next'
import { describe, expect, it, vi } from 'vitest'
import { z } from 'zod'

import { useEntityForm } from '@/hooks/entity'
import { i18n } from '@/lib/i18n'

import { EntityFormPage } from '../EntityFormPage'

const schema = z.object({ name: z.string().min(1) })
type Values = z.infer<typeof schema>

function renderWithRouter(node: React.ReactNode): ReturnType<typeof render> {
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

function setupForm(onSubmit: (v: Values) => Promise<void> | void) {
  const { result } = renderHook(() =>
    useEntityForm<Values>({
      schema,
      defaultValues: { name: 'init' },
      onSubmit,
    }),
  )
  return result.current
}

describe('EntityFormPage', () => {
  it('Cancel calls onCancel', async () => {
    const user = userEvent.setup()
    const onCancel = vi.fn()
    const form = setupForm(async () => {})
    renderWithRouter(
      <EntityFormPage<Values>
        mode="create"
        title="Nieuw"
        form={form}
        onCancel={onCancel}
        body={<input data-testid="name" />}
      />,
    )
    const cancel = await screen.findByRole('button', { name: /annuleren/i })
    await user.click(cancel)
    expect(onCancel).toHaveBeenCalledTimes(1)
  })

  it('Save triggers form.handleSubmit which runs onSubmit', async () => {
    const user = userEvent.setup()
    const onSubmit = vi.fn(async () => {})
    const form = setupForm(onSubmit)
    renderWithRouter(
      <EntityFormPage<Values>
        mode="create"
        title="Nieuw"
        form={form}
        onCancel={() => {}}
        body={<input data-testid="name" />}
      />,
    )
    const save = await screen.findByRole('button', { name: /opslaan/i })
    await user.click(save)
    expect(onSubmit).toHaveBeenCalledWith({ name: 'init' })
  })
})
