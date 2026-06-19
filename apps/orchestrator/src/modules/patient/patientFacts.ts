import type { PatientIdentifierRow } from './types'

/** Pick the patient's INSZ/SSIN value from their identifiers, if present. */
export function pickInsz(identifiers: ReadonlyArray<PatientIdentifierRow>): string | null {
  const match = identifiers.find((id) => {
    if (id.use === 'official') return true
    const system = id.system?.toLowerCase() ?? ''
    return system.includes('ssin') || system.includes('insz') || system.includes('2.16.56')
  })
  return match?.value ?? null
}

/** Whole years since the birth date (null when unknown). */
export function ageFromBirthDate(iso: string | null | undefined): number | null {
  if (!iso) return null
  const birth = new Date(iso)
  const now = new Date()
  let age = now.getFullYear() - birth.getFullYear()
  const monthDelta = now.getMonth() - birth.getMonth()
  if (monthDelta < 0 || (monthDelta === 0 && now.getDate() < birth.getDate())) age -= 1
  return age
}
