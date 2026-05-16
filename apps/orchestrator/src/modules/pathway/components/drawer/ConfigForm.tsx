import Form, { type IChangeEvent } from '@rjsf/core'
import type { RJSFSchema } from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import { type ReactElement } from 'react'

type Props = {
  schema: RJSFSchema
  formData: Record<string, unknown>
  onChange: (next: Record<string, unknown>) => void
}

export function ConfigForm({ schema, formData, onChange }: Props): ReactElement {
  return (
    <Form
      schema={schema}
      formData={formData}
      validator={validator}
      onChange={(event: IChangeEvent) =>
        onChange((event.formData ?? {}) as Record<string, unknown>)
      }
      uiSchema={{ 'ui:submitButtonOptions': { norender: true } }}
      tagName="div"
      liveValidate={false}
      className="rjsf-builder"
    />
  )
}
