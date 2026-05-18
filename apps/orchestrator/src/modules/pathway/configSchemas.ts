import { z } from 'zod'

import type { BlockSemantics, PathwayBlock } from './types'

const FormQuestion = z.object({
  id: z.string(),
  type: z.enum(['text', 'long_text', 'single_choice', 'multi_choice', 'scale', 'date', 'file']),
  label: z.string(),
  required: z.boolean(),
  options: z.array(z.string()).optional(),
})

export type FormQuestion = z.infer<typeof FormQuestion>

export const FORM_QUESTION_TYPES = [
  'text',
  'long_text',
  'single_choice',
  'multi_choice',
  'scale',
  'date',
  'file',
] as const satisfies ReadonlyArray<FormQuestion['type']>

export const WAIT_EVENT_TYPES = [
  'pathology_report',
  'scan_report',
  'lab_result',
  'external_data',
] as const

export const WAIT_ON_TIMEOUT = ['advance', 'escalate'] as const

export const MESSAGE_CHANNELS = ['email', 'sms', 'push', 'in_app'] as const

export const PATHWAY_LINK_MODES = ['blocking', 'fire_and_forget'] as const

const AppointmentConfig = z.object({
  kind: z.string().optional(),
  location: z.string().optional(),
})

const TaskConfig = z.object({
  assignee: z.string().optional(),
  description: z.string().optional(),
})

const MessageConfig = z.object({
  channel: z.enum(MESSAGE_CHANNELS).optional(),
  subject: z.string().optional(),
  body: z.string().optional(),
  cta_label: z.string().optional(),
  cta_target: z.string().optional(),
})

const FormConfig = z.object({
  questions: z.array(FormQuestion).default([]),
})

const DecisionConfig = z.object({
  criterion: z.string().optional(),
})

const MilestoneConfig = z.object({
  note: z.string().optional(),
})

const WaitConfig = z.object({
  event_type: z.enum(WAIT_EVENT_TYPES).optional(),
  timeout_days: z.number().int().positive().optional(),
  on_timeout: z.enum(WAIT_ON_TIMEOUT).optional(),
  source_block_id: z.string().uuid().optional(),
})

const PathwayLinkConfig = z.object({
  target_pathway_id: z.string().uuid().optional(),
  mode: z.enum(PATHWAY_LINK_MODES).optional(),
  context_mapping: z.record(z.string(), z.string()).default({}),
})

export const CONFIG_SCHEMAS = {
  appointment: AppointmentConfig,
  task: TaskConfig,
  message: MessageConfig,
  form: FormConfig,
  decision: DecisionConfig,
  milestone: MilestoneConfig,
  wait: WaitConfig,
  pathway_link: PathwayLinkConfig,
} as const satisfies Record<BlockSemantics, z.ZodObject>

export type ConfigForSemantics<S extends BlockSemantics> = z.infer<(typeof CONFIG_SCHEMAS)[S]>

export type AnyBlockConfig = {
  [S in BlockSemantics]: ConfigForSemantics<S>
}[BlockSemantics]

export function parseBlockConfig<S extends BlockSemantics>(
  block: PathwayBlock,
  semantics: S,
): ConfigForSemantics<S> {
  const schema = CONFIG_SCHEMAS[semantics]
  return schema.parse(block.config ?? {}) as ConfigForSemantics<S>
}

export function defaultConfig<S extends BlockSemantics>(semantics: S): ConfigForSemantics<S> {
  return CONFIG_SCHEMAS[semantics].parse({}) as ConfigForSemantics<S>
}
