"""Parser for `pathway_block.type` codes.

Two shapes are accepted:

- **Bare** — block types whose code is a single word: ``appointment``,
  ``task``, ``pathway_link``.
- **Dotted** — block types whose code carries a vendor namespace:
  ``luscii.program``, ``hix.task``.

The lexical shape is enforced both here and by the DB CHECK constraint on
``pathway_block.type``. The *semantic* check — "this ``(provider, kind)``
pair is registered in the catalogue" — happens app-side via
``BLOCK_TYPES`` lookup; this parser only handles string structure.

This module exposes purely lexical facts. The **logical** classification
(native / external / internal) lives on the catalogue ``BlockTypeEntry``,
not here — bare codes can be either ``native`` (e.g. ``appointment``) or
``internal`` (e.g. ``pathway_link``), and the parser cannot tell which
from the string alone.
"""

from __future__ import annotations

import re
from dataclasses import dataclass

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
    """Parsed block-type code.

    Construction goes through :meth:`parse`. ``provider`` is ``None`` for
    bare codes; for dotted codes both ``provider`` and ``kind`` are
    non-empty strings.

    Examples
    --------
    >>> BlockTypeCode.parse("appointment")
    BlockTypeCode(raw='appointment', provider=None, kind=None)

    >>> BlockTypeCode.parse("luscii.program")
    BlockTypeCode(raw='luscii.program', provider='luscii', kind='program')
    """

    raw: str
    provider: str | None
    kind: str | None

    @classmethod
    def parse(cls, raw: object) -> "BlockTypeCode":
        if not isinstance(raw, str) or not BLOCK_TYPE_CODE_PATTERN.fullmatch(raw):
            raise InvalidBlockTypeCodeError(raw)
        if "." in raw:
            provider, kind = raw.split(".", 1)
            return cls(raw=raw, provider=provider, kind=kind)
        return cls(raw=raw, provider=None, kind=None)

    @property
    def is_dotted(self) -> bool:
        return self.provider is not None

    def __str__(self) -> str:
        return self.raw


__all__ = [
    "BLOCK_TYPE_CODE_PATTERN",
    "BlockTypeCode",
    "InvalidBlockTypeCodeError",
]
