from __future__ import annotations

import json

import pytest
import yaml

import visionstyle as vs
from visionstyle.style.migrate import migrate
from visionstyle.style.presets import list_presets, resolve_preset_path, save_preset
from visionstyle.style.schema import SCHEMA_VERSION, LabelStyle, StrokeStyle, Style


def test_default_style_roundtrip_yaml_and_json():
    s = Style()
    assert Style.from_yaml(s.to_yaml()) == s
    assert Style.from_dict(json.loads(json.dumps(s.to_dict()))) == s
    assert s.to_dict()["schema_version"] == SCHEMA_VERSION


def test_exclude_defaults_is_sparse():
    s = Style().copy_with(stroke={"thickness": 5})
    data = yaml.safe_load(s.to_yaml(exclude_defaults=True))
    assert data["stroke"] == {"thickness": 5.0}
    assert "label" not in data
    assert Style.from_dict(data).stroke.thickness == 5


def test_color_validation():
    assert StrokeStyle(color="#ABC").color == "#abc"
    assert StrokeStyle(color="confidence").color == "confidence"
    with pytest.raises(ValueError):
        StrokeStyle(color="inherit")  # not allowed for stroke
    with pytest.raises(ValueError):
        StrokeStyle(color="banana")
    s = Style()
    s.stroke.color = "red"  # validate_assignment
    with pytest.raises(ValueError):
        s.stroke.color = "not a color"


def test_unknown_field_rejected():
    with pytest.raises(ValueError):
        Style.from_dict({"stroke": {"thicc": 3}})


def test_range_validation():
    with pytest.raises(ValueError):
        LabelStyle(font_size=1000)
    with pytest.raises(ValueError):
        Style.from_dict({"confidence_threshold": 2})


def test_copy_with_nested_update_does_not_mutate():
    a = Style()
    b = a.copy_with(box={"shape": "rounded"}, name="b")
    assert a.box.shape == "rectangle" and b.box.shape == "rounded" and b.name == "b"


def test_all_builtin_presets_load():
    names = [p.name for p in list_presets()]
    assert {
        "default",
        "cinematic",
        "minimal",
        "corners",
        "neon",
        "hud",
        "tracking",
        "glass",
    } <= set(names)
    for name in names:
        style = Style.preset(name)
        assert style.name == name
        assert style.description


def test_user_preset_shadowing_and_env_dir(tmp_path, monkeypatch):
    style = Style().copy_with(stroke={"thickness": 9})
    path = save_preset(style, "mine")
    assert path.exists()
    assert Style.preset("mine").stroke.thickness == 9
    assert [p.origin for p in list_presets() if p.name == "mine"] == ["user"]

    # a user preset called "default" shadows the built-in
    save_preset(style, "default")
    assert Style.preset("default").stroke.thickness == 9

    env_dir = tmp_path / "env"
    monkeypatch.setenv("VISIONSTYLE_PRESETS_DIR", str(env_dir))
    save_preset(Style().copy_with(stroke={"thickness": 1}), "default", env_dir)
    assert Style.preset("default").stroke.thickness == 1
    assert resolve_preset_path("default").parent == env_dir


def test_preset_by_path_and_missing(tmp_path):
    p = Style().copy_with(box={"shape": "corners"}).save(tmp_path / "x.yaml")
    assert Style.load(p).box.shape == "corners"
    j = Style().copy_with(box={"shape": "reticle"}).save(tmp_path / "x.json")
    assert Style.load(j).box.shape == "reticle"
    with pytest.raises(FileNotFoundError):
        Style.preset("does-not-exist")


def test_invalid_preset_name():
    with pytest.raises(ValueError):
        save_preset(Style(), "../evil")


def test_migrate_rejects_future_schema():
    with pytest.raises(ValueError):
        migrate({"schema_version": SCHEMA_VERSION + 1})
    assert migrate({})["schema_version"] == SCHEMA_VERSION


def test_json_schema_has_color_metadata():
    schema = Style.json_schema()
    stroke = schema["$defs"]["StrokeStyle"]["properties"]["color"]
    assert stroke["format"] == "color"
    assert "palette" in stroke["specials"]


def test_presets_module_api(tmp_path):
    vs.presets.save(Style(), "via-module")
    assert "via-module" in [p.name for p in vs.presets.list()]
    vs.presets.delete("via-module")
    assert "via-module" not in [p.name for p in vs.presets.list()]
