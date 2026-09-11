"""Build a style in code, tweak it, save it as a preset and load it back by name."""

import visionstyle as vs

style = vs.Style(
    name="my-look",
    description="Rounded dashed frames with a glowing pill label.",
    palette=vs.PaletteSpec(colors="neon", by="class"),
    box=vs.BoxStyle(shape="rounded", corner_radius=12),
    stroke=vs.StrokeStyle(thickness=2.5),
    fill=vs.FillStyle(enabled=True, opacity=0.12, mode="gradient"),
    line=vs.LinePattern(pattern="dashed", dash_length=14, gap_length=8, animation="march"),
    label=vs.LabelStyle(
        components=["track_id", "text", "confidence"], anchor="top_center", background="pill"
    ),
)
style.effects.glow.enabled = True  # every field is a normal attribute
style.trail.enabled = True

path = style.save_preset()  # -> ~/.visionstyle/presets/my-look.yaml
print("saved", path)

again = vs.Style.preset("my-look")
assert again.box.shape == "rounded"
print(again.to_yaml(exclude_defaults=True))
