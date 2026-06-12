import { z } from 'zod'

import { legacyBlockConfig, type BlockSemantics, type PathwayBlock } from './types'

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

export const PATHWAY_LINK_VERSION_PINS = ['latest_published', 'specific'] as const

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

export const DECISION_MODES = ['xor', 'and'] as const

// Slot #2 §5: a DecisionBlock declares `question` + typed `outputs`
// (the keys downstream `decision_output` rules point at) + firing
// `mode`. The legacy `criterion` field is retired.
const DecisionConfig = z.object({
  question: z.string().min(1).max(500).optional(),
  outputs: z.array(z.string().min(1).max(64)).default([]),
  mode: z.enum(DECISION_MODES).optional(),
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
  // Governs which child version this link resolves to at snapshot/publish
  // time. `latest_published` re-resolves at every parent publish;
  // `specific` freezes to `pinned_version_id`. Backend enforces ownership.
  version_pin: z.enum(PATHWAY_LINK_VERSION_PINS).optional(),
  pinned_version_id: z.string().uuid().nullable().optional(),
  context_mapping: z.record(z.string(), z.string()).default({}),
})

// Author-time fields only. Per-patient values (BSN, contact, locale) live at
// the runtime enrollment surface, not in the block config — see
// `openspec/changes/external-block-integrations/design.md` "Per-patient values
// stay at enrollment runtime".
const ExternalProgramConfig = z.object({
  program_id: z.string().min(1).optional(),
  protocol_id: z.string().min(1).optional(),
  mode: z.enum(PATHWAY_LINK_MODES).optional(),
})

// catalogue-expansion § 1 / § 2: structural marker kinds. Both carry only
// `name`, no per-kind authoring surface beyond the inherited label.
const StartConfig = z.object({
  name: z.string().optional(),
})

const EndPathwayConfig = z.object({
  name: z.string().optional(),
})

// catalogue-expansion § A4: TreatmentBlock — uitgevoerde ingreep met
// klinische uitkomst. RESULT_TYPE = TreatmentResult; this schema covers
// only the template-side authoring surface.
const TreatmentConfig = z.object({
  title: z.string().min(1).max(255).optional(),
  location: z.string().max(255).optional(),
  duration_minutes: z.number().int().min(0).optional(),
  notes: z.string().max(2000).optional(),
})

// pathway-completion § A8: InformedConsentBlock — two-actor consent
// lifecycle. Reminder/expiry timing is owned by these fields;
// timing_policy is forbidden for this kind.
export const INFORMED_CONSENT_CHANNELS = ['email', 'sms', 'push', 'in_app'] as const

const InformedConsentConfig = z.object({
  questions: z.array(FormQuestion).default([]),
  channels: z.array(z.enum(INFORMED_CONSENT_CHANNELS)).default(['email', 'push']),
  reminder_offset_iso: z.string().max(63).optional(),
  reminder_max: z.number().int().min(0).max(10).optional(),
  expires_at_iso: z.string().max(63).nullable().optional(),
})

// pathway-completion § A7: MdoBlock — multi-disciplinair overleg.
// 1 leading caregiver + unlimited extras; leading completes.
const MdoConfig = z.object({
  topic: z.string().min(1).max(500).optional(),
  expected_attendees_note: z.string().max(2000).optional(),
})

export const CONFIG_SCHEMAS = {
  start: StartConfig,
  appointment: AppointmentConfig,
  treatment: TreatmentConfig,
  task: TaskConfig,
  message: MessageConfig,
  informed_consent: InformedConsentConfig,
  mdo: MdoConfig,
  form: FormConfig,
  decision: DecisionConfig,
  milestone: MilestoneConfig,
  wait: WaitConfig,
  pathway_link: PathwayLinkConfig,
  external_program: ExternalProgramConfig,
  end_pathway: EndPathwayConfig,
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
  return schema.parse(legacyBlockConfig(block)) as ConfigForSemantics<S>
}

export function defaultConfig<S extends BlockSemantics>(semantics: S): ConfigForSemantics<S> {
  return CONFIG_SCHEMAS[semantics].parse({}) as ConfigForSemantics<S>
}
