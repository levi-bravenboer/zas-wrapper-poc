import { Plus, Trash2 } from 'lucide-react'
import type { ReactElement } from 'react'
import { useTranslation } from 'react-i18next'

import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'

import type { PathwayBlock } from '../../types'

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
  /** Default value when the predicate is first picked. */
  extraDefault: string
  /** i18n key segment for the placeholder. */
  placeholderKey: 'output' | 'iso' | 'event' | null
}

const PREDICATE_META = {
  if_done: { extraField: null, extraDefault: '', placeholderKey: null },
  decision_output: {
    extraField: 'output_key',
    extraDefault: '',
    placeholderKey: 'output',
  },
  if_not_done_within: {
    extraField: 'offset_iso',
    extraDefault: 'P14D',
    placeholderKey: 'iso',
  },
  event: { extraField: 'event_type', extraDefault: '', placeholderKey: 'event' },
} as const satisfies Record<string, PredicateMeta>

type ComposerPredicate = keyof typeof PREDICATE_META

const COMPOSER_PREDICATES = Object.keys(PREDICATE_META) as ComposerPredicate[]

const COMPOSER_PREDICATE_SET = new Set<string>(COMPOSER_PREDICATES)

function isComposerPredicate(value: string): value is ComposerPredicate {
  return COMPOSER_PREDICATE_SET.has(value)
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
      rules: [
        ...rules,
        { node: first.id, args: buildArgs('if_done', first.id, PREDICATE_META.if_done.extraDefault) },
      ],
    })
  }

  function removeRule(index: number) {
    onChange({ ...value, rules: rules.filter((_, i) => i !== index) })
  }

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-muted-foreground">
          {t('inputLogic.hint', {
            defaultValue: 'Wanneer wordt dit blok actief? Regels verwijzen naar geplaatste blokken.',
          })}
        </p>
        {rules.length > 1 && (
          <Select
            value={value.aggregator ?? 'all_of'}
            onValueChange={(aggregator) =>
              onChange({ ...value, aggregator: aggregator as InputLogicShape['aggregator'] })
            }
          >
            <SelectTrigger className="h-7 w-auto text-[11px]">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all_of">
                {t('inputLogic.aggregator.all_of', { defaultValue: 'alle regels (EN)' })}
              </SelectItem>
              <SelectItem value="any_of">
                {t('inputLogic.aggregator.any_of', { defaultValue: 'minstens één (OF)' })}
              </SelectItem>
            </SelectContent>
          </Select>
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
  const { t } = useTranslation('pathway')
  return (
    <div className="flex items-center justify-between rounded-md border bg-muted/40 px-2.5 py-1.5 text-[12px] text-muted-foreground">
      <span>
        {predicate} · {upstream?.name ?? afterBlock}
      </span>
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('inputLogic.removeRule', { defaultValue: 'Regel verwijderen' })}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
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
  const placeholderKey = meta.placeholderKey
  const placeholder =
    placeholderKey === 'output'
      ? t('inputLogic.extraPlaceholder.output', { defaultValue: 'output (bv. goed)' })
      : placeholderKey === 'iso'
        ? 'P14D'
        : placeholderKey === 'event'
          ? t('inputLogic.extraPlaceholder.event', { defaultValue: 'event type' })
          : ''

  return (
    <div className="flex items-center gap-1.5 rounded-md border px-2 py-1.5">
      <Select
        value={predicate}
        onValueChange={(p) => onChange(p as ComposerPredicate, afterBlock, extra)}
      >
        <SelectTrigger className="h-8 w-[150px] text-[12px]">
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {COMPOSER_PREDICATES.map((p) => (
            <SelectItem key={p} value={p}>
              {t(`inputLogic.predicate.${p}`, { defaultValue: p })}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Select
        value={afterBlock}
        onValueChange={(blockId) => onChange(predicate, blockId, extra)}
      >
        <SelectTrigger className="h-8 flex-1 text-[12px]">
          <SelectValue placeholder={t('inputLogic.pickBlock', { defaultValue: 'Kies blok' })} />
        </SelectTrigger>
        <SelectContent>
          {upstreamBlocks.map((b) => (
            <SelectItem key={b.id} value={b.id}>
              {b.name || b.id.slice(0, 8)}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      {meta.extraField && (
        <Input
          aria-label={t(`inputLogic.extra.${predicate}`, { defaultValue: 'detail' })}
          value={extra}
          placeholder={placeholder}
          onChange={(e) => onChange(predicate, afterBlock, e.target.value)}
          className="h-8 w-[130px] text-[12px]"
        />
      )}
      <Button
        type="button"
        variant="ghost"
        size="icon"
        aria-label={t('inputLogic.removeRule', { defaultValue: 'Regel verwijderen' })}
        onClick={onRemove}
      >
        <Trash2 className="size-3.5" />
      </Button>
    </div>
  )
}
