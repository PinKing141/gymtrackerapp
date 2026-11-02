import { Icon } from "../../components/icons.jsx";

// Photo if set, initials otherwise.
export function ProfileAvatar({ profile, initials, size, radius, fontSize }) {
  if (profile.avatar) {
    return (
      <img
        src={profile.avatar}
        alt=""
        style={{ width: size, height: size, borderRadius: radius, objectFit: "cover", flexShrink: 0, display: "block" }}
      />
    );
  }

  return (
    <div
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        flexShrink: 0,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(140deg, #4EA1FF, #8B5CF6)",
        color: "#fff",
        fontSize,
        fontWeight: 800,
      }}
    >
      {initials}
    </div>
  );
}

// Avatar with a small "+" badge; tapping it opens the photo picker.
// `ringColor` matches the badge border to the background it sits on.
export function AvatarEditButton({ ringColor, onClick, ...avatarProps }) {
  return (
    <button
      type="button"
      onClick={onClick}
      style={{ position: "relative", border: "none", background: "none", padding: 0, cursor: "pointer", flexShrink: 0, lineHeight: 0 }}
    >
      <ProfileAvatar {...avatarProps} />
      <span
        style={{
          position: "absolute",
          right: -3,
          bottom: -3,
          width: 22,
          height: 22,
          borderRadius: 999,
          background: "#4EA1FF",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          border: `2px solid ${ringColor}`,
        }}
      >
        <Icon name="plus" size={12} color="#fff" strokeWidth={2.6} />
      </span>
    </button>
  );
}
