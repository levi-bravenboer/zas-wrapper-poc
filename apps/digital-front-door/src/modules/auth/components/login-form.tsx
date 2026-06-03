import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Pressable, Text, TextInput, View } from 'react-native'

import { resolveTenantSlug,UnauthenticatedError } from '@/lib/api'
import { useLogin } from '@/modules/auth/hooks/use-login'

export function LoginForm() {
  const { t } = useTranslation('auth')
  const { login, isLoading, error } = useLogin()

  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')

  function handleSubmit() {
    login({
      tenant: resolveTenantSlug(),
      email: email.trim(),
      password,
    })
  }

  function errorMessage(): string | null {
    if (!error) return null
    if (error instanceof UnauthenticatedError)
      return t('errors.invalidCredentials')
    if (error.message.includes('Unknown tenant'))
      return t('errors.unknownTenant')
    return t('errors.network')
  }

  const displayError = errorMessage()

  return (
    <View className="w-full max-w-sm gap-4">
      {displayError && (
        <View
          accessibilityRole="alert"
          className="rounded-lg bg-red-50 px-4 py-3"
        >
          <Text className="text-sm text-red-700">{displayError}</Text>
        </View>
      )}

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-neutral-700">
          {t('form.email')}
        </Text>
        <TextInput
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900"
          value={email}
          onChangeText={setEmail}
          autoCapitalize="none"
          autoComplete="email"
          textContentType="username"
          keyboardType="email-address"
          editable={!isLoading}
        />
      </View>

      <View className="gap-1.5">
        <Text className="text-sm font-medium text-neutral-700">
          {t('form.password')}
        </Text>
        <TextInput
          className="rounded-lg border border-neutral-300 bg-white px-3 py-2.5 text-base text-neutral-900"
          value={password}
          onChangeText={setPassword}
          secureTextEntry
          autoComplete="password"
          textContentType="password"
          editable={!isLoading}
        />
      </View>

      <Pressable
        className="mt-2 items-center rounded-lg bg-neutral-900 py-3"
        onPress={handleSubmit}
        disabled={isLoading || !email.trim() || !password}
      >
        <Text className="text-base font-semibold text-white">
          {isLoading ? t('form.submitting') : t('form.submit')}
        </Text>
      </Pressable>
    </View>
  )
}
