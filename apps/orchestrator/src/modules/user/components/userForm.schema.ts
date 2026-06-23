import { z } from 'zod'

// Flat shape keeps TanStack Form field paths simple. `role_id` is the RBAC role
// to bind (decoupled from identity-type). `is_clinician` drives the practitioner
// branch, mirroring the backend `UserCreate` discrimination on clinical fields:
//   clinician → given_name + family_name required; display_name derived
//     server-side; a Practitioner row is written atomically (§1.2).
//   non-clinician → display_name required.
// Messages are i18n KEYS (`form.error.*`) resolved at render via t().
const userFormShape = {
  email: z
    .string()
    .min(1, { message: 'form.error.required' })
    .email({ message: 'form.error.email_invalid' })
    .max(256, { message: 'form.error.too_long' }),
  role_id: z.string().uuid({ message: 'form.error.required' }),
  is_clinician: z.boolean(),
  display_name: z.string().trim().max(200, { message: 'form.error.too_long' }),
  given_name: z.string().trim().max(100, { message: 'form.error.too_long' }),
  family_name: z.string().trim().max(100, { message: 'form.error.too_long' }),
  qualification: z.string().trim().max(200, { message: 'form.error.too_long' }),
}

const refineNameFields = (
  val: { is_clinician: boolean; given_name: string; family_name: string; display_name: string },
  ctx: z.RefinementCtx,
): void => {
  if (val.is_clinician) {
    if (!val.given_name) {
      ctx.addIssue({ path: ['given_name'], code: 'custom', message: 'form.error.required' })
    }
    if (!val.family_name) {
      ctx.addIssue({ path: ['family_name'], code: 'custom', message: 'form.error.required' })
    }
  } else if (!val.display_name) {
    ctx.addIssue({ path: ['display_name'], code: 'custom', message: 'form.error.required' })
  }
}

// Edit mode: credentials are not editable here, so no password field.
export const userFormSchema = z.object(userFormShape).superRefine(refineNameFields)
export type UserFormValues = z.infer<typeof userFormSchema>

// Create mode: admin sets the new user's password (required, min 8 — mirrors the
// backend `UserCreate.password` floor).
export const createUserFormSchema = z
  .object({
    ...userFormShape,
    password: z.string().min(8, { message: 'form.error.password_too_short' }),
  })
  .superRefine(refineNameFields)
export type CreateUserFormValues = z.infer<typeof createUserFormSchema>
