import { fd, ft } from "./storage.js";

export function summarizeBackupData(data = {}) {
  return {
    workouts: data?.sessions?.length || 0,
    recovery: data?.recovery?.length || 0,
    weighIns: data?.bodyStats?.length || 0,
    reviews: data?.weeklyReviews?.length || 0,
    pbs: Object.keys(data?.personalBests || {}).length,
    cardio: data?.cardioSessions?.length || 0,
    basketball: data?.basketballSessions?.length || 0,
    preferences: Boolean(data?.profile),
  };
}

export function getPreferencesIncludedLabel(summary = {}) {
  return summary.preferences ? "Preferences included" : "Preferences not included";
}

export function formatBackupCounts(summary = {}) {
  return `${summary.workouts || 0} workouts · ${summary.recovery || 0} recovery logs · ${summary.weighIns || 0} weigh-ins · ${summary.pbs || 0} PBs`;
}

const BACKUP_REASON_LABELS = {
  import: "saved before your last import",
  restore: "saved before your last restore",
  daily: "daily snapshot",
};

// Heading for the restore preview, from storage's backupInfo() record.
export function describeBackupSnapshot(info) {
  if (!info || !Number.isFinite(info.takenAt)) return "Backup found";
  const when = `${fd(info.takenAt)}, ${ft(info.takenAt)}`;
  const why = BACKUP_REASON_LABELS[info.reason];
  return why ? `Backup from ${when} · ${why}` : `Backup from ${when}`;
}
