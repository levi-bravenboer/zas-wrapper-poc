import { screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { HttpResponse, http } from 'msw'
import { describe, expect, it } from 'vitest'

import { env } from '@/config/env'
import { server } from '@/mocks/server'
import { renderWithProviders } from '@/test/renderWithProviders'

import { LoginForm } from './LoginForm'

const baseUrl = env.API_BASE_URL

describe('LoginForm', () => {
  it('shows validation errors when fields are empty', async () => {
    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    const submit = await screen.findByRole('button', { name: 'Inloggen' })
    await user.click(submit)

    await waitFor(() => {
      expect(screen.getAllByRole('alert').length).toBeGreaterThan(0)
    })
  })

  it('surfaces an error toast when the credentials are wrong', async () => {
    server.use(
      http.post(`${baseUrl}/auth/login`, () =>
        HttpResponse.json({ detail: 'Invalid credentials' }, { status: 401 }),
      ),
    )

    const user = userEvent.setup()
    renderWithProviders(<LoginForm />)

    await user.type(await screen.findByLabelText(/gebruikersnaam/i), 'demo')
    await user.type(await screen.findByLabelText(/wachtwoord/i), 'wrong')
    await user.click(screen.getByRole('button', { name: 'Inloggen' }))

    await waitFor(() => {
      expect(screen.getByText(/inloggen mislukt/i)).toBeInTheDocument()
    })
  })
})
