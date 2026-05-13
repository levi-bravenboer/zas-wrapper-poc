"""Offline OpenAPI exporter.

Run via `uv run python -m app.openapi` (or the Moon task `backend:openapi`).
Writes the current schema to `apps/backend/openapi.json` so the orchestrator
can run typegen without a live dev server.
"""

from __future__ import annotations

import json
from pathlib import Path

from app.main import create_app

OUTPUT_PATH = Path(__file__).resolve().parent.parent / "openapi.json"


def dump() -> Path:
    app = create_app()
    schema = app.openapi()
    OUTPUT_PATH.write_text(json.dumps(schema, indent=2) + "\n", encoding="utf-8")
    return OUTPUT_PATH


def main() -> None:
    path = dump()
    print(f"wrote {path}")


if __name__ == "__main__":
    main()
