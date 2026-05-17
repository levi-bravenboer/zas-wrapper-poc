import { z } from 'zod'

export const patientGenderEnum = z.enum(['male', 'female', 'other', 'unknown'])

export const patientFormSchema = z.object({
  given_name: z
    .string()
    .trim()
    .min(1, { message: 'form.error.required' })
    .max(255, { message: 'form.error.too_long' }),
  family_name: z
    .string()
    .trim()
    .min(1, { message: 'form.error.required' })
    .max(255, { message: 'form.error.too_long' }),
  birth_date: z.string().trim().max(10, { message: 'form.error.too_long' }),
  gender: patientGenderEnum,
})

export type PatientFormValues = z.infer<typeof patientFormSchema>
