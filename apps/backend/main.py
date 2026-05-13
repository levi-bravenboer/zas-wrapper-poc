"""Thin entrypoint — the real FastAPI app lives in `app/main.py`.

This module exists so `uv run fastapi dev main.py` still works at the repo root.
All routes, factories, and configuration are in the `app/` package.
"""

from app.main import app

__all__ = ["app"]
