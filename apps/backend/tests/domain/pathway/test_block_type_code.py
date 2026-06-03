from __future__ import annotations

import pytest

from app.domain.pathway import (
    BLOCK_TYPE_CODE_PATTERN,
    BlockTypeCode,
    InvalidBlockTypeCodeError,
)


class TestParseBare:
    @pytest.mark.parametrize(
        "raw",
        ["appointment", "task", "message", "form", "decision", "milestone", "wait", "pathway_link"],
    )
    def test_bare_codes_parse_with_null_provider_and_kind(self, raw: str) -> None:
        code = BlockTypeCode.parse(raw)
        assert code.raw == raw
        assert code.provider is None
        assert code.kind is None
        assert code.is_dotted is False
        assert str(code) == raw

    def test_snake_case_bare_code(self) -> None:
        code = BlockTypeCode.parse("pathway_link")
        assert code.provider is None
        assert code.kind is None


class TestParseDotted:
    def test_luscii_program_parses_provider_and_kind(self) -> None:
        code = BlockTypeCode.parse("luscii.program")
        assert code.raw == "luscii.program"
        assert code.provider == "luscii"
        assert code.kind == "program"
        assert code.is_dotted is True

    def test_arbitrary_external_provider_kind_pair(self) -> None:
        code = BlockTypeCode.parse("hix.task")
        assert code.provider == "hix"
        assert code.kind == "task"
        assert code.is_dotted is True

    def test_snake_case_provider_and_kind(self) -> None:
        code = BlockTypeCode.parse("zorg_bij_jou.intake_form")
        assert code.provider == "zorg_bij_jou"
        assert code.kind == "intake_form"


class TestParseRejects:
    @pytest.mark.parametrize(
        "raw",
        [
            "",
            "Foo",  # uppercase
            "foo.Bar",  # uppercase in kind
            "Luscii.program",  # uppercase in provider
            "foo..bar",  # empty segment
            "foo.",  # trailing dot
            ".bar",  # leading dot
            "foo.bar.baz",  # three segments
            "foo bar",  # space
            "foo-bar",  # hyphen
            "foo1",  # digit
            "1foo",  # leading digit
            "  ",
        ],
    )
    def test_invalid_strings_raise(self, raw: str) -> None:
        with pytest.raises(InvalidBlockTypeCodeError) as excinfo:
            BlockTypeCode.parse(raw)
        assert excinfo.value.raw == raw

    @pytest.mark.parametrize("raw", [None, 42, [], {}, object()])
    def test_non_string_inputs_raise(self, raw: object) -> None:
        with pytest.raises(InvalidBlockTypeCodeError):
            BlockTypeCode.parse(raw)


class TestPatternConsistency:
    """The DB CHECK constraint mirrors BLOCK_TYPE_CODE_PATTERN — keep them aligned."""

    def test_pattern_is_anchored(self) -> None:
        # fullmatch use requires the pattern to anchor implicitly; assert the
        # explicit ^…$ form so future edits don't accidentally drop anchors
        # and break the parity with the DB CHECK regex.
        assert BLOCK_TYPE_CODE_PATTERN.pattern.startswith("^")
        assert BLOCK_TYPE_CODE_PATTERN.pattern.endswith("$")

    def test_pattern_accepts_known_codes(self) -> None:
        for raw in ("appointment", "luscii.program", "hix.task", "wait", "pathway_link"):
            assert BLOCK_TYPE_CODE_PATTERN.fullmatch(raw) is not None

    def test_pattern_rejects_known_bad_codes(self) -> None:
        for raw in ("", "Foo", "foo..bar", "foo.bar.baz", "foo-bar", "1foo"):
            assert BLOCK_TYPE_CODE_PATTERN.fullmatch(raw) is None
