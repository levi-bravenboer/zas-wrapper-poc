import { toast as sonner } from 'sonner'

export type ToastErrorOptions = {
  description?: string
  retryLabel?: string
  onRetry?: () => void
}

// Sonner wrapper that pairs an error toast with an optional retry action.
// FHIR error-code → i18n mapping lands at the call site; this helper stays
// presentational.
export function toastError(title: string, options: ToastErrorOptions = {}): void {
  const { description, retryLabel, onRetry } = options
  sonner.error(title, {
    description,
    action:
      retryLabel && onRetry
        ? {
            label: retryLabel,
            onClick: onRetry,
          }
        : undefined,
  })
}

export { sonner as toast }
