"""Standalone operational scripts.

Each module is a single-purpose entry point invoked as
`python -m scripts.<name>` (or `python scripts/<name>.py`). Scripts MUST be
idempotent — re-running is a no-op when target rows are already present.
Helpers used by tests live alongside the script and are importable.

Importing this package installs the session-level audit hooks so seed
scripts (which never import `app.main`) get the same `before_flush`
auto-stamping behaviour as the FastAPI app.
"""

from app.db.audit import install_audit_hooks
from app.realtime import install_realtime_flush_hook

install_audit_hooks()
install_realtime_flush_hook()
