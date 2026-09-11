# Examples

| Script | What it shows |
|---|---|
| `quickstart.py` | Draw hand-made boxes on an image with a preset. |
| `yolo_image.py` | Ultralytics `predict` → `Detections.from_ultralytics` → annotate. |
| `video_tracking.py` | `model.track` on a video with a stateful `Annotator` drawing trails. |
| `custom_style.py` | Compose a `Style` in code, save it as a preset and load it by name. |

Or skip the code entirely:

```bash
visionstyle render sample -s cinematic -o out.jpg
visionstyle render clip.mp4 -s tracking --model yolo11n.pt --track -o out.mp4
visionstyle gallery my_photo.jpg --model yolo11n.pt -o gallery.png
visionstyle studio
```
