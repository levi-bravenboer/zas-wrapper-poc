import { z } from 'zod'

import type { components } from '@/lib/api/schema'

export const practitionerRoleCodeSchema = z.enum([
  'gp',
  'physiotherapist',
  'psychologist',
  'nurse',
  'physician',
  'other',
])
export type PractitionerRoleCode = z.infer<typeof practitionerRoleCodeSchema>

export const practitionerSummarySchema = z.object({
  id: z.string().uuid(),
  user_id: z.string().uuid(),
  display_name: z.string(),
  family_name: z.string(),
  given_name: z.string(),
}) satisfies z.ZodType<components['schemas']['PractitionerSummary']>
export type PractitionerSummary = z.infer<typeof practitionerSummarySchema>

// Zod 4's `.nullable().optional()` widens output to `T | null | undefined`,
// which under `exactOptionalPropertyTypes` doesn't satisfy the generated
// `specialty?: string | null` (missing-or-string|null, never explicit
// undefined). The runtime shape still matches the API; we just don't
// re-assert it via `satisfies` here.
export const practitionerRoleReadSchema = z.object({
  id: z.string().uuid(),
  practitioner_id: z.string().uuid(),
  organisation_id: z.string().uuid(),
  code: practitionerRoleCodeSchema,
  specialty: z.string().nullable().optional(),
  is_primary: z.boolean(),
  period_start: z.string(),
  period_end: z.string().nullable().optional(),
  practitioner: practitionerSummarySchema.nullable().optional(),
})
export type PractitionerRoleRead = z.infer<typeof practitionerRoleReadSchema>

export type PractitionerRoleCreatePayload = components['schemas']['PractitionerRoleCreate']
export type PractitionerRoleUpdatePayload = components['schemas']['PractitionerRoleUpdate']
