"""Internal test helper for constructing isolated Settings.

`Settings(_env_file=None, ...)` is the documented pydantic-settings escape
hatch but pyright can't see it through the BaseSettings signature, so the
ignore comment is centralised here.
"""

from __future__ import annotations

from typing import Any

from app.core.settings import Settings


def build_settings(**overrides: Any) -> Settings:
    return Settings(_env_file=None, **overrides)  # pyright: ignore[reportCallIssue]
