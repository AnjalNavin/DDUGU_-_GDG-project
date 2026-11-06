"""Configuration parsing tests."""

from __future__ import annotations

from app.config import Settings


def test_cors_origins_accepts_comma_separated_environment(monkeypatch):
    monkeypatch.setenv(
        "CORS_ORIGINS", "http://one.example.com, http://two.example.com"
    )
    settings = Settings()
    assert settings.cors_origins == [
        "http://one.example.com",
        "http://two.example.com",
    ]


def test_cors_origins_defaults_when_unset(monkeypatch):
    monkeypatch.delenv("CORS_ORIGINS", raising=False)
    settings = Settings(_env_file=None)
    assert "http://localhost:5173" in settings.cors_origins
