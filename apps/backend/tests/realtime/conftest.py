"""Re-export the `two_tenants` + `_DemoModel` fixtures from the list-base tests.

The same `TenantOwnedEntity` test model exercises the realtime flush hook —
this avoids defining a parallel `__realtime_resource__`-bearing model.
"""

from __future__ import annotations

from tests.repositories._list.conftest import two_tenants  # noqa: F401
