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

const COMPOSER_PREDICATES = [
  'if_done',
  'decision_output',
  'if_not_done_within',
  'event',
] as const

type ComposerPredicate = (typeof COMPOSER_PREDICATES)[number]

type Props = {
  value: InputLogicShape
  /** Blocks available as upstream references (the dialog excludes self). */
  upstreamBlocks: PathwayBlock[]
  onChange: (next: InputLogicShape) => void
}

function predicateOf(rule: RuleShape): string {
  return (rule.args as { predicate?: string }).predicate ?? 'if_done'
}

function buildArgs(predicate: ComposerPredicate, afterBlock: string, extra?: string): RuleShape['args'] {
  switch (predicate) {
    case 'if_done':
      return { predicate: 'if_done', after_block: afterBlock } as RuleShape['args']
    case 'decision_output':
      return {
        predicate: 'decision_output',
        after_block: afterBlock,
        output_key: extra ?? '',
      } as RuleShape['args']
    case 'if_not_done_within':
      return {
        predicate: 'if_not_done_within',
        after_block: afterBlock,
        offset_iso: extra ?? 'P14D',
      } as RuleShape['args']
    case 'event':
      return {
        predicate: 'event',
        after_block: afterBlock,
        event_type: extra ?? '',
      } as RuleShape['args']
  }
}

function extraOf(rule: RuleShape): string {
  const args = rule.args as Record<string, unknown>
  if (typeof args.output_key === 'string') return args.output_key
  if (typeof args.offset_iso === 'string' && predicateOf(rule) === 'if_not_done_within')
    return args.offset_iso
  if (typeof args.event_type === 'string') return args.event_type
  return ''
}

export function InputLogicEditor({ value, upstreamBlocks, onChange }: Props): ReactElement {
  const { t } = useTranslation('pathway')
  const rules = value.rules ?? []

  function setRule(index: number, predicate: ComposerPredicate, afterBlock: string, extra?: string) {
    const next = rules.map((rule, i) =>
      i === index
        ? { node: afterBlock, args: buildArgs(predicate, afterBlock, extra) }
        : rule,
    )
    onChange({ ...value, rules: next })
  }

  function addRule() {
    const first = upstreamBlocks[0]
    if (!first) return
    onChange({
      ...value,
      rules: [...rules, { node: first.id, args: buildArgs('if_done', first.id) }],
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
        const composerPredicate = (
          COMPOSER_PREDICATES as readonly string[]
        ).includes(predicate)
          ? (predicate as ComposerPredicate)
          : null
        const afterBlock = rule.node
        const upstream = upstreamBlocks.find((b) => b.id === afterBlock)
        // Rules authored outside the composer (e.g. wait_after markers)
        // render read-only so we never mangle their args.
        if (!composerPredicate) {
          return (
            <div
              key={index}
              className="flex items-center justify-between rounded-md border bg-muted/40 px-2.5 py-1.5 text-[12px] text-muted-foreground"
            >
              <span>
                {predicate} · {upstream?.name ?? afterBlock}
              </span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                aria-label={t('inputLogic.removeRule', { defaultValue: 'Regel verwijderen' })}
                onClick={() => removeRule(index)}
              >
                <Trash2 className="size-3.5" />
              </Button>
            </div>
          )
        }
        const extra = extraOf(rule)
        return (
          <div key={index} className="flex items-center gap-1.5 rounded-md border px-2 py-1.5">
            <Select
              value={composerPredicate}
              onValueChange={(p) => setRule(index, p as ComposerPredicate, afterBlock, extra)}
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
              onValueChange={(blockId) => setRule(index, composerPredicate, blockId, extra)}
            >
              <SelectTrigger className="h-8 flex-1 text-[12px]">
                <SelectValue
                  placeholder={t('inputLogic.pickBlock', { defaultValue: 'Kies blok' })}
                />
              </SelectTrigger>
              <SelectContent>
                {upstreamBlocks.map((b) => (
                  <SelectItem key={b.id} value={b.id}>
                    {b.name || b.id.slice(0, 8)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {composerPredicate !== 'if_done' && (
              <Input
                aria-label={t(`inputLogic.extra.${composerPredicate}`, {
                  defaultValue: 'detail',
                })}
                value={extra}
                placeholder={
                  composerPredicate === 'decision_output'
                    ? t('inputLogic.extraPlaceholder.output', { defaultValue: 'output (bv. goed)' })
                    : composerPredicate === 'if_not_done_within'
                      ? 'P14D'
                      : t('inputLogic.extraPlaceholder.event', { defaultValue: 'event type' })
                }
                onChange={(e) => setRule(index, composerPredicate, afterBlock, e.target.value)}
                className="h-8 w-[130px] text-[12px]"
              />
            )}
            <Button
              type="button"
              variant="ghost"
              size="icon"
              aria-label={t('inputLogic.removeRule', { defaultValue: 'Regel verwijderen' })}
              onClick={() => removeRule(index)}
            >
              <Trash2 className="size-3.5" />
            </Button>
          </div>
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
