import { Link } from '@tanstack/react-router'
import { AlertCircle } from 'lucide-react'
import { type ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'

import type { ReadOnlyVariant } from '../hooks/useResolvedVersion'
import type {
  PathwayBare,
  PathwayBlockType,
  PathwayEdgeOffsetDirection,
  PathwayEdgeTimingKind,
  PathwayPhaseTemplate,
  PathwayVersionDefinition,
} from '../types'

import { PathwayBuilderShell } from './PathwayBuilderShell'

type LoadingProps = { state: 'loading' }
type NotFoundProps = { state: 'not-found' }
type ErrorProps = { state: 'error'; error: Error; onRetry: () => void }
type ReadyProps = {
  state: 'ready'
  pathway: PathwayBare
  version: PathwayVersionDefinition
  isReadOnly: boolean
  readOnlyVariant: ReadOnlyVariant | null
  catalogue: PathwayBlockType[]
  phaseTemplates: PathwayPhaseTemplate[]
  timingKinds: PathwayEdgeTimingKind[]
  offsetDirections: PathwayEdgeOffsetDirection[]
}

type Props = LoadingProps | NotFoundProps | ErrorProps | ReadyProps

export function BuilderShellStateRenderer(props: Props): ReactElement {
  const { t } = useTranslation('pathway')

  if (props.state === 'loading') {
    return (
      <div className="grid h-[100dvh] place-items-center text-muted-foreground">
        <p className="text-sm">{t('loading')}</p>
      </div>
    )
  }

  if (props.state === 'not-found') {
    return (
      <CenteredCard
        title={t('notFound.title')}
        body={t('notFound.body')}
        actions={
          <Button asChild>
            <Link to="/pathways">{t('notFound.back')}</Link>
          </Button>
        }
      />
    )
  }

  if (props.state === 'error') {
    return (
      <CenteredCard
        title={t('error.title')}
        body={t('error.body')}
        actions={
          <>
            <Button type="button" variant="ghost" asChild>
              <Link to="/pathways">{t('error.back')}</Link>
            </Button>
            <Button type="button" onClick={props.onRetry}>
              {t('error.retry')}
            </Button>
          </>
        }
      />
    )
  }

  return (
    <PathwayBuilderShell
      pathway={props.pathway}
      version={props.version}
      isReadOnly={props.isReadOnly}
      readOnlyVariant={props.readOnlyVariant}
      catalogue={props.catalogue}
      phaseTemplates={props.phaseTemplates}
      timingKinds={props.timingKinds}
      offsetDirections={props.offsetDirections}
    />
  )
}

function CenteredCard({
  title,
  body,
  actions,
}: {
  title: string
  body: string
  actions: ReactElement
}): ReactElement {
  return (
    <div className="grid h-[100dvh] place-items-center px-6">
      <div
        role="alert"
        className="flex max-w-md flex-col items-center gap-3 rounded-xl border bg-white/80 px-6 py-6 text-center shadow-sm"
      >
        <AlertCircle className="size-6 text-destructive" strokeWidth={1.8} />
        <h1 className="text-base font-semibold text-foreground">{title}</h1>
        <p className="text-sm text-muted-foreground">{body}</p>
        <div className="mt-2 flex items-center gap-2">{actions}</div>
      </div>
    </div>
  )
}
