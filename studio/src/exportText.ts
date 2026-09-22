/** Text the Export panel hands to the user: a runnable Python snippet and a prompt for AI coding tools.
 *  Pure functions of the current style so they stay easy to test. */

export interface ExportSource {
  /** Compact YAML of the current style (only values that differ from the defaults). */
  yaml: string;
  /** Name of a built-in preset the style matches exactly, or null when it has been customised. */
  builtinPreset: string | null;
  /** Whether tracking trails are switched on, so the output can explain where track ids come from. */
  trails: boolean;
}

/** Wrap YAML in a Python triple-quoted string without letting its contents end the literal early. */
function pythonString(text: string): string {
  const body = text.trimEnd().replace(/\\/g, '\\\\').replace(/"""/g, '\\"\\"\\"');
  return `"""\n${body}\n"""`;
}

function styleLines(source: ExportSource, yamlElsewhere: boolean): string[] {
  if (source.builtinPreset) return [`style = vs.Style.preset(${JSON.stringify(source.builtinPreset)})`];
  return [
    '# Designed in visionstyle Studio (only the values that differ from the defaults)',
    yamlElsewhere
      ? 'STYLE_YAML = """..."""  # the YAML from the Style section above'
      : `STYLE_YAML = ${pythonString(source.yaml)}`,
    'style = vs.Style.from_yaml(STYLE_YAML)',
  ];
}

/** `yamlElsewhere` swaps the embedded YAML for a pointer, for the prompt that already shows it once. */
export function pythonSnippet(source: ExportSource, { yamlElsewhere = false } = {}): string {
  return [
    'import visionstyle as vs',
    '',
    ...styleLines(source, yamlElsewhere),
    '',
    '# One annotator per image stream, so trails and animations carry across frames',
    'annotator = vs.Annotator(style)',
    '',
    '# Detections: pixel xyxy boxes; class names, confidences and track ids are optional.',
    source.trails
      ? '# From Ultralytics: dets = vs.Detections.from_ultralytics(model.track(frame, persist=True)[0])'
      : '# From Ultralytics: dets = vs.Detections.from_ultralytics(model.predict(frame)[0])',
    'dets = vs.Detections(xyxy=boxes, class_name=labels, confidence=scores, track_id=track_ids)',
    '',
    'frame = annotator.annotate(frame, dets)  # BGR uint8 like OpenCV; pass rgb=True for RGB arrays',
  ].join('\n');
}

export function aiPrompt(source: ExportSource): string {
  const styleStep = source.builtinPreset
    ? `3. Use the built-in \`${source.builtinPreset}\` style: \`style = vs.Style.preset("${source.builtinPreset}")\`.`
    : '3. Build the style once from the YAML below with `vs.Style.from_yaml(...)`. You can keep the YAML inline, or save it as `visionstyle_style.yaml` and load it with `vs.Style.load("visionstyle_style.yaml")`.';
  const sections = [
    'I use the `visionstyle` Python package to draw object-detection results: bounding boxes, labels and tracking trails. I designed the annotation style in visionstyle Studio. Please apply it in this project.',
    '',
    '## Steps',
    '1. Add `visionstyle` to the project dependencies (`pip install visionstyle`, Python 3.10+).',
    '2. Find where the project draws detections, for example `cv2.rectangle` / `cv2.putText` calls, `supervision` annotators or Ultralytics `result.plot()`, and replace that drawing with visionstyle.',
    styleStep,
    '4. Create one `vs.Annotator(style)` per image stream or video and reuse it for every frame, so trails and animations carry across frames.',
    '5. Convert each frame\'s detections to `vs.Detections`: `xyxy` pixel boxes (x1, y1, x2, y2), plus optional `class_name` (or `class_id` with `names`), `confidence` and `track_id`. For Ultralytics results use `vs.Detections.from_ultralytics(result)`.',
    '6. Draw with `frame = annotator.annotate(frame, dets)`. It expects BGR uint8 frames like OpenCV and returns the annotated frame; pass `rgb=True` for RGB arrays.',
  ];
  if (source.trails) {
    sections.push(
      '7. This style draws tracking trails, which need stable track ids across frames. With Ultralytics, use `model.track(frame, persist=True)` instead of `model.predict`; detections without a track id get no trail.',
    );
  }
  if (!source.builtinPreset) {
    sections.push('', '## Style (visionstyle YAML)', '```yaml', source.yaml.trimEnd(), '```');
  }
  sections.push(
    '',
    '## Reference',
    '```python',
    pythonSnippet(source, { yamlElsewhere: true }),
    '```',
    '',
    '## Constraints',
    '- Treat the style above as the source of truth. Do not re-implement the drawing by hand or tweak colors, sizes or fonts in code.',
    '- Keep the existing detection and model code; only change how results are drawn.',
    '- Sizes in the style scale automatically with the frame resolution, so do not rescale them per frame.',
  );
  return sections.join('\n');
}
