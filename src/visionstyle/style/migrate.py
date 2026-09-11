"""Schema migrations for styles saved by older versions."""

from __future__ import annotations

from typing import Any

from visionstyle.style.schema import SCHEMA_VERSION


def migrate(data: dict[str, Any]) -> dict[str, Any]:
    """Upgrade a raw style dict in place to ``SCHEMA_VERSION``."""
    version = int(data.get("schema_version", SCHEMA_VERSION) or SCHEMA_VERSION)
    if version > SCHEMA_VERSION:
        raise ValueError(
            f"Style was saved with schema_version {version}, but this visionstyle only "
            f"understands up to {SCHEMA_VERSION}. Please upgrade visionstyle."
        )
    # Future: `if version < 2: ...` steps go here, each bumping `version`.
    data["schema_version"] = SCHEMA_VERSION
    return data
