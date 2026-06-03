import '@/styles/global.css'

import { QueryClientProvider } from '@tanstack/react-query'
import { Stack } from 'expo-router'
import * as SplashScreen from 'expo-splash-screen'
import { StatusBar } from 'expo-status-bar'
import { useEffect, useState } from 'react'
import { ErrorBoundary, type FallbackProps } from 'react-error-boundary'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'
import { KeyboardProvider } from 'react-native-keyboard-controller'
import { SafeAreaProvider } from 'react-native-safe-area-context'

import { apiHealthCheck } from '@/lib/api'
import { initI18n } from '@/lib/i18n'
import { log } from '@/lib/logger'
import { queryClient } from '@/lib/query-client'
import { JotaiProvider } from '@/providers/jotai'

SplashScreen.preventAutoHideAsync().catch((err: unknown) => {
  log.warn('[splash] preventAutoHide failed', err)
})

function RootErrorFallback(_: FallbackProps) {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-base font-semibold text-red-700">
        {t('app.error.title')}
      </Text>
      <Text className="mt-2 text-sm text-neutral-600">
        {t('app.error.body')}
      </Text>
    </View>
  )
}

function onRootError(
  error: Error,
  info: { componentStack?: string | null }
): void {
  log.error('[root] uncaught', error, info.componentStack)
}

export default function RootLayout() {
  const [ready, setReady] = useState(false)

  useEffect(() => {
    void (async () => {
      try {
        await initI18n()
      } catch (err) {
        log.error('[i18n] init failed', err)
      } finally {
        setReady(true)
        await SplashScreen.hideAsync().catch((err: unknown) => {
          log.warn('[splash] hide failed', err)
        })
        void apiHealthCheck().catch((err: unknown) => {
          log.warn('[api] health check failed', err)
        })
      }
    })()
  }, [])

  if (!ready) return null

  return (
    <ErrorBoundary FallbackComponent={RootErrorFallback} onError={onRootError}>
      <SafeAreaProvider>
        <KeyboardProvider>
          <QueryClientProvider client={queryClient}>
            <JotaiProvider>
              <StatusBar style="dark" />
              <Stack screenOptions={{ headerShown: false }} />
            </JotaiProvider>
          </QueryClientProvider>
        </KeyboardProvider>
      </SafeAreaProvider>
    </ErrorBoundary>
  )
}
