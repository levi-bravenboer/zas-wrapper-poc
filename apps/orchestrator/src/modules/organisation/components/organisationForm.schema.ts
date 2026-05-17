import { z } from 'zod'

export const organisationFormSchema = z.object({
  name: z
    .string()
    .trim()
    .min(1, { message: 'form.error.required' })
    .max(255, { message: 'form.error.too_long' }),
  type_code: z
    .string()
    .trim()
    .min(1, { message: 'form.error.required' })
    .max(64, { message: 'form.error.too_long' }),
  type_display: z.string().trim().max(255, { message: 'form.error.too_long' }),
})

export type OrganisationFormValues = z.infer<typeof organisationFormSchema>
