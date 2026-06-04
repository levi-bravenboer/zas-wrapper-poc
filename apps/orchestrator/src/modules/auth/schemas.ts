import { z } from 'zod'

export const loginSchema = z.object({
  email: z.string().email().min(1).max(256),
  password: z.string().min(1).max(256),
})
export type LoginRequest = z.infer<typeof loginSchema>

export const roleSchema = z.enum(['admin', 'caregiver', 'external'])
export type Role = z.infer<typeof roleSchema>

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  display_name: z.string(),
  tenant_id: z.string(),
  role: roleSchema,
})
export type SessionUser = z.infer<typeof sessionUserSchema>

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
  available_roles: z.array(roleSchema),
})
export type RoleSelectionRequired = z.infer<typeof roleSelectionRequiredSchema>

export const loginResultSchema = z.union([roleSelectionRequiredSchema, sessionUserSchema])
export type LoginResult = z.infer<typeof loginResultSchema>
