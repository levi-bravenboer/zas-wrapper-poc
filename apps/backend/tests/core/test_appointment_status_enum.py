from __future__ import annotations

from app.core.enums.appointment import AppointmentStatus


def test_entered_in_error_value_uses_underscore() -> None:
    """Python identifier legality — symbol uses underscore."""
    assert AppointmentStatus.ENTERED_IN_ERROR.value == "entered_in_error"


def test_all_fhir_codes_present() -> None:
    expected = {
        "proposed",
        "pending",
        "booked",
        "arrived",
        "fulfilled",
        "cancelled",
        "noshow",
        "entered_in_error",
        "checked_in",
        "waitlist",
    }
    assert {m.value for m in AppointmentStatus} == expected


def test_str_enum_round_trip() -> None:
    """`AppointmentStatus(value)` reconstructs the symbol from its wire value."""
    for member in AppointmentStatus:
        assert AppointmentStatus(member.value) is member
