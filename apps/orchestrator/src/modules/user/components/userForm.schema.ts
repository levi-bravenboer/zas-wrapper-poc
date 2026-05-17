import { z } from 'zod'

import { roleSchema } from '../schemas'

// Flat shape keeps TanStack Form field paths simple. Role-dependent requireds
// enforced via superRefine:
//   admin → display_name required; given/family/qualification ignored server-side.
//   caregiver → given_name + family_name required; user.display_name is derived
//     server-side as `${given} ${family}`; Practitioner row written atomically
//     (see §1.2 UserService.create).
// Messages are i18n KEYS (`form.error.*`) resolved at render via t() so the
// schema stays presentation-agnostic.
export const userFormSchema = z
  .object({
    email: z
      .string()
      .min(1, { message: 'form.error.required' })
      .email({ message: 'form.error.email_invalid' })
      .max(256, { message: 'form.error.too_long' }),
    role: roleSchema,
    display_name: z.string().trim().max(200, { message: 'form.error.too_long' }),
    given_name: z.string().trim().max(100, { message: 'form.error.too_long' }),
    family_name: z.string().trim().max(100, { message: 'form.error.too_long' }),
    qualification: z.string().trim().max(200, { message: 'form.error.too_long' }),
  })
  .superRefine((val, ctx) => {
    if (val.role === 'admin') {
      if (!val.display_name) {
        ctx.addIssue({ path: ['display_name'], code: 'custom', message: 'form.error.required' })
      }
    } else {
      if (!val.given_name) {
        ctx.addIssue({ path: ['given_name'], code: 'custom', message: 'form.error.required' })
      }
      if (!val.family_name) {
        ctx.addIssue({ path: ['family_name'], code: 'custom', message: 'form.error.required' })
      }
    }
  })
export type UserFormValues = z.infer<typeof userFormSchema>
