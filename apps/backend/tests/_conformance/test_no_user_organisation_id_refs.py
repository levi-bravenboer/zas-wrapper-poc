"""Source-level guard: nothing reads `user.organisation_id`.

`practitioner-role-split` dropped the `users.organisation_id` column.
Affiliation now lives on `PractitionerRole` rows. This test scans the
`app/` tree for accidental references that would re-introduce the
removed concept; migration files are excluded because they intentionally
mention the column in upgrade/downgrade backfill logic.
"""

from __future__ import annotations

import re
from pathlib import Path

_APP_ROOT = Path(__file__).resolve().parents[2] / "app"
_PATTERN = re.compile(r"\buser\.organisation_id\b|\bUser\.organisation_id\b")


def test_no_user_organisation_id_references() -> None:
    offenders: list[str] = []
    for path in _APP_ROOT.rglob("*.py"):
        text = path.read_text(encoding="utf-8")
        for lineno, line in enumerate(text.splitlines(), start=1):
            if _PATTERN.search(line):
                offenders.append(f"{path.relative_to(_APP_ROOT.parent)}:{lineno}: {line.strip()}")
    assert not offenders, "stale user.organisation_id references:\n" + "\n".join(offenders)
