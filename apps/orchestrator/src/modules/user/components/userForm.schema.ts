import { z } from 'zod'

// Flat shape keeps TanStack Form field paths simple. `role_id` is the RBAC role
// to bind (decoupled from identity-type). `is_clinician` drives the practitioner
// branch, mirroring the backend `UserCreate` discrimination on clinical fields:
//   clinician → given_name + family_name required; display_name derived
//     server-side; a Practitioner row is written atomically (§1.2).
//   non-clinician → display_name required.
// Messages are i18n KEYS (`form.error.*`) resolved at render via t().
export const userFormSchema = z
  .object({
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
  })
  .superRefine((val, ctx) => {
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
  })
export type UserFormValues = z.infer<typeof userFormSchema>
