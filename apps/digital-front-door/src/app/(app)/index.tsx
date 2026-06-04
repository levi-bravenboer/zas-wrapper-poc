import { useTranslation } from 'react-i18next'
import { Text, View } from 'react-native'

import { useSession } from '@/modules/auth'

export default function HomeScreen() {
  const { t } = useTranslation()
  const { session } = useSession()

  return (
    <View className="flex-1 items-center justify-center bg-white px-6">
      <Text className="text-2xl font-semibold text-neutral-900">
        {t('app.home.welcome', { name: session?.given_name ?? '' })}
      </Text>
    </View>
  )
}
