import type { LusciiProgramData, LusciiProgramMode } from './types'

// Lookup table for user-facing mode labels — replaces a brittle ternary
// chain so adding a future mode is a single-line entry. Typed against
// LusciiProgramMode so TS forces exhaustive coverage when the enum grows.
const MODE_LABELS = {
  blocking: 'Blocking',
  fire_and_forget: 'Fire-and-forget',
} as const satisfies Record<LusciiProgramMode, string>

function isLusciiProgramMode(value: unknown): value is LusciiProgramMode {
  return value === 'blocking' || value === 'fire_and_forget'
}

/** Build the inspector's sub-line ("Standaard 12 weken · Blocking · v4.2"). */
export function buildSubLine(
  program: LusciiProgramData | null,
  protocolId: string | null,
  mode: string | null,
): string | null {
  if (!program) return null
  const protocol = protocolId ? program.protocols.find((p) => p.id === protocolId) : null
  const parts: string[] = []
  if (protocol) parts.push(protocol.name)
  if (isLusciiProgramMode(mode)) parts.push(MODE_LABELS[mode])
  parts.push(program.version)
  return parts.join(' · ')
}
