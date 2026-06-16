import { Paperclip, Trash2 } from 'lucide-react'
import { useRef, type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { useSession } from '@/modules/auth/hooks'

import { getAttachmentUrl } from '../api'
import { useAttachments, useDeleteAttachment, useUploadAttachment } from '../hooks'
import type { OwnerType } from '../types'

export type AttachmentsPanelProps = {
  ownerType: OwnerType
  ownerId: string
}

/** Document attachments for any owner entity: list + presigned upload +
 *  download + uploader-only delete. */
export function AttachmentsPanel({ ownerType, ownerId }: AttachmentsPanelProps): ReactElement {
  const { t } = useTranslation(['collaboration'])
  const attachments = useAttachments(ownerType, ownerId)
  const upload = useUploadAttachment(ownerType, ownerId)
  const remove = useDeleteAttachment(ownerType, ownerId)
  const session = useSession()
  const fileRef = useRef<HTMLInputElement>(null)

  async function download(attachmentId: string): Promise<void> {
    const url = await getAttachmentUrl(ownerType, ownerId, attachmentId)
    window.open(url, '_blank', 'noopener')
  }

  return (
    <section className="flex flex-col gap-3">
      <h3 className="text-sm font-semibold text-foreground">
        {t('collaboration:attachments.title', { defaultValue: 'Documenten' })}
      </h3>
      <ul className="flex flex-col gap-2">
        {(attachments.data ?? []).map((att) => (
          <li
            key={att.id}
            className="flex items-center justify-between gap-2 rounded-md border border-border/60 p-2 text-sm"
          >
            <button
              type="button"
              className="flex min-w-0 items-center gap-2 text-left hover:underline"
              onClick={() => void download(att.id)}
            >
              <Paperclip className="size-4 shrink-0 text-foreground-muted" />
              <span className="truncate">{att.filename}</span>
            </button>
            <div className="flex shrink-0 items-center gap-2 text-xs text-foreground-muted">
              <span>{att.uploader_display_name}</span>
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
            </div>
          </li>
        ))}
        {attachments.data?.length === 0 ? (
          <li className="text-sm text-foreground-muted">
            {t('collaboration:attachments.empty', { defaultValue: 'Nog geen documenten.' })}
          </li>
        ) : null}
      </ul>
      <div>
        <input
          ref={fileRef}
          type="file"
          className="hidden"
          onChange={(e) => {
            const file = e.target.files?.[0]
            if (file) upload.mutate(file)
            e.target.value = ''
          }}
        />
        <Button
          variant="outline"
          size="sm"
          disabled={upload.isPending}
          onClick={() => fileRef.current?.click()}
        >
          {t('collaboration:attachments.upload', { defaultValue: 'Document uploaden' })}
        </Button>
      </div>
    </section>
  )
}
