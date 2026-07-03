import { Icon } from "./icons.jsx";
import { BackButton, ScreenHeader, SurfaceButton, SurfaceCard } from "./ui.jsx";

export function ProfileRow({ icon, label, summary, onClick, danger = false }) {
  return (
    <SurfaceButton onClick={onClick} style={{ display: "flex", alignItems: "center", gap: 14, minHeight: 58, padding: "14px 16px", borderColor: danger ? "rgba(255,93,93,0.3)" : undefined }}>
      <div style={{ width: 34, height: 34, borderRadius: 10, display: "flex", alignItems: "center", justifyContent: "center", background: danger ? "rgba(255,93,93,0.1)" : "rgba(255,255,255,0.04)", border: "1px solid rgba(255,255,255,0.08)" }}>
        <Icon name={icon} size={18} color={danger ? "#FF5D5D" : "#9AA4B3"} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}><p style={{ fontSize: 14, fontWeight: 700, margin: 0, color: danger ? "#FF8A8A" : "#fff" }}>{label}</p></div>
      <span style={{ maxWidth: "48%", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap", color: "#8A8F9C", fontSize: 12, textAlign: "right" }}>{summary}</span>
      <span style={{ color: danger ? "#FF8A8A" : "#555", fontSize: 18 }}>›</span>
    </SurfaceButton>
  );
}

export function DangerRow(props) {
  return <ProfileRow {...props} danger />;
}

export function SettingsGroup({ title, children }) {
  return <SurfaceCard><p style={{ fontSize: 11, color: "#555", margin: "0 0 10px", letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>{title}</p><div style={{ display: "grid", gap: 10 }}>{children}</div></SurfaceCard>;
}

export function SettingsField({ label, children }) {
  return <label style={{ display: "grid", gap: 6, fontSize: 11, color: "#8A8F9C", fontWeight: 700 }}>{label}{children}</label>;
}

export function ToggleRow({ label, desc, on, onClick, disabled }) {
  return <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "center" }}><div><p style={{ margin: 0, color: "#fff", fontWeight: 700 }}>{label}</p>{desc && <p style={{ margin: "2px 0 0", color: "#8A8F9C", fontSize: 11 }}>{desc}</p>}</div><Toggle on={on} onClick={onClick} disabled={disabled} /></div>;
}

export function SliderRow({ label, children }) {
  return <div style={{ display: "grid", gap: 8 }}><p style={{ margin: 0, color: "#fff", fontWeight: 700 }}>{label}</p>{children}</div>;
}

export function Toggle({ on, onClick, disabled }) {
  return <button type="button" disabled={disabled} onClick={onClick} style={{ width: 44, height: 26, borderRadius: 999, flexShrink: 0, border: "none", cursor: disabled ? "default" : "pointer", padding: 0, background: on ? "#4EA1FF" : "rgba(255,255,255,0.14)", position: "relative", opacity: disabled ? 0.6 : 1 }}><div style={{ position: "absolute", top: 3, left: on ? 21 : 3, width: 20, height: 20, borderRadius: 999, background: "#fff" }} /></button>;
}

export function SubScreenHeader({ title, subtitle, onBack }) {
  return <ScreenHeader action={<BackButton onClick={onBack} />} title={title} subtitle={subtitle} topPadding="calc(env(safe-area-inset-top, 0px) + 20px)" />;
}
