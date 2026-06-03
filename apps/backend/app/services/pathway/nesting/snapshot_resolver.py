from __future__ import annotations

from typing import TYPE_CHECKING
from uuid import UUID

from sqlalchemy import select

from app.db.models.pathway import PathwayBlock
from app.services.pathway.errors import BlockConfigError

if TYPE_CHECKING:
    from sqlalchemy.ext.asyncio import AsyncSession

    from app.repositories.pathway.pathway_version_repository import (
        PathwayVersionRepository,
    )


async def resolve_pathway_link_snapshots(
    *,
    session: AsyncSession,
    pathway_version_id: UUID,
    version_repo: PathwayVersionRepository,
) -> None:
    """Walk every non-deleted `pathway_link` block in `pathway_version_id` and
    populate its `snapshot_json` per the nested-pathway-blocks spec rules.

    Run inside the publish flow before the version flips to `published`. After
    this returns the row is durable enough that re-resolving `latest_published`
    later won't silently re-bind a parent to a newer child version.

    Rules:
    - `version_pin='specific'`: snapshot the configured `pinned_version_id`
      verbatim. Cross-DB ownership is already enforced at save time
      (see `PathwayService._validate_pathway_link_pinned_versions`).
    - `version_pin='latest_published'` (default): snapshot the current latest
      published version of the target pathway. If the target has no published
      version, publish MUST fail with `BlockConfigError` — the parent cannot
      reference an unresolvable child.
    """
    stmt = select(PathwayBlock).where(
        PathwayBlock.pathway_version_id == pathway_version_id,
        PathwayBlock.deleted_at.is_(None),
        PathwayBlock.type == "pathway_link",
    )
    result = await session.execute(stmt)
    blocks = result.scalars().all()

    for block in blocks:
        config = block.config or {}
        try:
            target_pathway_id = UUID(str(config["target_pathway_id"]))
        except (KeyError, TypeError, ValueError):
            # Required by JSON schema; if missing the version should never
            # have persisted. Skip defensively rather than crash publish.
            continue

        version_pin = config.get("version_pin", "latest_published")

        if version_pin == "specific":
            pinned_raw = config.get("pinned_version_id")
            if not pinned_raw:
                # JSON schema + service validation already reject this; skip.
                continue
            try:
                pinned_version_id = UUID(str(pinned_raw))
            except (TypeError, ValueError):
                continue
            block.snapshot_json = {
                "target_pathway_id": str(target_pathway_id),
                "resolved_version_id": str(pinned_version_id),
                "tracking": "specific",
            }
            continue

        # latest_published path
        latest = await version_repo.get_latest_published(target_pathway_id)
        if latest is None:
            raise BlockConfigError(
                field=f"blocks[{block.id}].config.version_pin",
                reason=(
                    "pathway_link with version_pin='latest_published' cannot "
                    "publish: target pathway has no published version"
                ),
            )
        block.snapshot_json = {
            "target_pathway_id": str(target_pathway_id),
            "resolved_version_id": str(latest.id),
            "tracking": "latest_published",
        }
