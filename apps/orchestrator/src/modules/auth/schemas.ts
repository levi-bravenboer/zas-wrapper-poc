import { z } from 'zod'

export const loginSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
})
export type LoginRequest = z.infer<typeof loginSchema>

export const sessionUserSchema = z.object({
  id: z.string(),
  email: z.string().email(),
  displayName: z.string(),
  roles: z.array(z.string()).default([]),
})
export type SessionUser = z.infer<typeof sessionUserSchema>
