import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'

import { Toaster } from '@/components/ui/Toaster'
import { TooltipProvider } from '@/components/ui/Tooltip'
import { i18n } from '@/lib/i18n'

import { RootErrorBoundary } from './errorBoundary'
import { queryClient } from './queryClient'
import { router } from './router'

export function Providers(): React.ReactElement {
  return (
    <I18nextProvider i18n={i18n}>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <TooltipProvider delayDuration={200} skipDelayDuration={100}>
            <RouterProvider router={router} />
            <Toaster />
          </TooltipProvider>
        </QueryClientProvider>
      </RootErrorBoundary>
    </I18nextProvider>
  )
}
