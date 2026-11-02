// Text and row styles shared by the More screen's settings sections.
export const textStyle = { margin: 0, color: "#fff" };
export const boldTextStyle = { margin: 0, color: "#fff", fontWeight: 700 };
export const mutedStyle = { margin: 0, color: "#8A8F9C" };
export const smallMutedStyle = { margin: 0, color: "#8A8F9C", fontSize: 12 };
export const errorStyle = { margin: 0, color: "#FF8A8A" };
export const smallErrorStyle = { margin: 0, color: "#FF8A8A", fontSize: 12 };
export const spacedRowStyle = { display: "flex", justifyContent: "space-between", alignItems: "center" };

export function formatLastSynced(firestoreSync) {
  return firestoreSync?.lastSyncedAt ? new Date(firestoreSync.lastSyncedAt).toLocaleString() : "—";
}
