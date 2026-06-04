import { useMutation } from '@tanstack/react-query'
import { ShieldAlert } from 'lucide-react'
import { useState, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { api } from '@/lib/api/client'
import { apiError } from '@/lib/api/errors'

const GRANT_HOURS = 2
// the relay applies the grant's tuple within one poll (~2s); retry the
// patient query after a short beat instead of asking the user to refresh
const RETRY_DELAY_MS = 2_500

async function requestBreakGlass(patientId: string, reason: string): Promise<void> {
  const result = await api.POST('/patients/{patient_id}/access-grants', {
    params: { path: { patient_id: patientId } },
    body: { reason, hours: GRANT_HOURS },
  })
  if (!result.response.ok) {
    throw apiError('Break-glass request failed', result.response.status)
  }
}

/**
 * Break-glass affordance (REQ-NON-8): shown when a patient detail answers
 * 404 — the caregiver can request temporary, audited access with a
 * mandatory reason (vervanging / emergency). The grant is time-capped
 * server-side and visible to admins.
 */
export function BreakGlassPrompt({
  patientId,
  onGranted,
}: {
  patientId: string
  onGranted: () => void
}): ReactElement {
  const { t } = useTranslation('patient-profile')
  const [reason, setReason] = useState('')
  const [waiting, setWaiting] = useState(false)
  const request = useMutation({
    mutationFn: () => requestBreakGlass(patientId, reason),
    onSuccess: () => {
      setWaiting(true)
      window.setTimeout(() => {
        onGranted()
      }, RETRY_DELAY_MS)
    },
  })

  return (
    <Card className="mx-auto mt-10 max-w-lg">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <ShieldAlert aria-hidden="true" className="size-5 text-destructive" />
          {t('breakGlass.title')}
        </CardTitle>
        <CardDescription>{t('breakGlass.description')}</CardDescription>
      </CardHeader>
      <CardContent className="flex flex-col gap-4">
        <div className="flex flex-col gap-2">
          <Label htmlFor="break-glass-reason">{t('breakGlass.reasonLabel')}</Label>
          <Textarea
            id="break-glass-reason"
            value={reason}
            onChange={(event) => setReason(event.target.value)}
            placeholder={t('breakGlass.reasonPlaceholder')}
            rows={3}
          />
        </div>
        <Button
          type="button"
          disabled={!reason.trim() || request.isPending || waiting}
          onClick={() => request.mutate()}
        >
          {waiting
            ? t('breakGlass.waiting')
            : request.isPending
              ? t('breakGlass.submitting')
              : t('breakGlass.submit')}
        </Button>
        {request.isError && (
          <p role="alert" className="text-sm text-destructive">
            {t('breakGlass.error')}
          </p>
        )}
        <p className="text-xs text-muted-foreground">{t('breakGlass.auditNote')}</p>
      </CardContent>
    </Card>
  )
}
