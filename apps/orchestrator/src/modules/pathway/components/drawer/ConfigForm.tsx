import Form, { type IChangeEvent } from '@rjsf/core'
import type { RJSFSchema } from '@rjsf/utils'
import validator from '@rjsf/validator-ajv8'
import { type ReactElement } from 'react'

import type { BlockConfig } from '../../types'

type Props = {
  schema: RJSFSchema
  formData: BlockConfig
  onChange: (next: BlockConfig) => void
}

export function ConfigForm({ schema, formData, onChange }: Props): ReactElement {
  return (
    <Form
      schema={schema}
      formData={formData}
      validator={validator}
      onChange={(event: IChangeEvent<BlockConfig>) => onChange(event.formData ?? {})}
      uiSchema={{ 'ui:submitButtonOptions': { norender: true } }}
      tagName="div"
      liveValidate={false}
      className="rjsf-builder"
    />
  )
}
