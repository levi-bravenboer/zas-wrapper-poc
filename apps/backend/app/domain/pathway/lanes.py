"""Pathway lane-kind registry.

Lane kinds are the four canonical actor swimlanes a hospital can place a
block on. The constants name each kind so block-type definitions and
service-layer validation can reference them without stringy literals.

`SEEDED_LANE_KINDS` is the code-owned seed for the `pathway_lane_kind`
table; the table exists only as an FK target for `pathway_lane`.
"""

from __future__ import annotations


LANE_KIND_PATIENT = "patient"
LANE_KIND_CAREGIVER = "caregiver"
LANE_KIND_SYSTEM = "system"
LANE_KIND_EXTERNAL = "external"


SEEDED_LANE_KINDS: tuple[tuple[str, str], ...] = (
    (LANE_KIND_PATIENT, "Patient"),
    (LANE_KIND_CAREGIVER, "Caregiver"),
    (LANE_KIND_SYSTEM, "System"),
    (LANE_KIND_EXTERNAL, "External"),
)


__all__ = [
    "LANE_KIND_CAREGIVER",
    "LANE_KIND_EXTERNAL",
    "LANE_KIND_PATIENT",
    "LANE_KIND_SYSTEM",
    "SEEDED_LANE_KINDS",
]
