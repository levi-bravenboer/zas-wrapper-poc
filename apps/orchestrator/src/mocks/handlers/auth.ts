import { HttpResponse, http } from 'msw'
import { z } from 'zod'

import { env } from '@/config/env'

const loginBodySchema = z.object({
  email: z.string().optional(),
  password: z.string().optional(),
})

const baseUrl = env.API_BASE_URL

const TENANT = '00000000-0000-0000-0000-000000000001'
const DEFAULT_ROLE_ID = 'd2222222-2222-4222-8222-2222222222d1'
const ADMIN_ROLE_ID = 'a1111111-1111-4111-8111-1111111111a1'

const STUB_USER = {
  id: 'user_demo',
  email: 'caregiver@zas.local',
  display_name: 'Demo Caregiver',
  tenant_id: TENANT,
  role_id: DEFAULT_ROLE_ID,
  role_slug: 'default',
  permissions: [] as string[],
  patient_id: null,
}

// multi-role human (REQ-NON-3): login answers requires_role_selection and
// the session stays unbound until POST /auth/session/role. Each selectable row
// is a distinct user_id (slugs can collide).
const MULTI_ADMIN_ROW = { user_id: 'user_multi_admin', role_slug: 'admin', is_patient: false }
const MULTI_DEFAULT_ROW = { user_id: 'user_multi_default', role_slug: 'default', is_patient: false }
const MULTI_ROLE_ROWS = [MULTI_ADMIN_ROW, MULTI_DEFAULT_ROW]

function multiRoleUser(userId: string) {
  const isAdmin = userId === MULTI_ADMIN_ROW.user_id
  return {
    id: userId,
    email: 'hoofdarts@zas.local',
    display_name: 'Hilde Hoofdarts',
    tenant_id: TENANT,
    role_id: isAdmin ? ADMIN_ROLE_ID : DEFAULT_ROLE_ID,
    role_slug: isAdmin ? 'admin' : 'default',
    permissions: [] as string[],
    patient_id: null,
  }
}

const STUB_PROVIDERS = [
  { key: 'password', label: 'E-mail + wachtwoord', kind: 'password' as const },
]

const SESSION_COOKIE = 'BACKEND_SESSION=demo; Path=/; SameSite=Strict'

let signedIn = false
let multiRoleActiveUserId: string | null = null
let multiRoleSessionLive = false

export const authHandlers = [
  http.post(`${baseUrl}/auth/login/password`, async ({ request }) => {
    const body = loginBodySchema.parse(await request.json())
    if (!body.email || !body.password) {
      return HttpResponse.json(
        { code: 'security.auth.invalid_credentials', detail: 'Missing credentials' },
        { status: 400 },
      )
    }
    if (body.email === 'hoofdarts@zas.local' && body.password === 'changeme') {
      multiRoleSessionLive = true
      multiRoleActiveUserId = null
      signedIn = false
      return HttpResponse.json(
        { requires_role_selection: true, available_roles: MULTI_ROLE_ROWS },
        { status: 200, headers: { 'Set-Cookie': SESSION_COOKIE } },
      )
    }
    if (body.email !== STUB_USER.email || body.password !== 'changeme') {
      return HttpResponse.json(
        { code: 'security.auth.invalid_credentials', detail: 'Invalid credentials' },
        { status: 401 },
      )
    }
    signedIn = true
    return HttpResponse.json(STUB_USER, {
      status: 200,
      headers: { 'Set-Cookie': SESSION_COOKIE },
    })
  }),

  http.post(`${baseUrl}/auth/logout`, () => {
    signedIn = false
    multiRoleSessionLive = false
    multiRoleActiveUserId = null
    return new HttpResponse(null, { status: 204 })
  }),

  http.post(`${baseUrl}/auth/session/role`, async ({ request }) => {
    const body = z.object({ user_id: z.string() }).parse(await request.json())
    if (!multiRoleSessionLive) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    multiRoleActiveUserId = body.user_id
    return HttpResponse.json(multiRoleUser(body.user_id), { status: 200 })
  }),

  http.get(`${baseUrl}/auth/session/roles`, () => {
    if (multiRoleSessionLive) {
      return HttpResponse.json(MULTI_ROLE_ROWS, { status: 200 })
    }
    if (signedIn) {
      return HttpResponse.json(
        [{ user_id: STUB_USER.id, role_slug: STUB_USER.role_slug, is_patient: false }],
        { status: 200 },
      )
    }
    return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
  }),

  http.get(`${baseUrl}/auth/me`, () => {
    if (multiRoleSessionLive) {
      if (multiRoleActiveUserId === null) {
        return HttpResponse.json(
          {
            code: 'conflict.auth.role_selection_required',
            message: 'Select an active role for this session.',
            details: { available_roles: MULTI_ROLE_ROWS },
          },
          { status: 409 },
        )
      }
      return HttpResponse.json(multiRoleUser(multiRoleActiveUserId), { status: 200 })
    }
    if (!signedIn) {
      return HttpResponse.json({ detail: 'Not authenticated' }, { status: 401 })
    }
    return HttpResponse.json(STUB_USER, { status: 200 })
  }),

  http.get(`${baseUrl}/auth/providers`, () => HttpResponse.json(STUB_PROVIDERS, { status: 200 })),
]
