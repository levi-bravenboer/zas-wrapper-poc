import { Link } from 'expo-router'
import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

export default function NotFoundScreen() {
  const { t } = useTranslation()
  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-base text-neutral-700">
        {t('app.placeholder.errorTitle')}
      </Text>
      <Link href="/" className="text-primary mt-4 underline">
        {t('app.placeholder.welcome')}
      </Link>
    </View>
  )
}
