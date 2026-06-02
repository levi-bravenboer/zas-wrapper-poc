import type { ConfigContext, ExpoConfig } from 'expo/config'

export default ({ config }: ConfigContext): ExpoConfig => ({
  ...config,
  name: 'Digitale voordeur',
  slug: 'digital-front-door',
  scheme: 'digitale-voordeur',
  version: '1.0.0',
  orientation: 'portrait',
  userInterfaceStyle: 'light',
  // New Architecture is on by default in SDK 52+; no explicit `newArchEnabled` needed.
  platforms: ['ios', 'android', 'web'],
  ios: {
    bundleIdentifier: 'com.reaktor.zas.digitalfrontdoor',
    supportsTablet: true,
    deploymentTarget: '16.4',
  },
  android: {
    package: 'com.reaktor.zas.digitalfrontdoor',
  },
  web: {
    bundler: 'metro',
    output: 'static',
  },
  experiments: {
    typedRoutes: true,
    reactCompiler: true,
  },
  extra: {
    apiBaseUrl: process.env.EXPO_PUBLIC_API_BASE_URL ?? null,
  },
})
