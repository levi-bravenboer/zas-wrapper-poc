import { describe, expect, it } from 'vitest'

import { buildSubLine } from './subLine'
import type { LusciiProgramData } from './types'

function program(overrides: Partial<LusciiProgramData> = {}): LusciiProgramData {
  return {
    id: 'p-1',
    name: 'Hartfalen thuismonitoring',
    version: 'v4.2',
    protocols: [
      {
        id: 'proto-std-12w',
        name: 'Standaard 12 weken',
        is_default: true,
      },
      {
        id: 'proto-intensive-6w',
        name: 'Intensief 6 weken',
        is_default: false,
      },
    ],
    layout: { phases: [], lanes: [] },
    instruments: [],
    is_two_way_messaging: true,
    enrolled_count_org_wide: 0,
    ...overrides,
  } as unknown as LusciiProgramData
}

describe('buildSubLine', () => {
  it('returns null when no program is supplied', () => {
    expect(buildSubLine(null, 'proto-std-12w', 'blocking')).toBeNull()
  })

  it('renders protocol name, mode label, and version when all parts are present', () => {
    expect(buildSubLine(program(), 'proto-std-12w', 'blocking')).toBe(
      'Standaard 12 weken · Blokkerend · v4.2',
    )
  })

  it('renders the translated fire-and-forget mode label', () => {
    expect(buildSubLine(program(), 'proto-std-12w', 'fire_and_forget')).toBe(
      'Standaard 12 weken · Vuren en vergeten · v4.2',
    )
  })

  it('skips the protocol segment when protocolId does not resolve', () => {
    expect(buildSubLine(program(), 'proto-missing', 'blocking')).toBe('Blokkerend · v4.2')
  })

  it('skips the mode segment when mode is unknown', () => {
    expect(buildSubLine(program(), 'proto-std-12w', 'something-else')).toBe(
      'Standaard 12 weken · v4.2',
    )
  })

  it('renders only the version when neither protocol nor mode resolves', () => {
    expect(buildSubLine(program(), null, null)).toBe('v4.2')
  })
})
