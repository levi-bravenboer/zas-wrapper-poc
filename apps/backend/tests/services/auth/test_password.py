from __future__ import annotations

from app.services.auth.password import PasswordHasher


def test_password_hash_round_trip() -> None:
    hasher = PasswordHasher()
    hashed = hasher.hash("s3cret")
    assert hashed != "s3cret"
    assert hasher.verify(hashed, "s3cret") is True


def test_password_verify_rejects_wrong_password() -> None:
    hasher = PasswordHasher()
    hashed = hasher.hash("s3cret")
    assert hasher.verify(hashed, "wrong") is False


def test_password_verify_rejects_invalid_hash() -> None:
    hasher = PasswordHasher()
    assert hasher.verify("not-a-hash", "s3cret") is False
