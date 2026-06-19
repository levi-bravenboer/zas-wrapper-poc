import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email().min(1).max(256),
  password: z.string().min(1).max(256),
})
export type LoginRequest = z.infer<typeof loginSchema>

// Under dynamic RBAC the session's "role" is the bound role's stable slug
// (e.g. `admin`, `default`); UI gating reads `role_slug` + `permissions`.
export type Role = string

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  display_name: z.string(),
  tenant_id: z.string(),
  role_id: z.string(),
  role_slug: z.string(),
  permissions: z.array(z.string()),
  patient_id: z.string().nullable().optional(),
})
export type SessionUser = z.infer<typeof sessionUserSchema>

// One selectable user row for a multi-row human (REQ-NON-3).
export const roleOptionSchema = z.object({
  user_id: z.string(),
  role_slug: z.string(),
  is_patient: z.boolean().default(false),
})
export type RoleOption = z.infer<typeof roleOptionSchema>

export const providerKindSchema = z.enum(['password', 'oidc'])
export type ProviderKind = z.infer<typeof providerKindSchema>

export const providerDescriptorSchema = z.object({
  key: z.string(),
  label: z.string(),
  kind: providerKindSchema,
})
export type ProviderDescriptor = z.infer<typeof providerDescriptorSchema>

export const roleSelectionRequiredSchema = z.object({
  requires_role_selection: z.literal(true),
  available_roles: z.array(roleOptionSchema),
})
export type RoleSelectionRequired = z.infer<typeof roleSelectionRequiredSchema>

export const loginResultSchema = z.union([roleSelectionRequiredSchema, sessionUserSchema])
export type LoginResult = z.infer<typeof loginResultSchema>
