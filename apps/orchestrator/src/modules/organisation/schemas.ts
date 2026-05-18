import { z } from 'zod'

import type { components } from '@/lib/api/schema'

export const organisationTypeSchema = z.object({
  system: z.string().nullable().optional(),
  code: z.string().min(1).max(64),
  display: z.string().nullable().optional(),
})
export type OrganisationType = z.infer<typeof organisationTypeSchema>

export const organisationReadSchema = z.object({
  id: z.string().uuid(),
  parent_organisation_id: z.string().uuid().nullable(),
  name: z.string(),
  type_code: z.string(),
  type_system: z.string().nullable(),
  type_display: z.string().nullable(),
  sort_index: z.number().int().nonnegative(),
}) satisfies z.ZodType<components['schemas']['OrganisationRead']>
export type OrganisationRead = z.infer<typeof organisationReadSchema>

export const organisationListSchema = z.object({
  items: z.array(organisationReadSchema),
}) satisfies z.ZodType<components['schemas']['OrganisationListResponse']>

export type OrganisationCreatePayload = components['schemas']['OrganisationCreate']
export type OrganisationUpdatePayload = components['schemas']['OrganisationUpdate']

export type OrganisationTreeMove = components['schemas']['OrganisationTreeMove']
export type OrganisationTreeUpdatePayload = components['schemas']['OrganisationTreeUpdate']

// Frontend-only guard mirroring the backend Field(min/max). Trips the
// Save button rather than letting a runaway editor blow past the cap.
export const PENDING_MOVES_MIN = 1
export const PENDING_MOVES_MAX = 500
