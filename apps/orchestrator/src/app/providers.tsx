import { QueryClientProvider } from '@tanstack/react-query'
import { RouterProvider } from '@tanstack/react-router'
import * as React from 'react'
import { I18nextProvider } from 'react-i18next'

import { Toaster } from '@/components/ui/Toaster'
import { i18n } from '@/lib/i18n'

import { RootErrorBoundary } from './errorBoundary'
import { createQueryClient } from './queryClient'
import { createAppRouter } from './router'

const queryClient = createQueryClient()
const router = createAppRouter()

export function Providers(): React.ReactElement {
  return (
    <I18nextProvider i18n={i18n}>
      <RootErrorBoundary>
        <QueryClientProvider client={queryClient}>
          <RouterProvider router={router} />
          <Toaster />
        </QueryClientProvider>
      </RootErrorBoundary>
    </I18nextProvider>
  )
}
