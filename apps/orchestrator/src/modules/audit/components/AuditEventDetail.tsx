import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import type { AuditEventRead } from '../schemas'

interface AuditEventDetailProps {
  event: AuditEventRead
}

function JsonBlock({ value }: { value: unknown }): ReactElement {
  return (
    <pre className="overflow-auto rounded-md bg-muted p-3 text-xs text-foreground">
      {JSON.stringify(value, null, 2)}
    </pre>
  )
}

/** Expanded-row detail: the raw event payload that the columns don't surface. */
export function AuditEventDetail({ event }: AuditEventDetailProps): ReactElement {
  const { t } = useTranslation('audit-admin-ui')
  const dash = t('detail.none')

  return (
    <div className="grid grid-cols-1 gap-4 p-4 text-sm md:grid-cols-2">
      <div>
        <p className="font-semibold text-foreground">{t('detail.resource')}</p>
        <p className="text-muted-foreground">
          {event.resource_type ?? dash}
          {event.resource_id ? ` · ${event.resource_id}` : ''}
        </p>
      </div>
      <div>
        <p className="font-semibold text-foreground">{t('detail.request_id')}</p>
        <code className="text-xs text-muted-foreground">{event.request_id ?? dash}</code>
      </div>
      <div className="md:col-span-2">
        <p className="mb-1 font-semibold text-foreground">{t('detail.context')}</p>
        {event.context ? (
          <JsonBlock value={event.context} />
        ) : (
          <p className="text-muted-foreground">{dash}</p>
        )}
      </div>
      <div className="md:col-span-2">
        <p className="mb-1 font-semibold text-foreground">{t('detail.changes')}</p>
        {event.changes ? (
          <JsonBlock value={event.changes} />
        ) : (
          <p className="text-muted-foreground">{dash}</p>
        )}
      </div>
    </div>
  )
}
