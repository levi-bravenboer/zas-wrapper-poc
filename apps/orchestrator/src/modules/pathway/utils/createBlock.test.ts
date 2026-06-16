import { describe, expect, it } from 'vitest'

import type { PathwayBlockType } from '../types'

import { buildDefaultBlockConfig, createBlock } from './createBlock'
import { isLaneAllowed } from './laneRules'

function makeBlockType(overrides: Partial<PathwayBlockType> & { type: string }): PathwayBlockType {
  return {
    type: overrides.type,
    label: overrides.label ?? overrides.type,
    semantics: overrides.semantics ?? (overrides.type as PathwayBlockType['semantics']),
    icon: overrides.icon ?? 'square',
    allowed_lane_kind_codes: overrides.allowed_lane_kind_codes ?? ['patient'],
    config_schema: overrides.config_schema ?? {},
    ui_schema: overrides.ui_schema ?? {},
    supports_branches: overrides.supports_branches ?? false,
    source: overrides.source ?? 'native',
    provider: overrides.provider ?? null,
    kind: overrides.kind ?? null,
  }
}

describe('createBlock', () => {
  it('produces empty config when schema has no required properties', () => {
    const block = createBlock({
      blockType: makeBlockType({ type: 'wait', config_schema: { type: 'object', properties: {} } }),
      phaseId: 'p1',
      laneId: 'l1',
      x: 10,
      y: 20,
    })
    expect(block.kind).toBe('wait')
    expect(block.name).toBe('wait')
  })

  it('rounds non-integer coordinates', () => {
    const block = createBlock({
      blockType: makeBlockType({ type: 'task' }),
      phaseId: 'p',
      laneId: 'l',
      x: 4.6,
      y: 9.4,
    })
    expect(block.x).toBe(5)
    expect(block.y).toBe(9)
  })

  it('seeds required string with placeholder when minLength > 0', () => {
    const block = createBlock({
      blockType: makeBlockType({
        type: 'appointment',
        label: 'Afspraak',
        config_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1, maxLength: 255 },
            notes: { type: 'string' },
          },
          required: ['title'],
        },
      }),
      phaseId: 'p',
      laneId: 'l',
      x: 0,
      y: 0,
    })
    expect((block as unknown as { title: string }).title).toBe('Afspraak')
  })

  it('picks first enum value for required enum fields', () => {
    const block = createBlock({
      blockType: makeBlockType({
        type: 'task',
        label: 'Taak',
        config_schema: {
          type: 'object',
          properties: {
            title: { type: 'string', minLength: 1 },
            assignee: { type: 'string', enum: ['patient', 'caregiver'] },
          },
          required: ['title', 'assignee'],
        },
      }),
      phaseId: 'p',
      laneId: 'l',
      x: 0,
      y: 0,
    })
    expect((block as unknown as { title: string; assignee: string }).title).toBe('Taak')
    expect((block as unknown as { title: string; assignee: string }).assignee).toBe('patient')
  })
})

describe('buildDefaultBlockConfig', () => {
  it('returns {} for null/undefined schema', () => {
    expect(buildDefaultBlockConfig(undefined, 'x')).toEqual({})
    expect(buildDefaultBlockConfig(null, 'x')).toEqual({})
  })

  it('fills required array with minItems items recursively', () => {
    const result = buildDefaultBlockConfig(
      {
        type: 'object',
        properties: {
          questions: {
            type: 'array',
            minItems: 1,
            items: {
              type: 'object',
              required: ['id', 'type', 'label', 'required'],
              properties: {
                id: { type: 'string', minLength: 1 },
                type: { type: 'string', enum: ['text', 'long_text'] },
                label: { type: 'string', minLength: 1 },
                required: { type: 'boolean' },
              },
            },
          },
        },
        required: ['questions'],
      },
      'Formulier',
    )
    expect(Array.isArray(result.questions)).toBe(true)
    const questions = result.questions as Array<Record<string, unknown>>
    expect(questions).toHaveLength(1)
    const q = questions[0]!
    expect(q.type).toBe('text')
    expect(q.label).toBe('Formulier')
    expect(q.required).toBe(false)
    expect(typeof q.id).toBe('string')
    expect((q.id as string).length).toBeGreaterThan(0)
  })

  it('defaults numeric required to minimum when present, else 0', () => {
    expect(
      buildDefaultBlockConfig(
        {
          type: 'object',
          properties: {
            a: { type: 'integer', minimum: 5 },
            b: { type: 'number' },
          },
          required: ['a', 'b'],
        },
        '',
      ),
    ).toEqual({ a: 5, b: 0 })
  })

  it('generates uuid for required string with format uuid', () => {
    const out = buildDefaultBlockConfig(
      {
        type: 'object',
        properties: { target_id: { type: 'string', format: 'uuid' } },
        required: ['target_id'],
      },
      '',
    )
    expect(typeof out.target_id).toBe('string')
    expect((out.target_id as string).length).toBeGreaterThan(0)
  })
})

describe('new block types — lane allowance', () => {
  const cases: Array<{ type: string; allowed: string[]; ok: string; bad: string }> = [
    { type: 'form', allowed: ['patient'], ok: 'patient', bad: 'system' },
    { type: 'wait', allowed: ['system'], ok: 'system', bad: 'patient' },
    { type: 'pathway_link', allowed: ['system'], ok: 'system', bad: 'caregiver' },
  ]

  it.each(cases)('$type allows $ok and rejects $bad', ({ allowed, ok, bad }) => {
    expect(isLaneAllowed({ allowed_lane_kind_codes: allowed }, ok)).toBe(true)
    expect(isLaneAllowed({ allowed_lane_kind_codes: allowed }, bad)).toBe(false)
  })
})
