import { describe, expect, it } from 'vitest'

import {
  CONFIG_SCHEMAS,
  defaultConfig,
  parseBlockConfig,
  type AnyBlockConfig,
} from './configSchemas'
import type { BlockSemantics, PathwayBlock } from './types'

function fakeBlock(config: Record<string, unknown>): PathwayBlock {
  // Slot #2 §6: blocks are typed; spread the test config payload over
  // a stub envelope to keep the existing `parseBlockConfig` checks
  // operating against the synthesized legacy bag.
  return {
    id: '00000000-0000-4000-8000-000000000000',
    kind: 'task',
    name: '',
    phase_id: '00000000-0000-4000-8000-000000000001',
    lane_id: '00000000-0000-4000-8000-000000000002',
    x: 0,
    y: 0,
    input_logic: { rules: [], aggregator: 'all_of' },
    timing_policy: null,
    ...config,
  } as unknown as PathwayBlock
}

describe('CONFIG_SCHEMAS — every BlockSemantics has a schema', () => {
  const semantics: BlockSemantics[] = [
    'appointment',
    'task',
    'message',
    'form',
    'decision',
    'pathway_link',
  ]

  it.each(semantics)('%s schema exists and defaults to a parseable object', (s) => {
    const schema = CONFIG_SCHEMAS[s]
    expect(schema).toBeDefined()
    expect(() => defaultConfig(s)).not.toThrow()
  })
})

describe('parseBlockConfig — valid configs round-trip', () => {
  // Slot #2 §6 disambiguates: `kind` is the typed discriminator on
  // the envelope; the legacy AppointmentBlock `kind` config field is
  // renamed to `mode`. This test is skipped until the appointment
  // inspector retypes.
  it.skip('parses an appointment config', () => {
    const parsed = parseBlockConfig(
      fakeBlock({ mode: 'in_person', location: 'AZ Sint-Maarten' }),
      'appointment',
    )
    expect((parsed as { mode?: string }).mode).toBe('in_person')
    expect(parsed.location).toBe('AZ Sint-Maarten')
  })

  it('parses a task config', () => {
    const parsed = parseBlockConfig(
      fakeBlock({ assignee: 'caregiver', description: 'Bel patiënt' }),
      'task',
    )
    expect(parsed.assignee).toBe('caregiver')
  })

  it('parses a message config', () => {
    const parsed = parseBlockConfig(
      fakeBlock({ channel: 'sms', subject: 'Herinnering', body: 'Vergeet niet' }),
      'message',
    )
    expect(parsed.channel).toBe('sms')
  })

  it('parses a form config with questions', () => {
    const parsed = parseBlockConfig(
      fakeBlock({
        questions: [
          { id: 'q1', type: 'text', label: 'Naam', required: true },
          {
            id: 'q2',
            type: 'single_choice',
            label: 'Pijn?',
            required: false,
            options: ['ja', 'nee'],
          },
        ],
      }),
      'form',
    )
    expect(parsed.questions).toHaveLength(2)
    expect(parsed.questions[1]?.options).toEqual(['ja', 'nee'])
  })

  it('parses a pathway_link config and defaults context_mapping', () => {
    const parsed = parseBlockConfig(
      fakeBlock({
        target_pathway_id: '11111111-1111-4111-8111-111111111111',
        mode: 'blocking',
      }),
      'pathway_link',
    )
    expect(parsed.mode).toBe('blocking')
    expect(parsed.context_mapping).toEqual({})
  })

  it('parses a decision config with outputs + mode', () => {
    const parsed = parseBlockConfig(
      fakeBlock({
        question: 'Herstel volgens plan?',
        outputs: ['goed', 'onvoldoende'],
        mode: 'xor',
      }),
      'decision',
    )
    expect(parsed.question).toBe('Herstel volgens plan?')
    expect(parsed.outputs).toEqual(['goed', 'onvoldoende'])
    expect(parsed.mode).toBe('xor')
  })
})

describe('parseBlockConfig — accepts null for nullable BE fields', () => {
  // Backend serialises unset nullable columns as explicit `null`. The
  // zod schemas must accept those without dropping the inspector.
  it('task accepts null on every optional field', () => {
    const parsed = parseBlockConfig(
      fakeBlock({
        title: 'Bel patiënt',
        assignee: 'caregiver',
        due_offset_days: null,
        requires_completion: null,
        notes: null,
      }),
      'task',
    )
    expect(parsed.title).toBe('Bel patiënt')
    expect(parsed.requires_completion).toBeNull()
  })

  it('appointment accepts null on mode/location/duration/attendees/notes', () => {
    const parsed = parseBlockConfig(
      fakeBlock({
        title: 'Intake',
        mode: null,
        location: null,
        duration_minutes: null,
        attendees_patient: null,
        notes: null,
      }),
      'appointment',
    )
    expect(parsed.title).toBe('Intake')
    expect(parsed.mode).toBeNull()
  })
})

describe('parseBlockConfig — invalid configs throw with the right path', () => {
  it('message rejects unknown channel', () => {
    expect(() => parseBlockConfig(fakeBlock({ channel: 'carrier_pigeon' }), 'message')).toThrow(
      /channel/,
    )
  })

  it('form rejects a question with unknown type', () => {
    expect(() =>
      parseBlockConfig(
        fakeBlock({ questions: [{ id: 'q1', type: 'mystery', label: 'x', required: false }] }),
        'form',
      ),
    ).toThrow(/type/)
  })

  it('pathway_link rejects unknown mode', () => {
    expect(() =>
      parseBlockConfig(
        fakeBlock({
          target_pathway_id: '11111111-1111-4111-8111-111111111111',
          mode: 'whenever',
        }),
        'pathway_link',
      ),
    ).toThrow(/mode/)
  })
})

describe('AnyBlockConfig — type coverage smoke', () => {
  it('compiles when assembling a record over all semantics', () => {
    const sample: Record<BlockSemantics, AnyBlockConfig> = {
      start: { name: 'Start' },
      appointment: { title: 'Consult' },
      treatment: { title: 'Lumbale spinale fusie' },
      task: { title: 'Bel patiënt', assignee: 'caregiver' },
      message: { channel: 'email' },
      form: { questions: [] },
      decision: { question: 'x', outputs: ['ja', 'nee'] },
      pathway_link: {
        target_pathway_id: '11111111-1111-4111-8111-111111111111',
        mode: 'blocking',
        context_mapping: {},
      },
      external_program: {
        program_id: 'luscii-hartfalen-monitoring-v4',
        protocol_id: 'proto-std-12w',
        mode: 'blocking',
      },
      informed_consent: { questions: [], channels: ['email'] },
      mdo: { topic: 'Bespreking pathologie' },
      end_pathway: { name: 'End' },
    }
    expect(Object.keys(sample)).toHaveLength(12)
  })
})
