import { z } from 'zod'

// Server-side allow-list mirror — kept in sync with
// `app/services/patient/observation/types.py::SUPPORTED_MEASUREMENT_TYPES`.
// Adding a type is a one-line change on both sides.
export const measurementTypeEnum = z.enum(['heart_rate'])

export const addMeasurementFormSchema = z.object({
  measurement_type: measurementTypeEnum,
  // String at form level so the numeric field can stay empty before the user
  // types; coerced to a number on submit via `Number(...)`.
  value: z
    .string()
    .trim()
    .min(1, { message: 'form.error.required' })
    .refine((v) => Number.isFinite(Number(v)), { message: 'form.error.not_a_number' }),
  // `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`, local TZ).
  effective_date_time: z.string().trim().min(1, { message: 'form.error.required' }),
})

export type AddMeasurementFormValues = z.infer<typeof addMeasurementFormSchema>
