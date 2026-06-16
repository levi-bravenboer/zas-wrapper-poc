import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import type { Attachment } from '../types'

export type AttachmentPreviewDialogProps = {
  /** Attachment to preview, or `null` when the dialog is closed. */
  attachment: Attachment | null
  /** Presigned GET url for the attachment, or `null` while loading/closed. */
  url: string | null
  onClose: () => void
}

function PreviewBody({
  attachment,
  url,
}: {
  attachment: Attachment
  url: string
}): ReactElement {
  const { t } = useTranslation(['collaboration'])

  if (attachment.content_type.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={attachment.filename}
        className="mx-auto block max-h-[70vh] max-w-full rounded-md object-contain"
      />
    )
  }
  if (attachment.content_type === 'application/pdf') {
    return (
      <iframe
        src={url}
        title={attachment.filename}
        className="h-[70vh] w-full rounded-md border border-border"
      />
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-foreground-muted">
        {t('collaboration:attachments.noPreview', {
          defaultValue: 'Geen voorbeeld beschikbaar voor dit bestandstype.',
        })}
      </p>
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {t('collaboration:attachments.download', { defaultValue: 'Downloaden' })}
        </a>
      </Button>
    </div>
  )
}

/** Modal preview of an attachment: inline image / PDF, or a download fallback
 *  for other types. */
export function AttachmentPreviewDialog({
  attachment,
  url,
  onClose,
}: AttachmentPreviewDialogProps): ReactElement {
  return (
    <Dialog
      open={attachment !== null && url !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{attachment?.filename}</DialogTitle>
        </DialogHeader>
        {attachment && url ? <PreviewBody attachment={attachment} url={url} /> : null}
      </DialogContent>
    </Dialog>
  )
}
