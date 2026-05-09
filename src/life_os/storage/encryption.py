"""Age-based encryption for the private bucket.

We shell out to the `age` binary rather than wrap a library: `age` is a single
static binary, runs without admin on Windows, and the same code path works on
macOS/Linux.

Threat model: a passphrase-protected age identity at ~/.life-os/age.key
encrypts the identity itself; entries in journal/private/ are encrypted to
that identity. `journal unlock` decrypts a working tree under data/private/
that is wiped on `journal lock`.
"""
from __future__ import annotations

import shutil
import subprocess
from pathlib import Path

from .. import config


class AgeError(RuntimeError):
    pass


def age_available() -> bool:
    return shutil.which(config.get_age_bin()) is not None


def _run(args: list[str], input_bytes: bytes | None = None) -> bytes:
    try:
        proc = subprocess.run(
            args,
            input=input_bytes,
            capture_output=True,
            check=False,
        )
    except FileNotFoundError as exc:
        raise AgeError(
            f"`{config.get_age_bin()}` not found on PATH. Install age (https://age-encryption.org)."
        ) from exc
    if proc.returncode != 0:
        stderr = proc.stderr.decode("utf-8", errors="replace").strip()
        raise AgeError(stderr or f"age exited with {proc.returncode}")
    return proc.stdout


def generate_identity(key_path: Path, passphrase: str | None = None) -> Path:
    """Create a new age identity, optionally passphrase-encrypted."""
    key_path.parent.mkdir(parents=True, exist_ok=True)
    age_bin = config.get_age_bin()
    keygen_bin = shutil.which("age-keygen")
    if not keygen_bin:
        raise AgeError("`age-keygen` not found on PATH.")
    raw = subprocess.run([keygen_bin], capture_output=True, check=True).stdout
    if passphrase:
        encrypted = subprocess.run(
            [age_bin, "-p", "-a"],
            input=raw,
            capture_output=True,
            check=True,
            env={"AGE_PASSPHRASE": passphrase},
        ).stdout
        key_path.write_bytes(encrypted)
    else:
        key_path.write_bytes(raw)
    try:
        key_path.chmod(0o600)
    except OSError:
        pass
    return key_path


def public_recipient(key_path: Path, passphrase: str | None = None) -> str:
    """Extract the public recipient string from an identity file."""
    raw = key_path.read_bytes()
    if raw.startswith(b"-----BEGIN AGE ENCRYPTED FILE-----"):
        if passphrase is None:
            raise AgeError("Identity file is passphrase-protected; supply a passphrase.")
        raw = _run([config.get_age_bin(), "-d"], input_bytes=raw)
    for line in raw.decode("utf-8").splitlines():
        if line.startswith("# public key:"):
            return line.split(":", 1)[1].strip()
    raise AgeError("Could not extract public key from age identity file.")


def encrypt_to_recipient(plaintext: bytes, recipient: str) -> bytes:
    return _run([config.get_age_bin(), "-r", recipient, "-a"], input_bytes=plaintext)


def decrypt_with_identity(ciphertext: bytes, key_path: Path, passphrase: str | None = None) -> bytes:
    if passphrase is not None:
        identity_data = _run([config.get_age_bin(), "-d"], input_bytes=key_path.read_bytes())
        # age accepts identities via -i FILE. Write the decrypted identity to a
        # secure temp file the kernel can hand to age, then unlink.
        import tempfile

        with tempfile.NamedTemporaryFile("wb", delete=False) as tmp:
            tmp.write(identity_data)
            identity_file = Path(tmp.name)
        try:
            return _run([config.get_age_bin(), "-d", "-i", str(identity_file)], input_bytes=ciphertext)
        finally:
            identity_file.unlink(missing_ok=True)
    return _run([config.get_age_bin(), "-d", "-i", str(key_path)], input_bytes=ciphertext)
