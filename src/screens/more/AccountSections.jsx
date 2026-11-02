import { AccountSecurity } from "../../components/AccountSecurity.jsx";
import { ActionButton } from "../../components/ui.jsx";
import { SettingsGroup as Group } from "../../components/ProfileSettings.jsx";
import { boldTextStyle, errorStyle, formatLastSynced, mutedStyle, textStyle } from "./styles.js";

export function AccountSection({
  firebaseUser,
  displayName,
  syncText,
  firestoreSync,
  onSignOut,
  onRemoveAccountFromDevice,
  onDeleteAccount,
}) {
  return (
    <>
      <Group title="Account">
        <p style={textStyle}>Email: <strong>{firebaseUser?.email || "Signed out"}</strong></p>
        <p style={textStyle}>Display name: <strong>{displayName}</strong></p>
        <p style={mutedStyle}>Status: {firebaseUser ? "Signed in" : "Signed out"}</p>
      </Group>

      <Group title="Sync">
        <p style={textStyle}>Cloud sync status: <strong>{syncText}</strong></p>
        <p style={mutedStyle}>Last synced: {formatLastSynced(firestoreSync)}</p>
        {firestoreSync?.error && <p style={errorStyle}>{firestoreSync.error}</p>}
      </Group>

      {firebaseUser && <ActionButton tone="secondary" onClick={onSignOut}>Sign out</ActionButton>}
      {firebaseUser && (
        <AccountSecurity firebaseUser={firebaseUser} onRemoveFromDevice={onRemoveAccountFromDevice} onDeleteAccount={onDeleteAccount} />
      )}
    </>
  );
}

export function AboutSection() {
  return (
    <Group title="App">
      <p style={boldTextStyle}>Orion Gym Tracker</p>
      <p style={mutedStyle}>Version 1.0.0</p>
    </Group>
  );
}
