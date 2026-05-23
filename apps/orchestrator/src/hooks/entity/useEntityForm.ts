import {
  useForm,
  useStore,
  type ReactFormExtendedApi,
  type StandardSchemaV1,
} from '@tanstack/react-form'
import { useCallback } from 'react'

export type EntityFormSchema<TValues> = StandardSchemaV1<TValues, TValues>

export type UseEntityFormOptions<TValues> = {
  schema: EntityFormSchema<TValues>
  defaultValues: TValues
  onSubmit: (values: TValues) => Promise<void> | void
  onSuccess?: (values: TValues) => void
}

type EntityFormApi<TValues> = ReactFormExtendedApi<
  TValues,
  undefined,
  undefined,
  undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  undefined,
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  any,
  undefined,
  undefined,
  undefined,
  undefined,
  never
>

export type UseEntityFormResult<TValues> = {
  form: EntityFormApi<TValues>
  isDirty: boolean
  isSubmitting: boolean
  submit: () => Promise<void>
  reset: () => void
}

export function useEntityForm<TValues>({
  schema,
  defaultValues,
  onSubmit,
  onSuccess,
}: UseEntityFormOptions<TValues>): UseEntityFormResult<TValues> {
  const form = useForm({
    defaultValues,
    validators: {
      onBlur: schema,
      onSubmit: schema,
    },
    onSubmit: async ({ value }) => {
      try {
        await onSubmit(value)
      } catch {
        return
      }
      onSuccess?.(value)
    },
  }) as EntityFormApi<TValues>

  const isDirty = useStore(form.store, (state) => state.isDirty)
  const isSubmitting = useStore(form.store, (state) => state.isSubmitting)

  const submit = useCallback(async () => {
    await form.handleSubmit()
  }, [form])

  const reset = useCallback(() => {
    form.reset()
  }, [form])

  return { form, isDirty, isSubmitting, submit, reset }
}
