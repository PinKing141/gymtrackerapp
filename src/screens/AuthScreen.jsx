import { useState } from "react";
import { IS } from "../storage.js";
import { ActionButton } from "../components/ui.jsx";
import { colors } from "../theme.js";
import { signInWithEmail, signUpWithEmail } from "../services/firebaseAuth.js";

const ERROR_MESSAGES = {
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/missing-password": "Enter your password.",
  "auth/invalid-credential": "Email or password is incorrect.",
  "auth/wrong-password": "Email or password is incorrect.",
  "auth/user-not-found": "No account found for that email.",
  "auth/email-already-in-use": "An account already exists for that email.",
  "auth/weak-password": "Password must be at least 6 characters.",
  "auth/too-many-requests": "Too many attempts. Try again in a moment.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

function messageForError(error) {
  return ERROR_MESSAGES[error?.code] || "Something went wrong. Please try again.";
}

export function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isSignup = mode === "signup";

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    setSubmitting(true);
    setError(null);
    try {
      // On success the auth listener flips the app into its signed-in view.
      if (isSignup) {
        await signUpWithEmail(trimmedEmail, password);
      } else {
        await signInWithEmail(trimmedEmail, password);
      }
    } catch (err) {
      setError(messageForError(err));
      setSubmitting(false);
    }
  };

  const switchMode = (next) => {
    setMode(next);
    setError(null);
  };

  return (
    <div
      style={{
        minHeight: "100dvh",
        display: "flex",
        flexDirection: "column",
        justifyContent: "center",
        padding: "calc(env(safe-area-inset-top, 0px) + 32px) 24px calc(env(safe-area-inset-bottom, 0px) + 32px)",
        boxSizing: "border-box",
      }}
    >
      <div style={{ textAlign: "center", marginBottom: 28 }}>
        <div
          style={{
            width: 72,
            height: 72,
            margin: "0 auto 16px",
            borderRadius: 22,
            display: "flex",
            alignItems: "center",
            justifyContent: "center",
            background: "linear-gradient(180deg, rgba(78,161,255,0.16), rgba(10,10,15,0.4))",
            border: `1px solid ${colors.accent}44`,
          }}
        >
          <svg width="40" height="40" viewBox="0 0 40 40" fill="none" aria-hidden="true">
            <circle cx="20" cy="20" r="13" stroke={colors.accent} strokeWidth="3.4" />
            <circle cx="15.5" cy="24" r="1.7" fill={colors.textPrimary} />
            <circle cx="20" cy="21" r="1.9" fill={colors.textPrimary} />
            <circle cx="24.5" cy="17.5" r="1.7" fill={colors.textPrimary} />
          </svg>
        </div>
        <h1 style={{ fontSize: 26, fontWeight: 700, margin: 0, color: colors.textPrimary }}>Orion Gym</h1>
        <p style={{ fontSize: 13, color: colors.textSecondary, margin: "6px 0 0" }}>
          {isSignup ? "Create an account to sync your training." : "Sign in to sync your training."}
        </p>
      </div>

      <div
        style={{
          display: "flex",
          gap: 6,
          padding: 4,
          borderRadius: 12,
          background: "rgba(255,255,255,0.04)",
          border: `1px solid ${colors.border}`,
          marginBottom: 16,
        }}
      >
        {[
          { id: "signin", label: "Sign In" },
          { id: "signup", label: "Create Account" },
        ].map((tab) => (
          <button
            key={tab.id}
            type="button"
            onClick={() => switchMode(tab.id)}
            style={{
              flex: 1,
              padding: "9px 0",
              borderRadius: 9,
              border: "none",
              cursor: "pointer",
              fontFamily: "inherit",
              fontSize: 12,
              fontWeight: 700,
              background: mode === tab.id ? "rgba(78,161,255,0.18)" : "transparent",
              color: mode === tab.id ? colors.accent : colors.textMuted,
            }}
          >
            {tab.label}
          </button>
        ))}
      </div>

      <form onSubmit={handleSubmit}>
        <input
          type="email"
          autoComplete="email"
          inputMode="email"
          value={email}
          onChange={(event) => setEmail(event.target.value)}
          placeholder="Email"
          style={{ ...IS, marginBottom: 10, padding: "12px" }}
        />
        <input
          type="password"
          autoComplete={isSignup ? "new-password" : "current-password"}
          value={password}
          onChange={(event) => setPassword(event.target.value)}
          placeholder="Password"
          style={{ ...IS, padding: "12px" }}
        />

        {error && (
          <p style={{ fontSize: 12, color: colors.danger, margin: "12px 2px 0" }}>{error}</p>
        )}

        <ActionButton type="submit" disabled={submitting} style={{ marginTop: 18 }}>
          {submitting ? "Working…" : isSignup ? "Create Account" : "Sign In"}
        </ActionButton>
      </form>

      <p style={{ fontSize: 11, color: colors.textMuted, textAlign: "center", margin: "20px 0 0" }}>
        {isSignup ? "Already have an account? " : "New here? "}
        <button
          type="button"
          onClick={() => switchMode(isSignup ? "signin" : "signup")}
          style={{
            background: "none",
            border: "none",
            padding: 0,
            cursor: "pointer",
            fontFamily: "inherit",
            fontSize: 11,
            fontWeight: 700,
            color: colors.accent,
          }}
        >
          {isSignup ? "Sign in" : "Create one"}
        </button>
      </p>
    </div>
  );
}
