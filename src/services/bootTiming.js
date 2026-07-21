// Development-only startup timeline. Each stage the boot sequence can stall on
// (JS parse/mount, Firebase auth, the local cache read, the Firestore round
// trip, first paint of Home) gets its own mark, so a slow boot can be
// attributed to a specific stage instead of guessing behind one skeleton.
const ENABLED = import.meta.env.DEV && typeof performance !== "undefined";
const marks = [];

export function markBoot(label) {
  if (!ENABLED) {
    return;
  }

  const elapsed = performance.now();
  const previous = marks[marks.length - 1];
  const delta = previous ? elapsed - previous.elapsed : elapsed;
  marks.push({ label, elapsed });

  try {
    performance.mark(`orion:${label}`);
  } catch {
    // Some environments (older WebViews) don't support named marks.
  }

  console.log(`[boot] ${label.padEnd(28)} +${delta.toFixed(0)}ms (${elapsed.toFixed(0)}ms since navigation start)`);
}
