import { describe, expect, it } from "vitest";
import { findBallBlob, isBallColored, toLuma } from "../src/lib/rimZoneBallFinder.js";
import { getBallSearchRegion, isOnRimRing } from "../src/lib/shotPipeline.js";
import { createShotTracker } from "../src/lib/shotTracker.js";
import { matchShots, scoreRun } from "../tools/shot-eval/score.js";

const SIZE = 128;
const WALL = [200, 182, 150];
const BALL = [110, 55, 45];

function image(fill, disks = []) {
  const rgba = new Uint8ClampedArray(SIZE * SIZE * 4);
  for (let y = 0; y < SIZE; y += 1) {
    for (let x = 0; x < SIZE; x += 1) {
      const disk = disks.find((item) => Math.hypot(x - item.x, y - item.y) <= item.r);
      const [r, g, b] = disk ? disk.color || BALL : fill;
      rgba.set([r, g, b, 255], (y * SIZE + x) * 4);
    }
  }
  return rgba;
}

describe("rim-zone ball finder", () => {
  it("treats orange to dark red-brown as ball coloured, not walls or backboards", () => {
    expect(isBallColored(...BALL)).toBe(true);
    expect(isBallColored(230, 120, 40)).toBe(true);
    expect(isBallColored(...WALL)).toBe(false);
    expect(isBallColored(60, 110, 170)).toBe(false);
  });

  it("finds a moving ball-sized, ball-coloured blob", () => {
    const previousLuma = toLuma(image(WALL), SIZE);
    const blob = findBallBlob({ rgba: image(WALL, [{ x: 40, y: 50, r: 6 }]), previousLuma, size: SIZE, expectedRadius: 6 });
    expect(blob.center.x).toBeCloseTo(40, 0);
    expect(blob.center.y).toBeCloseTo(50, 0);
  });

  it("ignores things that didn't move", () => {
    const frame = image(WALL, [{ x: 40, y: 50, r: 6 }]);
    expect(findBallBlob({ rgba: frame, previousLuma: toLuma(frame, SIZE), size: SIZE, expectedRadius: 6 })).toBeNull();
  });

  it("ignores blobs far bigger than a ball should be at this rim size", () => {
    const previousLuma = toLuma(image(WALL), SIZE);
    const huge = image(WALL, [{ x: 60, y: 60, r: 20 }]);
    expect(findBallBlob({ rgba: huge, previousLuma, size: SIZE, expectedRadius: 6 })).toBeNull();
  });

  it("skips the frame when the whole view changed (camera moved)", () => {
    const previousLuma = toLuma(image([40, 40, 40]), SIZE);
    expect(findBallBlob({ rgba: image(WALL, [{ x: 40, y: 50, r: 6 }]), previousLuma, size: SIZE, expectedRadius: 6 })).toBeNull();
  });

  it("needs a previous frame to compare against", () => {
    expect(findBallBlob({ rgba: image(WALL), previousLuma: null, size: SIZE, expectedRadius: 6 })).toBeNull();
  });
});

describe("hoop search area", () => {
  const rim = { rimCenter: { x: 377, y: 169 }, rimRadius: 18 };

  it("is a square of 12 rim radii, mostly above the rim", () => {
    const region = getBallSearchRegion(rim, 960, 540);
    expect(region.size).toBe(216);
    expect(region.x).toBe(377 - 108);
    expect(region.y).toBeCloseTo(169 - 216 * 0.62, 5);
  });

  it("is skipped when it would cover the whole frame anyway", () => {
    expect(getBallSearchRegion({ ...rim, rimRadius: 60 }, 960, 540)).toBeNull();
    expect(getBallSearchRegion(null, 960, 540)).toBeNull();
  });

  it("recognises hits sitting on the rim ring (net shake)", () => {
    expect(isOnRimRing({ center: { x: 380, y: 172 } }, rim)).toBe(true);
    expect(isOnRimRing({ center: { x: 377, y: 200 } }, rim)).toBe(false);
  });
});

describe("shot tracker with sparse sightings", () => {
  const rim = { rimCenter: { x: 100, y: 100 }, rimRadius: 20 };

  function replay(points) {
    const tracker = createShotTracker();
    return points
      .map(([x, y], index) => tracker.update({ center: { x, y }, radius: 12, score: 0.7, timestamp: 1000 + index * 140 }, rim))
      .filter(Boolean);
  }

  it("calls a ball falling through the middle of the rim a make", () => {
    // Already falling when it reaches the hoop, as on a real jump shot.
    const events = replay([[140, 20], [120, 55], [104, 80], [101, 140]]);
    expect(events).toHaveLength(1);
    expect(events[0].result).toBe("make");
  });

  it("calls a ball dropping past the side of the rim a miss", () => {
    const events = replay([[180, 20], [165, 55], [152, 80], [150, 140]]);
    expect(events).toHaveLength(1);
    expect(events[0].result).toBe("miss");
  });

  it("logs nothing for a ball that never gets above the rim", () => {
    expect(replay([[60, 130], [80, 140], [100, 150], [120, 160]])).toHaveLength(0);
  });
});

describe("evaluation scoring", () => {
  it("matches each labelled shot to at most one event inside the window", () => {
    const { perShot, unmatched } = matchShots(
      [{ t: 2.4, result: "make" }, { t: 2.9, result: "make" }, { t: 10, result: "miss" }],
      [{ t: 2.3, result: "make" }, { t: 7, result: "make" }],
    );
    expect(perShot[0].event.t).toBe(2.4);
    expect(perShot[1].event).toBeNull();
    expect(unmatched.map((event) => event.t)).toEqual([2.9, 10]);
  });

  it("counts held-back events separately from logged ones", () => {
    const run = {
      samples: [
        { t: 2.4, ball: { x: 1, y: 1 }, rim: null, inferenceMs: 3, shot: { result: "make", confidence: 0.9, suppressed: false } },
        { t: 7.1, ball: null, rim: null, inferenceMs: 3, shot: { result: "miss", confidence: 0.5, suppressed: true } },
      ],
    };
    const report = scoreRun(run, { shots: [{ t: 2.3, result: "make" }, { t: 7, result: "make" }] });
    expect(report.shots).toMatchObject({ found: 1, correctResult: 1, suppressedMatches: 1, falseShots: 0 });
  });
});
