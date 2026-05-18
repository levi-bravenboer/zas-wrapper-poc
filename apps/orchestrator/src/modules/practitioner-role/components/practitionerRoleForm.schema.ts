import { z } from 'zod'

import { practitionerRoleCodeSchema } from '../schemas'

export const openRoleFormSchema = z.object({
  practitioner_id: z.string().uuid({ message: 'form.error.required' }),
  organisation_id: z.string().uuid({ message: 'form.error.required' }),
  code: practitionerRoleCodeSchema,
  specialty: z.string().trim().max(255, { message: 'form.error.too_long' }),
  is_primary: z.boolean(),
  period_start: z.string().min(1, { message: 'form.error.required' }),
})
export type OpenRoleFormValues = z.infer<typeof openRoleFormSchema>

export const editRoleFormSchema = z.object({
  code: practitionerRoleCodeSchema,
  specialty: z.string().trim().max(255, { message: 'form.error.too_long' }),
  is_primary: z.boolean(),
})
export type EditRoleFormValues = z.infer<typeof editRoleFormSchema>
