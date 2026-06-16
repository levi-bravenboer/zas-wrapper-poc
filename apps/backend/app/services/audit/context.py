"""Typed payloads for the two jsonb columns on `audit_events`.

Storage stays `jsonb`; these models type the emit + read boundary so the
columns do not rot into inconsistent dict bags.

`request_id` is intentionally NOT here — it is a first-class indexed column
on `AuditEvent` for log correlation.
"""

from __future__ import annotations

from ipaddress import IPv4Address, IPv6Address

from pydantic import BaseModel, JsonValue


class FieldChange(BaseModel):
    """One column's before/after. Named fields beat a positional `[old, new]`."""

    old: JsonValue | None = None
    new: JsonValue | None = None


class AuditContext(BaseModel, extra="allow"):
    """Free-form event metadata with known keys typed. Extras allowed so each
    feed can attach its own context without a schema change.
    """

    ip: IPv4Address | IPv6Address | None = None
    user_agent: str | None = None
    reason: str | None = None
