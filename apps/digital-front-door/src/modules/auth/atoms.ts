import { atom } from 'jotai'

import type { PatientSession } from './types'

/**
 * Hot cache of the current patient session. The source of truth is the
 * TanStack Query cache (hydrated from the cookie via `GET /mobile/auth/me`).
 * This atom is a convenience mirror for non-React contexts.
 */
export const currentSessionAtom = atom<PatientSession | null>(null)
