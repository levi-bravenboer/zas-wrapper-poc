"""External-subject input validation.

Belgian Wet 8 augustus 1983 (Rijksregisterwet) governs the Rijksregisternummer
(RRN). Storing an RRN on our side requires Sectoral Committee authorization —
we do not have it and the broker (NewWave Care) keeps the RRN on its side.
This module rejects RRN-shaped strings before they can land in
`users.external_subject`.

Format reference: RRN is 11 digits `YYMMDDXXXCD` where:
  - `YYMMDD` = birth date (YY can roll past 1999, validity check below ignores it)
  - `XXX`    = sequence number (odd = male, even = female)
  - `CD`     = mod-97 check on the first 9 digits; for births in 2000+ a `2`
               is prepended before computing the mod-97.
"""

from __future__ import annotations

import re

from app.core.errors import AppError


class InvalidExternalSubjectError(AppError):
    code = "validation.auth.external_subject_invalid"
    status_code = 400
    message = "External subject is not a valid IdP-issued opaque identifier."


_DIGITS_11 = re.compile(r"^\d{11}$")


def _looks_like_rrn(value: str) -> bool:
    if not _DIGITS_11.match(value):
        return False
    body = int(value[:9])
    check = int(value[9:])
    if (97 - body % 97) == check:
        return True
    body_2000 = int("2" + value[:9])
    return (97 - body_2000 % 97) == check


def validate_external_subject(value: str) -> None:
    if _looks_like_rrn(value):
        raise InvalidExternalSubjectError()
