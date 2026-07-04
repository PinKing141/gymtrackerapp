import { Icon } from "./icons.jsx";
import { getDisplayName, getInitials } from "../profileSummary.js";

// Shared profile avatar: shows the user's photo when set, otherwise their
// initials on a gradient. Pass onClick to make it a button (with an optional
// "+" edit badge).
export function Avatar({ profile = {}, size = 44, radius = 14, fontSize = 17, onClick, badge = false, badgeBorder = "#0A0A0F" }) {
  const initials = getInitials(getDisplayName(profile));

  const inner = profile?.avatar
    ? <img src={profile.avatar} alt="" style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", display: "block" }} />
    : (
      <div style={{ width: size, height: size, borderRadius: radius, display: "flex", alignItems: "center", justifyContent: "center", background: "linear-gradient(140deg, #4EA1FF, #8B5CF6)", color: "#fff", fontSize, fontWeight: 800 }}>
        {initials}
      </div>
    );

  if (!onClick) {
    return inner;
  }

  return (
    <button type="button" onClick={onClick} style={{ position: "relative", border: "none", background: "none", padding: 0, cursor: "pointer", lineHeight: 0, flexShrink: 0 }}>
      {inner}
      {badge && (
        <span style={{ position: "absolute", right: -3, bottom: -3, width: 22, height: 22, borderRadius: 999, background: "#4EA1FF", display: "flex", alignItems: "center", justifyContent: "center", border: `2px solid ${badgeBorder}` }}>
          <Icon name="plus" size={12} color="#fff" strokeWidth={2.6} />
        </span>
      )}
    </button>
  );
}
