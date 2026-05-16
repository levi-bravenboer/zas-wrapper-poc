from __future__ import annotations

import uuid

from app.services.organisation.predicates import is_external_for_root


def test_same_root_is_internal() -> None:
    root = uuid.uuid4()
    assert is_external_for_root(root, root) is False


def test_different_roots_are_external() -> None:
    assert is_external_for_root(uuid.uuid4(), uuid.uuid4()) is True


def test_unresolved_root_user_side_is_external() -> None:
    assert is_external_for_root(None, uuid.uuid4()) is True


def test_unresolved_root_patient_side_is_external() -> None:
    assert is_external_for_root(uuid.uuid4(), None) is True


def test_unresolved_both_sides_is_external() -> None:
    assert is_external_for_root(None, None) is True
