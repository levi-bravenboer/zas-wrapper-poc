from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from app.schemas.pathway.pathway import PathwayBlockIn
from app.services.pathway.errors import NestedPathwayCycleError

if TYPE_CHECKING:
    from app.repositories.pathway.pathway_repository import PathwayRepository


# Depth cap for the ancestor-chain walk. Bounded so a pre-existing cycle in
# the data (which the same guard prevents going forward) cannot make the
# traversal loop forever; also keeps the cost predictable for deep but
# legitimate nesting graphs.
MAX_NESTED_PATHWAY_DEPTH = 8


async def assert_no_nested_pathway_cycles(
    *,
    blocks: list[PathwayBlockIn],
    parent_pathway_id: UUID,
    tenant_id: UUID,
    repo: PathwayRepository,
    max_depth: int = MAX_NESTED_PATHWAY_DEPTH,
) -> None:
    """Reject `pathway_link` blocks that would introduce a cycle.

    Cycle kinds covered:
    - **self**: a `pathway_link` targeting `parent_pathway_id` itself.
    - **ancestor**: a `pathway_link` whose target appears in the parent's
      ancestor chain — pathways that already contain a `pathway_link`
      reaching the parent transitively, walked up to `max_depth` levels.

    Walks via `repo.find_pathway_link_parents` once per level; deduplicates
    visited ids so an existing cycle in the data (defensive) terminates.
    """
    proposed: list[tuple[UUID, UUID]] = []
    for block in blocks:
        if block.kind != "pathway_link":
            continue
        target_raw = (block.config or {}).get("target_pathway_id")
        if not target_raw:
            continue
        try:
            target_id = UUID(str(target_raw))
        except (TypeError, ValueError):
            continue
        proposed.append((block.id, target_id))

    if not proposed:
        return

    # Self-link rejection is independent of any DB walk.
    for block_id, target_id in proposed:
        if target_id == parent_pathway_id:
            raise NestedPathwayCycleError(
                block_id=block_id,
                parent_pathway_id=parent_pathway_id,
                target_pathway_id=target_id,
                kind="self",
            )

    # Build the ancestor closure of `parent_pathway_id` up to `max_depth`.
    ancestors: set[UUID] = set()
    frontier: set[UUID] = {parent_pathway_id}
    for _ in range(max_depth):
        if not frontier:
            break
        next_parents = await repo.find_pathway_link_parents(frontier, tenant_id)
        next_parents -= ancestors
        next_parents.discard(parent_pathway_id)
        if not next_parents:
            break
        ancestors |= next_parents
        frontier = next_parents

    if not ancestors:
        return

    for block_id, target_id in proposed:
        if target_id in ancestors:
            raise NestedPathwayCycleError(
                block_id=block_id,
                parent_pathway_id=parent_pathway_id,
                target_pathway_id=target_id,
                kind="ancestor",
            )
