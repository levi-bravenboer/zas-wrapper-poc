import { z } from 'zod'

import type { components } from '@/lib/api/schema'
import { legacyBlockConfig, type BlockSemantics, type PathwayBlock } from './types'

type Schemas = components['schemas']

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

export const MESSAGE_CHANNELS = [
  'email',
  'sms',
  'push',
  'in_app',
] as const satisfies readonly NonNullable<Schemas['MessageBlockOut']['channel']>[]

export const PATHWAY_LINK_MODES = [
  'blocking',
  'fire_and_forget',
] as const satisfies readonly NonNullable<Schemas['PathwayLinkBlockOut']['mode']>[]

export const PATHWAY_LINK_VERSION_PINS = [
  'latest_published',
  'specific',
] as const satisfies readonly NonNullable<Schemas['PathwayLinkBlockOut']['version_pin']>[]

export const APPOINTMENT_MODES = [
  'in_person',
  'video',
  'phone',
] as const satisfies readonly NonNullable<Schemas['AppointmentBlockOut']['mode']>[]

// All `.optional()` fields are also `.nullable()` so they round-trip
// the BE wire shape, which serialises unset nullable columns as
// explicit `null` rather than omitting them.
const AppointmentConfig = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  mode: z.enum(APPOINTMENT_MODES).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  duration_minutes: z.number().int().min(0).nullable().optional(),
  attendees_patient: z.boolean().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

export const TASK_ASSIGNEES = ['caregiver'] as const satisfies readonly NonNullable<
  Schemas['TaskBlockOut']['assignee']
>[]

const TaskConfig = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  assignee: z.enum(TASK_ASSIGNEES).nullable().optional(),
  due_offset_days: z.number().int().min(0).nullable().optional(),
  requires_completion: z.boolean().nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

const MessageConfig = z.object({
  channel: z.enum(MESSAGE_CHANNELS).nullable().optional(),
  subject: z.string().nullable().optional(),
  body: z.string().nullable().optional(),
  cta_label: z.string().nullable().optional(),
  cta_target: z.string().nullable().optional(),
})

const FormConfig = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  intro: z.string().max(2000).nullable().optional(),
  questions: z.array(FormQuestion).default([]),
  submit_label: z.string().max(64).nullable().optional(),
  confirmation_message: z.string().max(2000).nullable().optional(),
})

export const DECISION_MODES = ['xor', 'and'] as const satisfies readonly NonNullable<
  Schemas['DecisionBlockOut']['mode']
>[]

// Slot #2 §5: a DecisionBlock declares `question` + typed `outputs`
// (the keys downstream `decision_output` rules point at) + firing
// `mode`. The legacy `criterion` field is retired.
const DecisionConfig = z.object({
  question: z.string().min(1).max(500).nullable().optional(),
  outputs: z.array(z.string().min(1).max(64)).default([]),
  mode: z.enum(DECISION_MODES).nullable().optional(),
})

const PathwayLinkConfig = z.object({
  target_pathway_id: z.string().uuid().nullable().optional(),
  mode: z.enum(PATHWAY_LINK_MODES).nullable().optional(),
  // Governs which child version this link resolves to at snapshot/publish
  // time. `latest_published` re-resolves at every parent publish;
  // `specific` freezes to `pinned_version_id`. Backend enforces ownership.
  version_pin: z.enum(PATHWAY_LINK_VERSION_PINS).nullable().optional(),
  pinned_version_id: z.string().uuid().nullable().optional(),
  context_mapping: z.record(z.string(), z.string()).default({}),
})

// Author-time fields only. Per-patient values (BSN, contact, locale) live at
// the runtime enrollment surface, not in the block config — see
// `openspec/changes/external-block-integrations/design.md` "Per-patient values
// stay at enrollment runtime".
const ExternalProgramConfig = z.object({
  program_id: z.string().min(1).nullable().optional(),
  protocol_id: z.string().min(1).nullable().optional(),
  mode: z.enum(PATHWAY_LINK_MODES).nullable().optional(),
})

// catalogue-expansion § 1 / § 2: structural marker kinds. Both carry only
// `name`, no per-kind authoring surface beyond the inherited label.
const StartConfig = z.object({
  name: z.string().nullable().optional(),
})

const EndPathwayConfig = z.object({
  name: z.string().nullable().optional(),
})

// catalogue-expansion § A4: TreatmentBlock — uitgevoerde ingreep met
// klinische uitkomst. RESULT_TYPE = TreatmentResult; this schema covers
// only the template-side authoring surface.
const TreatmentConfig = z.object({
  title: z.string().min(1).max(255).nullable().optional(),
  location: z.string().max(255).nullable().optional(),
  duration_minutes: z.number().int().min(0).nullable().optional(),
  notes: z.string().max(2000).nullable().optional(),
})

// pathway-completion § A8: InformedConsentBlock — two-actor consent
// lifecycle. Reminder/expiry timing is owned by these fields;
// timing_policy is forbidden for this kind.
export const INFORMED_CONSENT_CHANNELS = [
  'email',
  'sms',
  'push',
  'in_app',
] as const satisfies readonly NonNullable<Schemas['InformedConsentBlockOut']['channels']>[number][]

const InformedConsentConfig = z.object({
  questions: z.array(FormQuestion).default([]),
  channels: z.array(z.enum(INFORMED_CONSENT_CHANNELS)).default(['email', 'push']),
  reminder_offset_iso: z.string().max(63).nullable().optional(),
  reminder_max: z.number().int().min(0).max(10).nullable().optional(),
  expires_at_iso: z.string().max(63).nullable().optional(),
})

// pathway-completion § A7: MdoBlock — multi-disciplinair overleg.
// 1 leading caregiver + unlimited extras; leading completes.
const MdoConfig = z.object({
  topic: z.string().min(1).max(500).nullable().optional(),
  expected_attendees_note: z.string().max(2000).nullable().optional(),
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
