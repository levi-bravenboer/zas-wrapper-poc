import { Plus, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'

import type { PathwayBlock } from '../../types'

import { OptionsSelect } from './OptionsSelect'

// Typed rule composer over the already-placed blocks
// (pathway-completion § C4.5). `input_logic` is the single authored
// connector surface — the canvas derives its edges from these rules.
//
// PoC composer scope: the block-referencing predicates an author wires
// by hand. `wait_after` (time markers) and the data predicates keep
// their authoring story in the marker/timing inspectors.

type InputLogicShape = NonNullable<PathwayBlock['input_logic']>
type RuleShape = InputLogicShape['rules'][number]

// Single source of truth for which composer predicates exist + the
// per-predicate "extra" argument field they carry. Adding a predicate
// is one entry.
type PredicateMeta = {
  /** Object key on `rule.args` that holds the extra value (e.g.
   *  `output_key` for decision_output). `null` when the predicate
   *  carries no extra (if_done). */
  extraField: 'output_key' | 'offset_iso' | 'event_type' | null
  /** i18n key for the placeholder, or `null` when no translation is
   *  needed (raw fallback only). */
  placeholderI18nKey: string | null
  /** Placeholder text used directly (and as i18n default when a key
   *  is provided). */
  placeholderDefault: string
}

const PREDICATE_META = {
  if_done: { extraField: null, placeholderI18nKey: null, placeholderDefault: '' },
  decision_output: {
    extraField: 'output_key',
    placeholderI18nKey: 'inputLogic.extraPlaceholder.output',
    placeholderDefault: 'output (bv. goed)',
  },
  if_not_done_within: {
    extraField: 'offset_iso',
    placeholderI18nKey: null,
    placeholderDefault: 'P14D',
  },
  event: {
    extraField: 'event_type',
    placeholderI18nKey: 'inputLogic.extraPlaceholder.event',
    placeholderDefault: 'event type',
  },
} as const satisfies Record<string, PredicateMeta>

type ComposerPredicate = keyof typeof PREDICATE_META

const COMPOSER_PREDICATES = Object.keys(PREDICATE_META) as ComposerPredicate[]

function isComposerPredicate(value: string): value is ComposerPredicate {
  return value in PREDICATE_META
}

function predicateOf(rule: RuleShape): string {
  return (rule.args as { predicate?: string }).predicate ?? 'if_done'
}

function buildArgs(
  predicate: ComposerPredicate,
  afterBlock: string,
  extra: string,
): RuleShape['args'] {
  const meta = PREDICATE_META[predicate]
  const base = { predicate, after_block: afterBlock } as Record<string, unknown>
  if (meta.extraField) base[meta.extraField] = extra
  return base as RuleShape['args']
}

function extraOf(rule: RuleShape): string {
  const predicate = predicateOf(rule)
  if (!isComposerPredicate(predicate)) return ''
  const field = PREDICATE_META[predicate].extraField
  if (!field) return ''
  const value = (rule.args as Record<string, unknown>)[field]
  return typeof value === 'string' ? value : ''
}

type Props = {
  value: InputLogicShape
  /** Blocks available as upstream references (the dialog excludes self). */
  upstreamBlocks: PathwayBlock[]
  onChange: (next: InputLogicShape) => void
}

export function InputLogicEditor({ value, upstreamBlocks, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const rules = value.rules ?? []

  function patchRule(index: number, next: RuleShape) {
    onChange({ ...value, rules: rules.map((rule, i) => (i === index ? next : rule)) })
  }

  function addRule() {
    const first = upstreamBlocks[0]
    if (!first) return
    onChange({
      ...value,
      rules: [...rules, { node: first.id, args: buildArgs('if_done', first.id, '') }],
    })
  }

  function removeRule(index: number) {
    onChange({ ...value, rules: rules.filter((_, i) => i !== index) })
  }

  const aggregatorOptions = [
    {
      value: 'all_of',
      label: t('inputLogic.aggregator.all_of', { defaultValue: 'alle regels (EN)' }),
    },
    {
      value: 'any_of',
      label: t('inputLogic.aggregator.any_of', { defaultValue: 'minstens één (OF)' }),
    },
  ]

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {t('inputLogic.hint', {
            defaultValue: 'Wanneer wordt dit blok actief? Regels verwijzen naar geplaatste blokken.',
          })}
        </p>
        {rules.length > 1 && (
          <OptionsSelect
            value={value.aggregator ?? 'all_of'}
            options={aggregatorOptions}
            onChange={(aggregator) =>
              onChange({ ...value, aggregator: aggregator as InputLogicShape['aggregator'] })
            }
            triggerClassName="h-7 w-auto text-[11px]"
          />
        )}
      </div>

      {rules.map((rule, index) => {
        const predicate = predicateOf(rule)
        if (!isComposerPredicate(predicate)) {
          return (
            <ReadOnlyRule
              key={index}
              predicate={predicate}
              upstream={upstreamBlocks.find((b) => b.id === rule.node)}
              afterBlock={rule.node}
              onRemove={() => removeRule(index)}
            />
          )
        }
        return (
          <EditableRule
            key={index}
            predicate={predicate}
            afterBlock={rule.node}
            extra={extraOf(rule)}
            upstreamBlocks={upstreamBlocks}
            onChange={(nextPredicate, nextAfter, nextExtra) =>
              patchRule(index, {
                node: nextAfter,
                args: buildArgs(nextPredicate, nextAfter, nextExtra),
              })
            }
            onRemove={() => removeRule(index)}
          />
        )
      })}

      <Button
        type="button"
        variant="outline"
        size="sm"
        onClick={addRule}
        disabled={!upstreamBlocks.length}
        className="self-start"
      >
        <Plus className="size-3.5" />
        {t('inputLogic.addRule', { defaultValue: 'Voeg regel toe' })}
      </Button>
    </div>
  )
}

type RemoveButtonProps = { onClick: () => void }

function RemoveRuleButton({ onClick }: RemoveButtonProps): ReactElement {
  const { t } = useTranslation('pathway')
  return (
    <Button
      type="button"
      variant="ghost"
      size="icon"
      aria-label={t('inputLogic.removeRule', { defaultValue: 'Regel verwijderen' })}
      onClick={onClick}
    >
      <Trash2 className="size-3.5" />
    </Button>
  )
}

type ReadOnlyRuleProps = {
  predicate: string
  upstream: PathwayBlock | undefined
  afterBlock: string
  onRemove: () => void
}

// Rules authored outside the composer (e.g. `wait_after` markers
// surfaced by the timing inspector) render read-only so we never
// mangle their args.
function ReadOnlyRule({
  predicate,
  upstream,
  afterBlock,
  onRemove,
}: ReadOnlyRuleProps): ReactElement {
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-2.5 py-1.5 text-[12px] text-muted-foreground">
      <span>
        {predicate} · {upstream?.name ?? afterBlock}
      </span>
      <RemoveRuleButton onClick={onRemove} />
    </div>
  )
}

type EditableRuleProps = {
  predicate: ComposerPredicate
  afterBlock: string
  extra: string
  upstreamBlocks: PathwayBlock[]
  onChange: (predicate: ComposerPredicate, afterBlock: string, extra: string) => void
  onRemove: () => void
}

function EditableRule({
  predicate,
  afterBlock,
  extra,
  upstreamBlocks,
  onChange,
  onRemove,
}: EditableRuleProps): ReactElement {
  const { t } = useTranslation('pathway')
  const meta = PREDICATE_META[predicate]
  const placeholder = meta.placeholderI18nKey
    ? t(meta.placeholderI18nKey, { defaultValue: meta.placeholderDefault })
    : meta.placeholderDefault

  const predicateOptions = COMPOSER_PREDICATES.map((p) => ({
    value: p,
    label: t(`inputLogic.predicate.${p}`, { defaultValue: p }),
  }))
  const upstreamOptions = upstreamBlocks.map((b) => ({
    value: b.id,
    label: b.name || b.id.slice(0, 8),
  }))

  return (
    <div className="flex items-center gap-1.5 rounded-md border px-2 py-1.5">
      <OptionsSelect
        value={predicate}
        options={predicateOptions}
        onChange={(p) => onChange(p as ComposerPredicate, afterBlock, extra)}
        triggerClassName="h-8 w-[150px] text-[12px]"
      />
      <OptionsSelect
        value={afterBlock}
        options={upstreamOptions}
        onChange={(blockId) => onChange(predicate, blockId, extra)}
        placeholder={t('inputLogic.pickBlock', { defaultValue: 'Kies blok' })}
        triggerClassName="h-8 flex-1 text-[12px]"
      />
      {meta.extraField && (
        <Input
          aria-label={t(`inputLogic.extra.${predicate}`, { defaultValue: 'detail' })}
          value={extra}
          placeholder={placeholder}
          onChange={(e) => onChange(predicate, afterBlock, e.target.value)}
          className="h-8 w-[130px] text-[12px]"
        />
      )}
      <RemoveRuleButton onClick={onRemove} />
    </div>
  )
}
