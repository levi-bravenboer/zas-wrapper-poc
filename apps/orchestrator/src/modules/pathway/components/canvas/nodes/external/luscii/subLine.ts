import type { LusciiProgramData } from './types'

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
  if (mode) parts.push(mode === 'blocking' ? 'Blocking' : 'Fire-and-forget')
  parts.push(program.version)
  return parts.join(' · ')
}
