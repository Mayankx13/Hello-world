from __future__ import annotations

from pathlib import Path

import pytest

from life_os.storage import encryption


@pytest.mark.skipif(not encryption.age_available(), reason="age binary not on PATH")
def test_age_roundtrip(tmp_path: Path):
    key = tmp_path / "age.key"
    encryption.generate_identity(key)
    recipient = encryption.public_recipient(key)
    plaintext = b"# private journal\n\nsecret stuff\n"
    ciphertext = encryption.encrypt_to_recipient(plaintext, recipient)
    assert ciphertext != plaintext
    decoded = encryption.decrypt_with_identity(ciphertext, key)
    assert decoded == plaintext
