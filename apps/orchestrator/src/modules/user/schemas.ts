import { z } from 'zod'

import type { components } from '@/lib/api/schema'

export const roleSchema = z.enum(['admin', 'caregiver'])
export type Role = z.infer<typeof roleSchema>

export const userRowSchema = z.object({
  id: z.string().uuid(),
  email: z.string(),
  display_name: z.string(),
  role: roleSchema,
  is_active: z.boolean(),
  created_at: z.string(),
}) satisfies z.ZodType<components['schemas']['UserRow']>
export type UserRow = z.infer<typeof userRowSchema>

export const userDetailSchema = userRowSchema.extend({
  external_idp: z.string().nullable(),
  external_subject: z.string().nullable(),
  updated_at: z.string(),
})
export type UserDetail = z.infer<typeof userDetailSchema>

export const setActiveRequestSchema = z.object({ is_active: z.boolean() })
export type SetActiveRequest = z.infer<typeof setActiveRequestSchema>

export const assignRoleRequestSchema = z.object({ role: roleSchema })
export type AssignRoleRequest = z.infer<typeof assignRoleRequestSchema>
