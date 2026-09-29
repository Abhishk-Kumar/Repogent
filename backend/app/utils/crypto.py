"""Cryptographic utilities for API key hashing (SHA256 with salt)."""
import secrets
import hashlib

SALT_BYTES = 16
PREFIX_LENGTH = 8


def generate_api_key() -> tuple[str, str, str]:
    """
    Generate a new API key.
    Returns: (full_key, prefix, key_hash)
    - full_key: the complete key to give to user (shown once)
    - prefix: first 8 chars for identification in DB
    - key_hash: salted SHA256 hash for storage
    """
    raw = secrets.token_hex(16)  # 32 hex chars = 16 bytes
    prefix = raw[:PREFIX_LENGTH]
    salt = secrets.token_hex(SALT_BYTES)
    key_hash = hashlib.sha256((salt + raw).encode()).hexdigest()
    # Store as "salt:hash" for verification
    return raw, prefix, f"{salt}:{key_hash}"


def verify_api_key(plain_key: str, key_hash: str) -> bool:
    """Verify a plain API key against its salted SHA256 hash."""
    try:
        if ":" not in key_hash:
            return False
        salt, stored_hash = key_hash.split(":", 1)
        computed_hash = hashlib.sha256((salt + plain_key).encode()).hexdigest()
        return secrets.compare_digest(computed_hash, stored_hash)
    except Exception:
        return False


def hash_key_for_storage(key: str) -> str:
    """Hash a key for storage (salted SHA256)."""
    salt = secrets.token_hex(SALT_BYTES)
    key_hash = hashlib.sha256((salt + key).encode()).hexdigest()
    return f"{salt}:{key_hash}"