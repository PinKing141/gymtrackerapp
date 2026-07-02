import { doc, serverTimestamp, writeBatch } from "firebase/firestore";
import { db } from "../firebase.js";

// Firestore rejects `undefined`; normalize to null.
const nn = (value) => (value === undefined ? null : value);

/**
 * Persist a finished basketball session and each of its shot events to Firestore:
 *   users/{uid}/basketballSessions/{sessionId}
 *   users/{uid}/basketballSessions/{sessionId}/shots/{shotId}
 *
 * The session is expected to already carry the summary fields produced by
 * `summarizeSession` in BasketballScreen (mode, makes, misses, etc.).
 *
 * @param {string} userId
 * @param {object} session
 * @returns {Promise<boolean|null>} true on success, null when skipped
 */
export async function saveBasketballSession(userId, session) {
  if (!userId || !session?.id) return null;

  const sessionId = String(session.id);
  const shots = Array.isArray(session.shots) ? session.shots : [];

  const batch = writeBatch(db);

  const sessionRef = doc(db, "users", userId, "basketballSessions", sessionId);
  batch.set(
    sessionRef,
    {
      id: sessionId,
      date: nn(session.date),
      mode: nn(session.mode),
      totalShots: nn(session.totalShots),
      makes: nn(session.makes),
      misses: nn(session.misses),
      fgPct: nn(session.fgPct),
      startedAt: nn(session.startedAt),
      endedAt: nn(session.endedAt),
      durationSec: nn(session.durationSec),
      device: nn(session.device),
      calibrationId: nn(session.calibrationId),
      templateId: nn(session.templateId),
      templateName: nn(session.templateName),
      syncedAt: serverTimestamp(),
    },
    { merge: true }
  );

  shots.forEach((shot) => {
    const shotId = String(shot.id ?? `${sessionId}-${Math.random().toString(36).slice(2)}`);
    const shotRef = doc(db, "users", userId, "basketballSessions", sessionId, "shots", shotId);
    batch.set(shotRef, {
      sessionId,
      result: nn(shot.result),
      source: nn(shot.source),
      confidence: nn(shot.confidence),
      zoneId: nn(shot.zoneId),
      type: nn(shot.type),
      drillIndex: nn(shot.drillIndex),
      timestamp: nn(shot.timestamp),
    });
  });

  await batch.commit();
  return true;
}
