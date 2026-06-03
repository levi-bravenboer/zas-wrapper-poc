import * as SecureStore from 'expo-secure-store'
import { Platform } from 'react-native'

// Web caveat: expo-secure-store has no web implementation. We fall back to
// localStorage, which is weaker (no OS-level encryption, accessible via JS in
// the same origin). Web is a dev convenience only; if web ever ships, this
// seam needs a stronger story (HTTP-only cookie session).

type AsyncString = Promise<string | null>

export const secureStorage = {
  async get(key: string): AsyncString {
    if (Platform.OS === 'web') {
      return globalThis.localStorage?.getItem(key) ?? null
    }
    return SecureStore.getItemAsync(key)
  },
  async set(key: string, value: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.setItem(key, value)
      return
    }
    await SecureStore.setItemAsync(key, value)
  },
  async remove(key: string): Promise<void> {
    if (Platform.OS === 'web') {
      globalThis.localStorage?.removeItem(key)
      return
    }
    await SecureStore.deleteItemAsync(key)
  },
}
