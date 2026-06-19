import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog'

import type { FileNote } from '../types'

export type FilePreviewDialogProps = {
  /** File note to preview, or `null` when the dialog is closed. */
  note: FileNote | null
  /** Presigned GET url for the file, or `null` while loading/closed. */
  url: string | null
  onClose: () => void
}

function PreviewBody({ note, url }: { note: FileNote; url: string }): ReactElement {
  const { t } = useTranslation(['collaboration'])

  if (note.content_type.startsWith('image/')) {
    return (
      <img
        src={url}
        alt={note.filename}
        className="mx-auto block max-h-[70vh] max-w-full rounded-md object-contain"
      />
    )
  }
  if (note.content_type === 'application/pdf') {
    return (
      <iframe
        src={url}
        title={note.filename}
        className="h-[70vh] w-full rounded-md border border-border"
      />
    )
  }
  return (
    <div className="flex flex-col items-center gap-3 py-10 text-center">
      <p className="text-sm text-foreground-muted">
        {t('collaboration:files.noPreview')}
      </p>
      <Button asChild variant="outline" size="sm">
        <a href={url} target="_blank" rel="noopener noreferrer">
          {t('collaboration:files.download')}
        </a>
      </Button>
    </div>
  )
}

/** Modal preview of a file note: inline image / PDF, or a download fallback for
 *  other types. */
export function FilePreviewDialog({ note, url, onClose }: FilePreviewDialogProps): ReactElement {
  return (
    <Dialog
      open={note !== null && url !== null}
      onOpenChange={(next) => {
        if (!next) onClose()
      }}
    >
      <DialogContent className="max-h-[90vh] max-w-4xl overflow-auto">
        <DialogHeader>
          <DialogTitle className="truncate pr-6">{note?.filename}</DialogTitle>
        </DialogHeader>
        {note && url ? <PreviewBody note={note} url={url} /> : null}
      </DialogContent>
    </Dialog>
  )
}
