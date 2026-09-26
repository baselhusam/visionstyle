# Sample credits

| File | Source | Author | License |
|---|---|---|---|
| `night.jpg` | [Pexels #10398361](https://www.pexels.com/photo/10398361/) | Jane Mir | [Pexels License](https://www.pexels.com/license/) |
| `street.jpg` | [Pexels #940035](https://www.pexels.com/photo/940035/) | Andrey Grushnikov | [Pexels License](https://www.pexels.com/license/) |

Both photos were downscaled to 1600 px wide. `*.detections.json` files were produced with
Ultralytics `yolo26n.pt` (`imgsz=1280`, `conf=0.35`); `city-walkthrough.detections.json` with `yolo26n.pt` + ByteTrack (`imgsz=640`, `conf=0.3`) and are shipped so the Studio and the
`sample` CLI source work without a model installed.
