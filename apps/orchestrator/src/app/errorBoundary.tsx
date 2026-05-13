import * as React from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/Button'

type State = { error: Error | null }

export class RootErrorBoundary extends React.Component<React.PropsWithChildren, State> {
  override state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  override componentDidCatch(error: Error, info: React.ErrorInfo): void {
    if (import.meta.env.DEV) {
      console.error('Root boundary caught error:', error, info)
    }
  }

  handleReset = (): void => {
    this.setState({ error: null })
  }

  override render(): React.ReactNode {
    if (this.state.error) {
      return <ErrorFallback onReset={this.handleReset} />
    }
    return this.props.children
  }
}

function ErrorFallback({ onReset }: { onReset: () => void }) {
  const { t } = useTranslation('common')
  return (
    <div className="flex min-h-screen items-center justify-center p-6">
      <div className="max-w-md space-y-4 text-center">
        <h1 className="text-xl font-semibold">{t('errorBoundary.title')}</h1>
        <p className="text-muted-foreground">{t('errorBoundary.description')}</p>
        <Button onClick={onReset}>{t('errorBoundary.retry')}</Button>
      </div>
    </div>
  )
}
