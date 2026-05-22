"""Parser for `pathway_block.type` codes.

Two shapes are accepted:

- **Bare** — native block types contributed by code-owned catalogue
  (e.g. ``appointment``, ``task``, ``pathway_link``).
- **Dotted** — external-provider blocks contributed by the
  ``external_block_provider`` registry (e.g. ``luscii.program``).

The lexical shape is enforced both here and by the DB CHECK constraint
on ``pathway_block.type`` (added in the same change). The *semantic*
validation — "this ``(provider, kind)`` pair exists in the registry"
— happens app-side via the registry lookup; this parser only handles
the string shape.

Centralising the parse in a single value object keeps every callsite
type-safe about whether a block is native vs external without having
to scatter ``"." in code`` checks across services.
"""

from __future__ import annotations

import re
from dataclasses import dataclass
from typing import Literal

BlockSource = Literal["native", "external"]

# Bare:    appointment, task, pathway_link, ...
# Dotted:  luscii.program, hix.task, ...
# Forbids: Foo, foo.Bar, foo..bar, foo., .bar, foo.bar.baz, empty string
BLOCK_TYPE_CODE_PATTERN = re.compile(r"^[a-z_]+(\.[a-z_]+)?$")


class InvalidBlockTypeCodeError(ValueError):
    """Raised when a string cannot be parsed as a valid block-type code."""

    def __init__(self, raw: object) -> None:
        super().__init__(
            f"invalid block type code {raw!r}; "
            f"expected pattern {BLOCK_TYPE_CODE_PATTERN.pattern}"
        )
        self.raw = raw


@dataclass(frozen=True, slots=True)
class BlockTypeCode:
    """Parsed block-type code carrying ``(source, provider, kind)`` provenance.

    Construction goes through :meth:`parse` so the lexical check is
    centralised. The dataclass itself is just the result of a successful
    parse — never construct it directly with unvalidated strings.

    Examples
    --------
    >>> BlockTypeCode.parse("appointment")
    BlockTypeCode(raw='appointment', source='native', provider=None, kind=None)

    >>> BlockTypeCode.parse("luscii.program")
    BlockTypeCode(raw='luscii.program', source='external', provider='luscii', kind='program')
    """

    raw: str
    source: BlockSource
    provider: str | None
    kind: str | None

    @classmethod
    def parse(cls, raw: object) -> "BlockTypeCode":
        if not isinstance(raw, str) or not BLOCK_TYPE_CODE_PATTERN.fullmatch(raw):
            raise InvalidBlockTypeCodeError(raw)
        if "." in raw:
            provider, kind = raw.split(".", 1)
            return cls(raw=raw, source="external", provider=provider, kind=kind)
        return cls(raw=raw, source="native", provider=None, kind=None)

    @property
    def is_external(self) -> bool:
        return self.source == "external"

    @property
    def is_native(self) -> bool:
        return self.source == "native"

    def __str__(self) -> str:
        return self.raw
