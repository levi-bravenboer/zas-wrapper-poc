"""Shared helpers for `tests/scripts/*` modules.

Script entry-points call `asyncio.run`, which collides with the pytest-asyncio
session loop — so we exercise their wiring via subprocess instead.
"""

from __future__ import annotations

import subprocess
import sys
from pathlib import Path

BACKEND_ROOT = Path(__file__).resolve().parents[2]


def run_script_subprocess(module: str) -> subprocess.CompletedProcess[str]:
    """Run `python -m <module>` from the backend root and capture output.

    Returns the `CompletedProcess` so tests can assert on `returncode`,
    `stdout`, or `stderr` as needed.
    """

    return subprocess.run(
        [sys.executable, "-m", module],
        cwd=BACKEND_ROOT,
        capture_output=True,
        text=True,
        check=False,
    )
