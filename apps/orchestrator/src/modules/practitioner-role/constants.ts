import type { PractitionerRoleCode } from './schemas'

export const ROLE_CODES: ReadonlyArray<PractitionerRoleCode> = [
  'gp',
  'physiotherapist',
  'psychologist',
  'nurse',
  'physician',
  'other',
]

// Fixed specialty vocabulary — mirrors the backend `SpecialtyCode` enum
// (apps/backend/app/core/enums/specialty.py). Keep in sync. Used by the
// affiliation (PractitionerRole) form; the pathway enroll picker matches on
// these codes.
export const SPECIALTY_CODES = [
  'urologie',
  'huisartsgeneeskunde',
  'radiologie',
  'pathologie',
  'oncologie',
  'cardiologie',
] as const

export type SpecialtyCode = (typeof SPECIALTY_CODES)[number]
