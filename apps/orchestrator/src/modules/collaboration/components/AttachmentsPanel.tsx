import { Download, Eye, FileText, FolderOpen, Trash2, UploadCloud } from 'lucide-react'
import { useRef, useState, type DragEvent, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { cn } from '@/lib/style/cn'
import { formatDateTimeOrDash } from '@/lib/utils/datetime'
import { useSession } from '@/modules/auth/hooks'

import { getAttachmentUrl } from '../api'
import { useAttachments, useDeleteAttachment, useUploadAttachment } from '../hooks'
import type { Attachment, OwnerType } from '../types'

import { AttachmentPreviewDialog } from './AttachmentPreviewDialog'

export type AttachmentsPanelProps = {
  ownerType: OwnerType
  ownerId: string
}

/** Document attachments for any owner entity: list + drag-and-drop / click
 *  multi-file upload + download + uploader-only delete. */
export function AttachmentsPanel({ ownerType, ownerId }: AttachmentsPanelProps): ReactElement {
  const { t } = useTranslation(['collaboration'])
  const attachments = useAttachments(ownerType, ownerId)
  const upload = useUploadAttachment(ownerType, ownerId)
  const remove = useDeleteAttachment(ownerType, ownerId)
  const session = useSession()
  const fileRef = useRef<HTMLInputElement>(null)
  const [dragging, setDragging] = useState(false)
  const [preview, setPreview] = useState<{ att: Attachment; url: string } | null>(null)

  async function download(attachmentId: string): Promise<void> {
    const url = await getAttachmentUrl(ownerType, ownerId, attachmentId)
    window.open(url, '_blank', 'noopener')
  }

  async function openPreview(att: Attachment): Promise<void> {
    const url = await getAttachmentUrl(ownerType, ownerId, att.id)
    setPreview({ att, url })
  }

  function uploadFiles(files: FileList | null): void {
    if (!files) return
    for (const file of Array.from(files)) upload.mutate(file)
  }

  function onDrop(e: DragEvent<HTMLButtonElement>): void {
    e.preventDefault()
    setDragging(false)
    uploadFiles(e.dataTransfer.files)
  }

  const items = attachments.data ?? []

  return (
    <>
    <Card>
      <CardHeader>
        <CardTitle className="flex items-center gap-2 text-base">
          <FolderOpen className="size-4 text-foreground-muted" aria-hidden />
          {t('collaboration:attachments.title', { defaultValue: 'Documenten' })}
        </CardTitle>
      </CardHeader>
      <CardContent className="flex flex-col gap-3">
        {items.length > 0 ? (
          <ul className="flex flex-col gap-2">
            {items.map((att) => (
              <li
                key={att.id}
                className="flex items-center gap-3 rounded-lg border border-border/60 p-2.5 transition-colors hover:bg-surface-1"
              >
                <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-surface-2 text-foreground-muted">
                  <FileText className="size-4" />
                </span>
                <div className="flex min-w-0 flex-1 flex-col">
                  <span className="truncate text-sm font-medium text-foreground">
                    {att.filename}
                  </span>
                  <span className="truncate text-[11px] text-foreground-muted">
                    {att.uploader_display_name} · {formatDateTimeOrDash(att.created_at, 'nl')}
                  </span>
                </div>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('collaboration:attachments.preview', { defaultValue: 'Bekijken' })}
                  onClick={() => void openPreview(att)}
                >
                  <Eye className="size-4" />
                </Button>
                <Button
                  variant="ghost"
                  size="icon"
                  aria-label={t('collaboration:attachments.download', { defaultValue: 'Downloaden' })}
                  onClick={() => void download(att.id)}
                >
                  <Download className="size-4" />
                </Button>
                {att.uploaded_by === session.data?.id ? (
                  <Button
                    variant="ghost"
                    size="icon"
                    aria-label={t('collaboration:attachments.delete', { defaultValue: 'Verwijderen' })}
                    disabled={remove.isPending}
                    onClick={() => remove.mutate(att.id)}
                  >
                    <Trash2 className="size-4" />
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        <input
          ref={fileRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            uploadFiles(e.target.files)
            e.target.value = ''
          }}
        />
        <button
          type="button"
          onClick={() => fileRef.current?.click()}
          onDragOver={(e) => {
            e.preventDefault()
            setDragging(true)
          }}
          onDragLeave={() => setDragging(false)}
          onDrop={onDrop}
          disabled={upload.isPending}
          className={cn(
            'flex flex-col items-center justify-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors',
            dragging
              ? 'border-primary bg-primary-soft/40'
              : 'border-border hover:border-primary/50 hover:bg-surface-1',
          )}
        >
          <UploadCloud className="size-6 text-foreground-muted" />
          <span className="text-sm font-medium text-foreground">
            {t('collaboration:attachments.dropTitle', {
              defaultValue: 'Sleep documenten hierheen',
            })}
          </span>
          <span className="text-[11px] text-foreground-muted">
            {t('collaboration:attachments.dropHint', {
              defaultValue: 'of klik om te bladeren · meerdere bestanden mogelijk',
            })}
          </span>
        </button>
      </CardContent>
    </Card>
    <AttachmentPreviewDialog
      attachment={preview?.att ?? null}
      url={preview?.url ?? null}
      onClose={() => setPreview(null)}
    />
    </>
  )
}
