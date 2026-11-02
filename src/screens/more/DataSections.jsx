import { ActionButton, SurfaceCard } from "../../components/ui.jsx";
import { DangerRow, SettingsGroup as Group } from "../../components/ProfileSettings.jsx";
import { getPreferencesIncludedLabel } from "../../profileBackupPreview.js";
import { boldTextStyle, formatLastSynced, mutedStyle, smallErrorStyle, smallMutedStyle, textStyle } from "./styles.js";

const warningStyle = { margin: "8px 0", color: "#FFCA8A", fontSize: 12 };

export function DataBackupSection({
  dataCounts,
  syncText,
  firestoreSync,
  importError,
  fileInputRef,
  onImportFile,
  onExportData,
  onExportStats,
  onOpenRestorePreview,
  onOpenSection,
}) {
  return (
    <>
      <Group title="Training data">
        <p style={textStyle}>{dataCounts.workouts} workouts</p>
        <p style={textStyle}>{dataCounts.cardio} cardio sessions</p>
        <p style={textStyle}>{dataCounts.basketball} basketball sessions</p>
        <p style={textStyle}>{dataCounts.pbs} PBs</p>
      </Group>

      <Group title="Wellness data">
        <p style={textStyle}>{dataCounts.recovery} recovery logs</p>
        <p style={textStyle}>{dataCounts.weighIns} weigh-ins</p>
        <p style={textStyle}>{dataCounts.reviews} weekly reviews</p>
      </Group>

      <Group title="Backup actions">
        <ActionButton onClick={onExportData} tone="tinted" color="#2D7DD2">Export backup (.json)</ActionButton>
        <p style={smallMutedStyle}>A full, re-importable copy of your data — presets, sessions, PBs and settings.</p>
        <ActionButton onClick={() => fileInputRef.current?.click()} tone="tinted" color="#F5A623">Import backup</ActionButton>
        <ActionButton onClick={onOpenRestorePreview} tone="tinted" color="#45B649">Restore local backup</ActionButton>
        {onExportStats && <ActionButton onClick={onExportStats} tone="secondary">Export stats (Excel)</ActionButton>}
        <input ref={fileInputRef} type="file" accept="application/json" onChange={onImportFile} style={{ display: "none" }} />
        {importError && <p style={smallErrorStyle}>{importError}</p>}
      </Group>

      <Group title="Cloud sync">
        <p style={textStyle}>{syncText}</p>
        <p style={smallMutedStyle}>Last synced: {formatLastSynced(firestoreSync)}</p>
      </Group>

      <DangerRow icon="trash" label="Danger Zone" summary="Reset all data" onClick={() => onOpenSection("dangerZone")} />
    </>
  );
}

export function DangerZoneSection({ onReset }) {
  return (
    <SurfaceCard style={{ borderColor: "rgba(255,93,93,0.3)", background: "rgba(255,93,93,0.05)" }}>
      <p style={{ margin: "0 0 6px", color: "#FF8A8A", fontWeight: 800 }}>Reset all data</p>
      <p style={{ margin: "0 0 14px", color: "#8A8F9C", fontSize: 12 }}>
        Permanently deletes workouts, cardio, basketball data, stats, PBs, preferences and local/cloud data.
      </p>
      <ActionButton onClick={onReset} tone="danger">Reset all data</ActionButton>
    </SurfaceCard>
  );
}

export function ImportPreviewSection({ preview, onImportWithBackup, onImport, onCancel }) {
  const { summary, current } = preview;
  return (
    <Group title="Import backup">
      <p style={boldTextStyle}>Found in backup</p>
      <p style={mutedStyle}>
        {summary.workouts} workouts · {summary.recovery} recovery logs · {summary.weighIns} weigh-ins · {summary.pbs} PBs · {getPreferencesIncludedLabel(summary)}
      </p>
      <p style={{ margin: "8px 0 0", color: "#fff", fontWeight: 700 }}>Current app data</p>
      <p style={mutedStyle}>
        {current.workouts} workouts · {current.recovery} recovery logs · {current.weighIns} weigh-ins · {current.pbs} PBs
      </p>
      <p style={warningStyle}>Importing a backup replaces your current data with the data inside the file.</p>
      <ActionButton onClick={onImportWithBackup} tone="tinted" color="#2D7DD2">Create safety backup and import</ActionButton>
      <ActionButton onClick={onImport} tone="danger">Import without safety backup</ActionButton>
      <ActionButton onClick={onCancel} tone="secondary">Cancel</ActionButton>
    </Group>
  );
}

export function RestorePreviewSection({ preview, onRestoreWithBackup, onRestore, onCancel }) {
  const { summary } = preview;
  return (
    <Group title="Restore local backup">
      <p style={boldTextStyle}>Backup found</p>
      <p style={mutedStyle}>{summary.workouts} workouts · {summary.pbs} PBs · {getPreferencesIncludedLabel(summary)}</p>
      <p style={warningStyle}>Restoring uses the last local backup saved on this device and replaces your current data.</p>
      <ActionButton onClick={onRestoreWithBackup} tone="tinted" color="#2D7DD2">Create safety export and restore</ActionButton>
      <ActionButton onClick={onRestore} tone="danger">Restore backup</ActionButton>
      <ActionButton onClick={onCancel} tone="secondary">Cancel</ActionButton>
    </Group>
  );
}
