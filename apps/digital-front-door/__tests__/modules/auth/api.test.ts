import { requestAuthed } from '@/lib/api'
import { login, me } from '@/modules/auth/api'

import { makePatientSession } from '../../fixtures/auth'

const mockRequestAuthed = requestAuthed as jest.MockedFunction<
  typeof requestAuthed
>

describe('auth/api', () => {
  beforeEach(() => {
    mockRequestAuthed.mockReset()
  })

  describe('login', () => {
    it('POSTs to /mobile/auth/login/password with tenant, email, password', async () => {
      const session = makePatientSession()
      mockRequestAuthed.mockResolvedValue({ session })

      const result = await login({
        tenant: 'zas',
        email: 'patient@zas.local',
        password: 'secret',
      })

      expect(mockRequestAuthed).toHaveBeenCalledWith(
        '/mobile/auth/login/password',
        expect.objectContaining({
          method: 'POST',
          body: JSON.stringify({
            tenant: 'zas',
            email: 'patient@zas.local',
            password: 'secret',
          }),
        })
      )
      expect(result.session).toEqual(session)
    })
  })

  describe('me', () => {
    it('GETs /mobile/auth/me', async () => {
      const session = makePatientSession()
      mockRequestAuthed.mockResolvedValue(session)

      const result = await me()

      expect(mockRequestAuthed).toHaveBeenCalledWith('/mobile/auth/me')
      expect(result).toEqual(session)
    })
  })
})
