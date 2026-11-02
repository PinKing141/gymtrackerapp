import { ActionButton } from "../../components/ui.jsx";
import { ProfileRow, SettingsGroup as Group, Toggle } from "../../components/ProfileSettings.jsx";
import { haptic, playCue, unlockAudio } from "../../services/sound.js";
import { SOUND_ROWS } from "./modules.js";
import { boldTextStyle, smallMutedStyle, spacedRowStyle, textStyle } from "./styles.js";

export function getSoundHapticsSummary(devicePrefs) {
  const sound = devicePrefs.soundEnabled !== false ? "Sound on" : "Sound off";
  const haptics = devicePrefs.hapticsEnabled !== false ? "Haptics on" : "Haptics off";
  return `${sound} · ${haptics}`;
}

export function PreferencesSection({ unitLabel, devicePrefs, onOpenSection }) {
  return (
    <>
      <ProfileRow icon="scale" label="Units" summary={unitLabel} onClick={() => onOpenSection("units")} />
      <ProfileRow icon="pulse" label="Sound & Haptics" summary={getSoundHapticsSummary(devicePrefs)} onClick={() => onOpenSection("soundHaptics")} />
      <ProfileRow icon="spark" label="Appearance" summary="Dark" onClick={() => onOpenSection("appearance")} />
    </>
  );
}

export function UnitsSection({ unitSystem, setUnitSystem }) {
  return (
    <Group title="Units">
      <ActionButton tone={unitSystem === "imperial" ? "tinted" : "secondary"} onClick={() => setUnitSystem("imperial")}>
        Imperial · lb · ft/in · miles
      </ActionButton>
      <ActionButton tone={unitSystem === "metric" ? "tinted" : "secondary"} onClick={() => setUnitSystem("metric")}>
        Metric · kg · cm · km
      </ActionButton>
      <p style={smallMutedStyle}>Energy stays in kcal.</p>
    </Group>
  );
}

export function SoundHapticsSection({ devicePrefs, setDevicePrefs }) {
  const soundCategories = devicePrefs.soundCategories || {};
  const toggleSoundCategory = (key) => setDevicePrefs((current) => ({
    ...current,
    soundCategories: { ...(current.soundCategories || {}), [key]: !(current.soundCategories?.[key] !== false) },
  }));

  return (
    <>
      <Group title="Sound">
        <div style={spacedRowStyle}>
          <p style={boldTextStyle}>Master sound</p>
          <Toggle
            on={devicePrefs.soundEnabled !== false}
            onClick={() => setDevicePrefs((current) => ({ ...current, soundEnabled: !(current.soundEnabled !== false) }))}
          />
        </div>
        <input
          type="range"
          min="0"
          max="1"
          step="0.05"
          value={devicePrefs.soundVolume ?? 0.6}
          onChange={(e) => setDevicePrefs((current) => ({ ...current, soundVolume: Number(e.target.value) }))}
          style={{ width: "100%", accentColor: "#4EA1FF" }}
        />
      </Group>

      <Group title="Sound categories">
        {SOUND_ROWS.map((row) => (
          <div key={row.key} style={{ ...spacedRowStyle, gap: 10 }}>
            <p style={boldTextStyle}>{row.label}</p>
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <ActionButton compact fullWidth={false} tone="secondary" onClick={() => { unlockAudio(); playCue(row.cue); }}>Play</ActionButton>
              <Toggle on={soundCategories[row.key] !== false} onClick={() => toggleSoundCategory(row.key)} />
            </div>
          </div>
        ))}
      </Group>

      <Group title="Haptics">
        <div style={spacedRowStyle}>
          <p style={boldTextStyle}>Haptics vibration</p>
          <Toggle
            on={devicePrefs.hapticsEnabled !== false}
            onClick={() => setDevicePrefs((current) => ({ ...current, hapticsEnabled: !(current.hapticsEnabled !== false) }))}
          />
        </div>
        <ActionButton tone="secondary" onClick={() => haptic("success")}>Test haptic</ActionButton>
      </Group>
    </>
  );
}

export function AppearanceSection() {
  return (
    <Group title="Theme">
      <p style={boldTextStyle}>Dark</p>
      <p style={smallMutedStyle}>Theme customization is coming soon. The app currently supports its dark training theme.</p>
    </Group>
  );
}

export function NotificationsSection({
  devicePrefs,
  setDevicePrefs,
  notificationPermission,
  notificationSupported,
  serviceWorkerSupported,
  onRequestReminderPermission,
  onSendTestReminder,
}) {
  const thresholdDays = devicePrefs.reminderThresholdDays || 3;
  return (
    <>
      <Group title="Reminder status">
        <p style={textStyle}>Permission: <strong>{notificationSupported ? notificationPermission : "Unsupported"}</strong></p>
        {notificationSupported && (
          <ActionButton onClick={onRequestReminderPermission} tone="tinted" color="#2D7DD2">
            {notificationPermission === "granted" ? "Enabled" : "Enable reminders"}
          </ActionButton>
        )}
      </Group>

      {notificationSupported && (
        <Group title="Streak protection">
          <p style={textStyle}>Remind me when I haven’t trained for {thresholdDays} days</p>
          <input
            type="range"
            min="2"
            max="5"
            value={thresholdDays}
            onChange={(e) => setDevicePrefs((current) => ({ ...current, reminderThresholdDays: Number(e.target.value), lastReminderKey: null }))}
            style={{ width: "100%", accentColor: "#2D7DD2" }}
          />
        </Group>
      )}

      <Group title="Testing">
        <ActionButton onClick={onSendTestReminder} tone="secondary" disabled={!notificationSupported}>Send test reminder</ActionButton>
      </Group>

      <Group title="Device support">
        <p style={smallMutedStyle}>Browser support: {notificationSupported ? "Available" : "Unsupported"}</p>
        <p style={smallMutedStyle}>Service worker: {serviceWorkerSupported ? "Available" : "Unavailable"}</p>
      </Group>
    </>
  );
}
