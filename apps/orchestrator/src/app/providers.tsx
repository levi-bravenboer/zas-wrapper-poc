import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'

import { Toaster } from '@/components/ui/toaster'
import { TooltipProvider } from '@/components/ui/tooltip'
import { i18n } from '@/lib/i18n'
import { RealtimeInvalidationProvider } from '@/providers/realtime-invalidation'

import { RootErrorBoundary } from './errorBoundary'
import { queryClient } from './queryClient'
import { router } from './router'

export function Providers(): React.ReactElement {
  return (
    <I18nextProvider i18n={i18n}>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RealtimeInvalidationProvider>
            <TooltipProvider delayDuration={200} skipDelayDuration={100}>
              <RouterProvider router={router} />
              <Toaster />
            </TooltipProvider>
          </RealtimeInvalidationProvider>
        </QueryClientProvider>
      </RootErrorBoundary>
    </I18nextProvider>
  )
}
