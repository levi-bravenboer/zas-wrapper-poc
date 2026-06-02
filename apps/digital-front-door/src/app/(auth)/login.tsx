import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

export default function LoginScreen() {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-semibold text-neutral-900">
        {t('app.placeholder.welcome')}
      </Text>
    </View>
  )
}
