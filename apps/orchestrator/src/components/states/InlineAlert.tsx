import { AlertTriangle } from 'lucide-react'
import { type ReactElement, type ReactNode } from 'react'

import { Alert, AlertDescription, AlertTitle } from '@/components/ui/alert'
import { cn } from '@/lib/style/cn'

export type InlineAlertProps = {
  title: ReactNode
  body?: ReactNode
  retry?: ReactNode
  className?: string
}

export function InlineAlert({ title, body, retry, className }: InlineAlertProps): ReactElement {
  return (
    <Alert variant="destructive" data-slot="inline-alert" className={cn(className)}>
      <AlertTriangle aria-hidden="true" />
      <AlertTitle>{title}</AlertTitle>
      {body && <AlertDescription>{body}</AlertDescription>}
      {retry && <div className="col-start-2 mt-2">{retry}</div>}
    </Alert>
  )
}
