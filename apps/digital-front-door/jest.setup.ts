// `@testing-library/react-native` v13 ships matchers natively;
// no `@testing-library/jest-native` extend-expect import needed.

// In-memory mock for expo-secure-store.
jest.mock('expo-secure-store', () => {
  const store = new Map<string, string>()
  return {
    getItemAsync: jest.fn(async (key: string) => store.get(key) ?? null),
    setItemAsync: jest.fn(async (key: string, value: string) => {
      store.set(key, value)
    }),
    deleteItemAsync: jest.fn(async (key: string) => {
      store.delete(key)
    }),
  }
})

// Module-level network mock — never hit the real backend.
jest.mock('@/lib/api', () => {
  class ApiError extends Error {
    status: number
    constructor(msg: string, status: number) {
      super(msg)
      this.name = 'ApiError'
      this.status = status
    }
  }
  class UnauthenticatedError extends ApiError {
    constructor() {
      super('Unauthenticated', 401)
      this.name = 'UnauthenticatedError'
    }
  }
  return {
    __esModule: true,
    apiHealthCheck: jest.fn(async () => ({ status: 'ok' })),
    requestAuthed: jest.fn(),
    resolveTenantSlug: jest.fn(() => 'zas'),
    ApiError,
    UnauthenticatedError,
  }
})

// (react-native-localize is not installed at the scaffold; the locale is
// hard-coded to nl-BE per AGENTS.md. Re-add the mock when device locale
// detection lands.)
