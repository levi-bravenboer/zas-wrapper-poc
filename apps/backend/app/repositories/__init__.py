"""Data-access layer. Per-domain repositories live under
`app/repositories/<domain>/<domain>_repository.py` and subclass
`BaseRepository`. See `apps/backend/AGENTS.md` for the layer contract.
"""

from app.repositories.base import BaseRepository

__all__ = ["BaseRepository"]
