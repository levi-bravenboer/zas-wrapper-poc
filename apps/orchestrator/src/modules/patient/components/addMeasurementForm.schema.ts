import { z } from 'zod'

// Server-side allow-list mirror — kept in sync with
// `app/services/patient/observation/types.py::SUPPORTED_MEASUREMENT_TYPES`.
// Adding a type is a one-line change on both sides.
export const measurementTypeEnum = z.enum(['heart_rate'])

export type MeasurementTypeKey = z.infer<typeof measurementTypeEnum>

// Per-type display + range metadata. Mirrors clinical conventions:
// hartfrequentie 20–250/min is the input-bounds sanity check used in EPDs;
// outside that range is almost certainly a typo. The server-side allow-list
// is authoritative for `code` / `code_system` / `unit`; this map only drives
// the input UX (placeholder, suffix, hint, range check).
export interface MeasurementTypeMeta {
  unit: string
  placeholder: string
  hint: string
  min: number
  max: number
  rangeErrorKey: string
}

export const MEASUREMENT_TYPE_META: Record<MeasurementTypeKey, MeasurementTypeMeta> = {
  heart_rate: {
    unit: '/min',
    placeholder: 'bv. 72',
    hint: 'Normaal in rust: 60–100/min',
    min: 20,
    max: 250,
    rangeErrorKey: 'addMeasurement.error.out_of_range_heart_rate',
  },
}

export const addMeasurementFormSchema = z
  .object({
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
  .superRefine((data, ctx) => {
    const meta = MEASUREMENT_TYPE_META[data.measurement_type]
    const n = Number(data.value)
    if (!Number.isFinite(n)) return
    if (n < meta.min || n > meta.max) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: meta.rangeErrorKey,
      })
    }
  })

export type AddMeasurementFormValues = z.infer<typeof addMeasurementFormSchema>
