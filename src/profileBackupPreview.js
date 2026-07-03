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
