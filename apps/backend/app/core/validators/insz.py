"""Belgian INSZ (Rijksregisternummer / National Number) checksum validator.

An INSZ is an 11-digit number. The first 6 digits encode the birth date
(YYMMDD), the next 3 are a daily counter, and the final 2 are a Mod-97
check on the leading 9 digits:

- For people born **before** 2000-01-01:
    `check == 97 - (int(serial9) mod 97)`
- For people born **on or after** 2000-01-01:
    `check == 97 - (int("2" + serial9) mod 97)`

We do not know the birth year from the INSZ alone (YY is ambiguous), so
the validator accepts a value if **either** rule produces the trailing
two digits. That matches the eHealth reference implementation.

This module is intentionally dependency-free so it can be imported from
Pydantic validators, the seed script's INSZ generator, and unit tests
without pulling in anything else.
"""

from __future__ import annotations


def is_valid_insz(value: str) -> bool:
    """Return True iff `value` is a Mod-97-valid 11-digit INSZ.

    Non-digit characters, wrong length, or a checksum mismatch under both
    pre-/post-2000 rules all yield False. Whitespace and punctuation MUST
    be stripped by the caller — the validator is strict so callers cannot
    accidentally accept loosely-formatted input.
    """
    if not isinstance(value, str) or len(value) != 11 or not value.isdigit():
        return False
    serial = value[:9]
    check = int(value[9:])
    pre_2000 = 97 - (int(serial) % 97)
    post_2000 = 97 - (int("2" + serial) % 97)
    return check in (pre_2000, post_2000)
