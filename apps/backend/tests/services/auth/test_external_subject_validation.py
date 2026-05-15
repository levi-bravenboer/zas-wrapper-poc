from __future__ import annotations

import pytest

from app.services.auth.providers import (
    InvalidExternalSubjectError,
    validate_external_subject,
)

# Valid Belgian RRN test value (mod-97 check satisfied) — born 1985-07-12,
# sequence 345 → 850712345 mod 97 == 35 → check digits 97-35 == 62.
_VALID_RRN = "85071234562"


def test_rrn_shaped_value_rejected() -> None:
    with pytest.raises(InvalidExternalSubjectError):
        validate_external_subject(_VALID_RRN)


def test_itsme_opaque_subject_passes() -> None:
    validate_external_subject("itsme-1234-abcd-9999-zzzz")


def test_non_numeric_passes() -> None:
    validate_external_subject("BE-eID-subject-AB12CD34")


def test_ten_digit_numeric_passes() -> None:
    validate_external_subject("1234567890")


def test_twelve_digit_numeric_passes() -> None:
    validate_external_subject("123456789012")


def test_eleven_digit_with_wrong_check_passes() -> None:
    # An IdP-issued opaque sub that happens to be 11 digits but does NOT pass
    # the mod-97 check MUST NOT be rejected.
    validate_external_subject("12345678900")
