import type { BlockConfigSchema, PathwayBlock, PathwayBlockType } from '../types'

type CreateBlockInput = {
  blockType: PathwayBlockType
  phaseId: string
  laneId: string
  x: number
  y: number
}

export function createBlock({ blockType, phaseId, laneId, x, y }: CreateBlockInput): PathwayBlock {
  return {
    id: crypto.randomUUID(),
    phase_id: phaseId,
    lane_id: laneId,
    type: blockType.type,
    label: null,
    duration_value_id: null,
    config: buildDefaultBlockConfig(blockType.config_schema, blockType.label),
    x: Math.round(x),
    y: Math.round(y),
  }
}

// Walks a JSON Schema `required` list and produces the smallest object that
// satisfies the schema. Mirrors the backend's autosave validator
// (Draft 2020-12) so a freshly dropped block never fails the PUT /pathways
// round-trip with `invalid.pathway.block-config`.
export function buildDefaultBlockConfig(
  schema: BlockConfigSchema | null | undefined,
  placeholder: string,
): Record<string, unknown> {
  if (!schema || typeof schema !== 'object') return {}
  return defaultsForObject(schema as Record<string, unknown>, placeholder)
}

function defaultsForObject(
  schema: Record<string, unknown>,
  placeholder: string,
): Record<string, unknown> {
  const required = Array.isArray(schema.required) ? (schema.required as string[]) : []
  const properties =
    typeof schema.properties === 'object' && schema.properties !== null
      ? (schema.properties as Record<string, unknown>)
      : {}
  const out: Record<string, unknown> = {}
  for (const key of required) {
    out[key] = defaultForSchema(properties[key], placeholder)
  }
  return out
}

function defaultForSchema(schema: unknown, placeholder: string): unknown {
  if (typeof schema !== 'object' || schema === null) return null
  const s = schema as Record<string, unknown>
  if (Array.isArray(s.enum) && s.enum.length > 0) return s.enum[0]
  switch (s.type) {
    case 'string': {
      if (s.format === 'uuid') return crypto.randomUUID()
      const minLength = typeof s.minLength === 'number' ? s.minLength : 0
      return minLength > 0 ? placeholder : ''
    }
    case 'integer':
    case 'number':
      return typeof s.minimum === 'number' ? s.minimum : 0
    case 'boolean':
      return false
    case 'object':
      return defaultsForObject(s, placeholder)
    case 'array': {
      const minItems = typeof s.minItems === 'number' ? s.minItems : 0
      return Array.from({ length: minItems }, () => defaultForSchema(s.items, placeholder))
    }
    default:
      return null
  }
}
