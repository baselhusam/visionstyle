"""Preset discovery: built-in YAML files, the user directory, and explicit paths."""

from __future__ import annotations

import os
import re
from dataclasses import dataclass
from pathlib import Path
from typing import TYPE_CHECKING, Literal

if TYPE_CHECKING:
    from visionstyle.style.schema import Style

_NAME_RE = re.compile(r"^[A-Za-z0-9][A-Za-z0-9_\-. ]{0,63}$")
ENV_PRESETS_DIR = "VISIONSTYLE_PRESETS_DIR"


@dataclass(frozen=True)
class PresetInfo:
    name: str
    path: Path
    origin: Literal["builtin", "user", "env"]
    description: str = ""


def builtin_presets_dir() -> Path:
    return Path(__file__).resolve().parent.parent / "presets"


def user_presets_dir() -> Path:
    return Path(os.environ.get("VISIONSTYLE_HOME", "~/.visionstyle")).expanduser() / "presets"


def env_presets_dir() -> Path | None:
    value = os.environ.get(ENV_PRESETS_DIR)
    return Path(value).expanduser() if value else None


def _search_dirs() -> list[tuple[Path, Literal["builtin", "user", "env"]]]:
    dirs: list[tuple[Path, Literal["builtin", "user", "env"]]] = []
    if env_dir := env_presets_dir():
        dirs.append((env_dir, "env"))
    dirs.append((user_presets_dir(), "user"))
    dirs.append((builtin_presets_dir(), "builtin"))
    return dirs


def _candidate_files(directory: Path, name: str) -> list[Path]:
    return [directory / f"{name}{ext}" for ext in (".yaml", ".yml", ".json")]


def resolve_preset_path(name: str, directory: str | Path | None = None) -> Path:
    """Find the file behind ``name``. Search order: explicit ``directory``, then
    ``$VISIONSTYLE_PRESETS_DIR``, ``~/.visionstyle/presets``, built-ins, then ``name`` as a path."""
    if directory is not None:
        for p in _candidate_files(Path(directory).expanduser(), name):
            if p.is_file():
                return p
    for d, _ in _search_dirs():
        for p in _candidate_files(d, name):
            if p.is_file():
                return p
    as_path = Path(name).expanduser()
    if as_path.is_file():
        return as_path
    available = ", ".join(sorted(p.name for p in list_presets()))
    raise FileNotFoundError(f"No preset named {name!r}. Available: {available}")


def load_preset(name: str, directory: str | Path | None = None) -> Style:
    from visionstyle.style.schema import Style

    path = resolve_preset_path(name, directory)
    text = path.read_text(encoding="utf-8")
    if path.suffix.lower() == ".json":
        import json

        return Style.from_dict(json.loads(text))
    return Style.from_yaml(text)


def list_presets(
    include_builtin: bool = True, directory: str | Path | None = None
) -> list[PresetInfo]:
    """Enumerate presets; user/env entries shadow built-ins of the same name."""
    import yaml

    seen: dict[str, PresetInfo] = {}
    dirs = list(_search_dirs())
    if directory is not None:
        dirs.insert(0, (Path(directory).expanduser(), "user"))
    for d, origin in dirs:
        if origin == "builtin" and not include_builtin:
            continue
        if not d.is_dir():
            continue
        for p in sorted(d.iterdir()):
            if p.suffix.lower() not in (".yaml", ".yml", ".json") or p.stem in seen:
                continue
            desc = ""
            try:
                raw = yaml.safe_load(p.read_text(encoding="utf-8")) or {}
                desc = str(raw.get("description", "")) if isinstance(raw, dict) else ""
            except Exception:
                desc = "(unreadable)"
            seen[p.stem] = PresetInfo(p.stem, p, origin, desc)
    order = {"builtin": 0, "user": 1, "env": 2}
    return sorted(seen.values(), key=lambda i: (order[i.origin], i.name))


def save_preset(style: Style, name: str, directory: str | Path | None = None) -> Path:
    if not _NAME_RE.match(name):
        raise ValueError("Preset names may contain letters, digits, space, '_', '-' and '.'")
    target_dir = Path(directory).expanduser() if directory else user_presets_dir()
    target_dir.mkdir(parents=True, exist_ok=True)
    style = style.model_copy(update={"name": name})
    return style.save(target_dir / f"{name}.yaml")


def delete_preset(name: str, directory: str | Path | None = None) -> Path:
    target_dir = Path(directory).expanduser() if directory else user_presets_dir()
    for p in _candidate_files(target_dir, name):
        if p.is_file():
            p.unlink()
            return p
    raise FileNotFoundError(f"No user preset {name!r} in {target_dir}")
