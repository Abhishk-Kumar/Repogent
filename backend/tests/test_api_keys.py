"""11.1 — MCP API-key crypto tests (09).

Keys hashed at rest; verification accepts the right key and rejects
wrong ones. No key material in logs (nothing printed here).
"""
from app.utils.crypto import generate_api_key, verify_api_key


def test_key_roundtrip_verifies():
    raw, prefix, key_hash = generate_api_key()
    assert raw.startswith(prefix)
    assert len(prefix) == 8
    assert key_hash != raw
    assert verify_api_key(raw, key_hash) is True


def test_wrong_key_rejected():
    raw, _, key_hash = generate_api_key()
    assert verify_api_key(raw + "x", key_hash) is False
    assert verify_api_key("", key_hash) is False
    assert verify_api_key(raw, "not-a-hash") is False


def test_keys_unique():
    raws = {generate_api_key()[0] for _ in range(10)}
    assert len(raws) == 10
