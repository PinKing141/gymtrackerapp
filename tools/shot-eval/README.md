# Shot tracking evaluation

Replays a labelled basketball video through the app's own auto shot pipeline
(`src/lib/shotPipeline.js`) in headless Chromium and scores the shots it logs
against hand-checked labels. Use it before changing anything in `src/lib/` that
affects ball finding, rim locking or make/miss calls.

## Run it

```bash
npm run fetch:assets -- ai       # downloads the 33 MB test video (once)
npm run eval:shots -- --mode manual
```

Needs `ffmpeg` (the video is re-encoded once to VP8, which Chromium for
testing can decode) and Playwright's Chromium. In a sandbox with a
preinstalled browser, set `PLAYWRIGHT_CHROMIUM_PATH`.

Options:

| Flag | Meaning |
| --- | --- |
| `--mode manual\|hybrid\|auto` | Rim source. `manual` and `hybrid` start from the labelled rim for each camera position, like a user recalibrating after moving the phone. `auto` relies on the rim finder alone. |
| `--step <ms>` | Time between analysed frames. Defaults to what the app uses: 33 ms once the rim is locked. |
| `--object-detector` | Keep running COCO-SSD near the rim (the app doesn't by default). |
| `--preset indoor\|outdoor\|lowlight\|older_phone` | Detector thresholds from `src/lib/autoShotPresets.js`. |
| `--start`, `--end` | Only replay part of the video (seconds). Only shots inside the range are scored. |
| `--json <file>` | Also write every frame's result, for digging into a miss. |

The clock inside the page is pinned to the video's timeline, so throttles and
timeouts behave as on a live camera however slow inference is on the machine
running the tool. Inference times it reports are for that machine, not a phone.

## Labels

`labels/video_test_5.json` lists the 30 shots in the reference clip and the rim
position for each of the four places the phone was held. All 30 are makes, so
the clip shows whether shots are found and whether makes are called correctly,
but not whether real misses are caught. A clip with misses is the most useful
thing to add next.

## Results on `video_test_5` (manual rim lock)

| Setup | Shots logged | Called correctly | False shots | Per frame* |
| --- | --- | --- | --- | --- |
| Before: COCO-SSD on the whole frame, every 140 ms | 0 / 30 | – | 0 | ~700 ms |
| COCO-SSD on a crop around the hoop + rim-zone finder, every 140 ms | 14 / 30 | 14 | 0 | ~700 ms |
| Rim-zone finder only, every 140 ms | 14 / 30 | 14 | 0 | ~3 ms |
| Rim-zone finder only, every 66 ms | 26 / 30 | 26 | 0 | ~2 ms |
| **Rim-zone finder only, every 33 ms (app default)** | **28 / 30** | **28** | **0** | **~3 ms** |

\* Headless Chromium with software WebGL on a cloud machine. Only the ratio is
meaningful; real phones are much faster at both.

Automatic rim finding (`--mode auto`) found no rim in this clip, where the rim
is only ~38 px wide; manual rim lock is the app's default and is what the
numbers above use.
