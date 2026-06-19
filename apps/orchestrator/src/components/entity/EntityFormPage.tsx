import { Link, type LinkProps } from '@tanstack/react-router'
import { ArrowLeft } from 'lucide-react'
import type { ReactElement, ReactNode } from 'react'
import { useTranslation } from 'react-i18next'

import { PageHeader } from '@/components/layout/PageHeader'
import { Button } from '@/components/ui/button'
import type { UseEntityFormResult } from '@/hooks/entity'

/**
 * Generic chrome for entity create / edit surfaces — header (title, subtitle,
 * optional back link) + body slot + sticky footer with Cancel + Save.
 *
 * Owns no data. The consumer drives the form via `useEntityForm` and passes
 * the resulting `form` instance plus rendered fields in `body`. Save calls
 * `form.handleSubmit()` so TanStack Form's validators always run.
 */
export type EntityFormPageProps<TValues> = {
  mode: 'create' | 'edit'
  title: ReactNode
  subtitle?: ReactNode
  back?: LinkProps
  form: UseEntityFormResult<TValues>
  onCancel: () => void
  submitLabel?: ReactNode
  body: ReactNode
}

export function EntityFormPage<TValues>({
  title,
  subtitle,
  back,
  form,
  onCancel,
  submitLabel,
  body,
}: EntityFormPageProps<TValues>): ReactElement {
  const { t } = useTranslation('entity-page')

  const eyebrow = back ? (
    <Link
      {...back}
      className="inline-flex items-center gap-1 text-xs font-medium text-muted-foreground hover:text-foreground"
    >
      <ArrowLeft className="size-3" />
      {t('actions.back')}
    </Link>
  ) : undefined

  return (
    <form
      className="flex h-full min-h-0 flex-col"
      onSubmit={(event) => {
        event.preventDefault()
        void form.form.handleSubmit()
      }}
      noValidate
    >
      <PageHeader eyebrow={eyebrow} title={title} sub={subtitle} />
      <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-y-auto px-6 pb-24">{body}</div>
      <div
        className="sticky bottom-0 z-10 flex justify-end gap-2 border-t bg-background/95 px-6 py-3 backdrop-blur"
        data-slot="entity-form-footer"
      >
        <Button type="button" variant="ghost" onClick={onCancel} disabled={form.isSubmitting}>
          {t('actions.cancel')}
        </Button>
        <Button type="submit" disabled={form.isSubmitting}>
          {submitLabel ?? t('actions.save')}
        </Button>
      </div>
    </form>
  )
}
