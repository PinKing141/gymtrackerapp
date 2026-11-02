// Scores one replay of the shot pipeline against hand-labelled shots.
// Kept free of browser/Node APIs so it can be unit tested.

// An event counts for a labelled shot if it fires within this window around
// the moment the ball dropped through the rim. The tracker only reports once
// the ball is clearly below the rim, so events tend to land a little after.
export const MATCH_WINDOW = { before: 0.7, after: 1.2 };
const NEAR_SHOT_SECONDS = 1;
const WARMUP_SAMPLES = 3;

function percentile(sorted, fraction) {
  if (!sorted.length) return 0;
  const index = Math.min(sorted.length - 1, Math.floor(sorted.length * fraction));
  return sorted[index];
}

// Fraction of frames whose rim lock sits within one radius of the labelled rim.
function rimCorrectRate(samples, rimSegments) {
  if (!rimSegments?.length) return null;
  const scored = samples
    .map((sample) => ({ sample, segment: rimSegments.find((item) => sample.t >= item.from && sample.t < item.to) }))
    .filter(({ segment }) => segment);
  if (!scored.length) return null;
  const correct = scored.filter(({ sample, segment }) => (
    sample.rim && Math.hypot(sample.rim.x - segment.rimCenter.x, sample.rim.y - segment.rimCenter.y) <= segment.rimRadius
  )).length;
  return Number((correct / scored.length).toFixed(3));
}

export function matchShots(events, labelShots, window = MATCH_WINDOW) {
  const remaining = [...events].sort((left, right) => left.t - right.t);
  const perShot = [...labelShots]
    .sort((left, right) => left.t - right.t)
    .map((label) => {
      const index = remaining.findIndex((event) => event.t >= label.t - window.before && event.t <= label.t + window.after);
      const event = index >= 0 ? remaining.splice(index, 1)[0] : null;
      return { label, event };
    });
  return { perShot, unmatched: remaining };
}

export function scoreRun(run, labels, meta = {}) {
  const events = run.samples
    .filter((sample) => sample.shot)
    .map((sample) => ({ t: sample.t, ...sample.shot }));
  const { perShot, unmatched } = matchShots(events, labels.shots);

  const matchedLogged = perShot.filter((row) => row.event && !row.event.suppressed);
  const nearShot = run.samples.filter((sample) => labels.shots.some((shot) => Math.abs(sample.t - shot.t) <= NEAR_SHOT_SECONDS));
  const inference = run.samples
    .slice(WARMUP_SAMPLES)
    .map((sample) => sample.inferenceMs)
    .filter((value) => typeof value === "number")
    .sort((left, right) => left - right);
  const total = run.samples.length || 1;

  return {
    meta,
    shots: {
      labelled: labels.shots.length,
      found: matchedLogged.length,
      recall: Number((matchedLogged.length / (labels.shots.length || 1)).toFixed(3)),
      correctResult: matchedLogged.filter((row) => row.event.result === row.label.result).length,
      suppressedMatches: perShot.filter((row) => row.event?.suppressed).length,
      falseShots: unmatched.filter((event) => !event.suppressed).length,
      falseSuppressed: unmatched.filter((event) => event.suppressed).length,
    },
    ball: {
      lockRate: Number((run.samples.filter((sample) => sample.ball).length / total).toFixed(3)),
      nearShotLockRate: Number((nearShot.filter((sample) => sample.ball).length / (nearShot.length || 1)).toFixed(3)),
    },
    rim: {
      lockedRate: Number((run.samples.filter((sample) => sample.rim).length / total).toFixed(3)),
      correctRate: rimCorrectRate(run.samples, labels.rimSegments),
    },
    speed: {
      meanMs: inference.length ? Math.round(inference.reduce((sum, value) => sum + value, 0) / inference.length) : 0,
      p95Ms: percentile(inference, 0.95),
    },
    perShot,
    unmatched,
  };
}
