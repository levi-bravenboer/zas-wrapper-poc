import { Download, Eye, FileText, FolderOpen, Trash2, UploadCloud } from 'lucide-react'
import { type DragEvent, type ReactElement, useRef, useState } from 'react'
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
            <span className="grid size-7 place-items-center rounded-md bg-primary-soft/60 text-primary">
              <FolderOpen className="size-4" aria-hidden />
            </span>
            {t('collaboration:attachments.title', { defaultValue: 'Documenten' })}
            {items.length > 0 ? (
              <span className="ml-auto rounded-full bg-surface-2 px-2 py-0.5 text-xs font-medium text-foreground-muted tabular-nums">
                {items.length}
              </span>
            ) : null}
          </CardTitle>
        </CardHeader>
        <CardContent className="flex flex-col gap-3">
          {items.length > 0 ? (
            <ul className="flex flex-col gap-1.5">
              {items.map((att) => (
                <li
                  key={att.id}
                  className="group flex items-center gap-3 rounded-lg border border-transparent p-2 transition-colors hover:border-border/60 hover:bg-surface-1"
                >
                  <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-primary-soft/50 text-primary">
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
                  <div className="flex shrink-0 items-center opacity-0 transition-opacity focus-within:opacity-100 group-hover:opacity-100">
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t('collaboration:attachments.preview', {
                        defaultValue: 'Bekijken',
                      })}
                      onClick={() => void openPreview(att)}
                    >
                      <Eye className="size-4" />
                    </Button>
                    <Button
                      variant="ghost"
                      size="icon"
                      className="size-8"
                      aria-label={t('collaboration:attachments.download', {
                        defaultValue: 'Downloaden',
                      })}
                      onClick={() => void download(att.id)}
                    >
                      <Download className="size-4" />
                    </Button>
                    {att.uploaded_by === session.data?.id ? (
                      <Button
                        variant="ghost"
                        size="icon"
                        className="size-8 text-destructive hover:text-destructive"
                        aria-label={t('collaboration:attachments.delete', {
                          defaultValue: 'Verwijderen',
                        })}
                        disabled={remove.isPending}
                        onClick={() => remove.mutate(att.id)}
                      >
                        <Trash2 className="size-4" />
                      </Button>
                    ) : null}
                  </div>
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
              'flex flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed text-center transition-colors',
              items.length > 0 ? 'px-4 py-3.5' : 'px-4 py-8',
              dragging
                ? 'border-primary bg-primary-soft/40'
                : 'border-border hover:border-primary/50 hover:bg-surface-1',
            )}
          >
            <UploadCloud
              className={cn('text-foreground-muted', items.length > 0 ? 'size-5' : 'size-6')}
            />
            <span className="text-sm font-medium text-foreground">
              {t('collaboration:attachments.dropTitle', {
                defaultValue: 'Sleep documenten hierheen',
              })}
            </span>
            {items.length === 0 ? (
              <span className="text-[11px] text-foreground-muted">
                {t('collaboration:attachments.dropHint', {
                  defaultValue: 'of klik om te bladeren · meerdere bestanden mogelijk',
                })}
              </span>
            ) : null}
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
