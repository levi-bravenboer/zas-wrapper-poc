"""Helpers shared across the pathway domain registries.

`object_schema` builds the JSON Schema Draft 2020-12 object form every
config_schema in the domain follows — `additionalProperties: false`, optional
`required` list. Used by block entries and edge timing kinds alike, so it
sits one level up from `blocks/_base.py` rather than inside the block
subpackage.
"""

from __future__ import annotations

from typing import Any


def object_schema(
    properties: dict[str, dict[str, Any]],
    required: list[str] | None = None,
) -> dict[str, Any]:
    schema: dict[str, Any] = {
        "$schema": "https://json-schema.org/draft/2020-12/schema",
        "type": "object",
        "additionalProperties": False,
        "properties": properties,
    }
    if required:
        schema["required"] = required
    return schema


__all__ = ["object_schema"]
