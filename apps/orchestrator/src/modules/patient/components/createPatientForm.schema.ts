import { z } from 'zod'

import { patientFormSchema } from './patientForm.schema'

/**
 * Create-patient form schema. `primary_organisation_id` is required only when
 * the dialog shows an organisation selector (cross-org holders, or non-holders
 * with more than one own org); single-own-org callers omit it and the server
 * resolves their organisation.
 */
export function createPatientFormSchema(requireOrg: boolean) {
  return patientFormSchema.extend({
    primary_organisation_id: requireOrg
      ? z.string().min(1, { message: 'form.error.required' })
      : z.string(),
  })
}

export type CreatePatientFormValues = z.infer<ReturnType<typeof createPatientFormSchema>>
