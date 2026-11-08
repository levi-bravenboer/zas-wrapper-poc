import { z } from 'zod'

// Server-side allow-list mirror — kept in sync with
// `app/services/patient/observation/types.py::SUPPORTED_MEASUREMENT_TYPES`.
// Adding a type is a one-line change on both sides.
export const measurementTypeEnum = z.enum(['heart_rate', 'blood_pressure'])

export type MeasurementTypeKey = z.infer<typeof measurementTypeEnum>

// Per-type display + range metadata. Mirrors clinical conventions: ranges
// are the input-bounds sanity check used in EPDs; outside-range is almost
// certainly a typo. The server allow-list is authoritative for code/unit;
// this map only drives the input UX.
export interface SecondaryMeta {
  labelKey: string
  placeholderKey: string
  hintKey: string
  unit: string
  min: number
  max: number
  rangeErrorKey: string
}

export interface MeasurementTypeMeta {
  unit: string
  placeholderKey: string
  hintKey: string
  min: number
  max: number
  rangeErrorKey: string
  /** Composite types declare a secondary component (e.g. diastolic on blood
   *  pressure). When present the dialog shows a second numeric field and
   *  the create payload sends `value_secondary`. */
  secondary?: SecondaryMeta
  /** Override the primary input's UI label when the type is composite —
   *  `Waarde` reads oddly for "systolisch" / "diastolisch". */
  primaryLabelKey?: string
}

export const MEASUREMENT_TYPE_META: Record<MeasurementTypeKey, MeasurementTypeMeta> = {
  heart_rate: {
    unit: '/min',
    placeholderKey: 'addMeasurement.meta.heart_rate.placeholder',
    hintKey: 'addMeasurement.meta.heart_rate.hint',
    min: 20,
    max: 250,
    rangeErrorKey: 'addMeasurement.error.out_of_range_heart_rate',
  },
  blood_pressure: {
    primaryLabelKey: 'addMeasurement.meta.blood_pressure.primaryLabel',
    unit: 'mmHg',
    placeholderKey: 'addMeasurement.meta.blood_pressure.placeholder',
    hintKey: 'addMeasurement.meta.blood_pressure.hint',
    min: 40,
    max: 300,
    rangeErrorKey: 'addMeasurement.error.out_of_range_systolic',
    secondary: {
      labelKey: 'addMeasurement.meta.blood_pressure.secondaryLabel',
      unit: 'mmHg',
      placeholderKey: 'addMeasurement.meta.blood_pressure.secondaryPlaceholder',
      hintKey: 'addMeasurement.meta.blood_pressure.secondaryHint',
      min: 10,
      max: 200,
      rangeErrorKey: 'addMeasurement.error.out_of_range_diastolic',
    },
  },
}

const valueField = z
  .string()
  .trim()
  .min(1, { message: 'form.error.required' })
  .refine((v) => Number.isFinite(Number(v)), { message: 'form.error.not_a_number' })

export const addMeasurementFormSchema = z
  .object({
    measurement_type: measurementTypeEnum,
    // Strings at form level so the numeric fields can stay empty before the
    // user types; coerced to numbers on submit via `Number(...)`.
    value: valueField,
    value_secondary: z.string().trim(),
    // `<input type="datetime-local">` value (`YYYY-MM-DDTHH:mm`, local TZ).
    effective_date_time: z.string().trim().min(1, { message: 'form.error.required' }),
  })
  .superRefine((data, ctx) => {
    const meta = MEASUREMENT_TYPE_META[data.measurement_type]
    const n = Number(data.value)
    if (Number.isFinite(n) && (n < meta.min || n > meta.max)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['value'],
        message: meta.rangeErrorKey,
      })
    }
    if (meta.secondary) {
      if (!data.value_secondary) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value_secondary'],
          message: 'form.error.required',
        })
      } else if (!Number.isFinite(Number(data.value_secondary))) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['value_secondary'],
          message: 'form.error.not_a_number',
        })
      } else {
        const m = Number(data.value_secondary)
        if (m < meta.secondary.min || m > meta.secondary.max) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['value_secondary'],
            message: meta.secondary.rangeErrorKey,
          })
        }
      }
    }
  })

export type AddMeasurementFormValues = z.infer<typeof addMeasurementFormSchema>
