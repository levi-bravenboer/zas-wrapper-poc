import { i18n } from '@/lib/i18n'

import { LUSCII_PROGRAM_MODES, type LusciiProgramData, type LusciiProgramMode } from './types'

// Tuple-membership predicate matching the repo convention (see
// `isLaneKindCode` in `pathway/types.ts`, `isSupportedLocale` in
// `lib/i18n/index.ts`). Adding a new mode to `LUSCII_PROGRAM_MODES`
// automatically widens this predicate — no duplicate string literals.
function isLusciiProgramMode(value: string | null | undefined): value is LusciiProgramMode {
  return value != null && (LUSCII_PROGRAM_MODES as readonly string[]).includes(value)
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
  if (isLusciiProgramMode(mode))
    parts.push(i18n.t(`pathway:inspector.lusciiProgram.modeOption.${mode}`))
  parts.push(program.version)
  return parts.join(' · ')
}
