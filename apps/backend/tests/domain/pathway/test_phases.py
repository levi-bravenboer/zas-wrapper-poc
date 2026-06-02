from __future__ import annotations

from app.domain.pathway import PHASE_TEMPLATES, get_phase_template


def test_phase_templates_have_unique_ids() -> None:
    ids = [t.id for t in PHASE_TEMPLATES]
    assert len(ids) == len(set(ids))


def test_phase_templates_are_ordered_by_default_ord() -> None:
    ords = [t.default_ord for t in PHASE_TEMPLATES]
    assert ords == sorted(ords), "PHASE_TEMPLATES order should match default_ord asc"


def test_get_phase_template_resolves_known_id() -> None:
    assert get_phase_template("pre-op") is not None
    assert get_phase_template("surgery") is not None


def test_get_phase_template_returns_none_for_unknown_id() -> None:
    assert get_phase_template("not-a-template") is None
