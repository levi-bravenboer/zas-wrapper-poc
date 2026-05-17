import type { OrganisationRead, OrganisationTreeMove } from '../schemas'

// Apply the editor's staged moves to a fresh-from-cache organisation list,
// returning a new array with each moved row's `parent_organisation_id` /
// `sort_index` overridden. Used by the editor to render optimistically
// without waiting for the Save round-trip.

export function applyMovesOverlay(
  orgs: readonly OrganisationRead[],
  pendingMoves: ReadonlyMap<string, OrganisationTreeMove>,
): OrganisationRead[] {
  if (pendingMoves.size === 0) return orgs.slice()
  return orgs.map((org) => {
    const move = pendingMoves.get(org.id)
    if (!move) return org
    return {
      ...org,
      parent_organisation_id: move.parent_organisation_id,
      sort_index: move.sort_index,
    }
  })
}
