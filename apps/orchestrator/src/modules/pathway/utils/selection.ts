import type { PathwayBlock } from '../types'
import type { BuilderSelection } from '../useBuilderState'

export function selectedBlockId(selection: BuilderSelection): string | null {
  return selection.kind === 'block' ? selection.blockId : null
}

export function findSelectedBlock(
  selection: BuilderSelection,
  blocks: readonly PathwayBlock[],
): PathwayBlock | null {
  const id = selectedBlockId(selection)
  if (!id) return null
  return blocks.find((b) => b.id === id) ?? null
}
