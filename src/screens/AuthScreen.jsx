import { useEffect, useState } from "react";
import { IS } from "../storage.js";
import { ActionButton } from "../components/ui.jsx";
import { colors } from "../theme.js";
import { getGoogleRedirectResult, signInWithEmail, signInWithGoogle, signUpWithEmail } from "../services/firebaseAuth.js";

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
  "auth/unauthorized-domain": "This site isn't authorized for Google sign-in yet. Add it in Firebase → Authentication → Settings → Authorized domains.",
  "auth/account-exists-with-different-credential": "You already have an account with this email. Sign in with your email and password.",
};

function messageForError(error) {
  return ERROR_MESSAGES[error?.code] || "Something went wrong. Please try again.";
}

export function AuthScreen() {
  const [mode, setMode] = useState("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState(null);

  const isSignup = mode === "signup";

  // After a Google redirect returns to the app, surface any error from the round
  // trip (a success is handled by the auth listener, which unmounts this screen).
  useEffect(() => {
    let active = true;
    getGoogleRedirectResult().catch((err) => {
      if (active) setError(messageForError(err));
    });
    return () => {
      active = false;
    };
  }, []);

  const handleSubmit = async (event) => {
    event.preventDefault();
    if (submitting) return;

    const trimmedEmail = email.trim();
    if (!trimmedEmail || !password) {
      setError("Enter your email and password.");
      return;
    }

    if (isSignup) {
      if (password.length < 6) {
        setError("Password must be at least 6 characters.");
        return;
      }
      if (!confirmPassword) {
        setError("Confirm your password.");
        return;
      }
      if (password !== confirmPassword) {
        setError("Passwords don't match.");
        return;
      }
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
    setConfirmPassword("");
  };

  const handleGoogle = async () => {
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      // This navigates away to Google and returns to the app; the result is
      // picked up by the auth listener / getGoogleRedirectResult on return.
      await signInWithGoogle();
    } catch (err) {
      // Only reached if starting the redirect itself failed.
      setError(messageForError(err));
      setSubmitting(false);
    }
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
        {isSignup && (
          <input
            type="password"
            autoComplete="new-password"
            value={confirmPassword}
            onChange={(event) => setConfirmPassword(event.target.value)}
            placeholder="Confirm password"
            style={{ ...IS, marginTop: 10, padding: "12px" }}
          />
        )}

        {error && (
          <p style={{ fontSize: 12, color: colors.danger, margin: "12px 2px 0" }}>{error}</p>
        )}

        <ActionButton type="submit" disabled={submitting} style={{ marginTop: 18 }}>
          {submitting ? "Working…" : isSignup ? "Create Account" : "Sign In"}
        </ActionButton>
      </form>

      <div style={{ display: "flex", alignItems: "center", gap: 10, margin: "18px 2px" }}>
        <span style={{ flex: 1, height: 1, background: colors.border }} />
        <span style={{ fontSize: 10, color: colors.textMuted, letterSpacing: "0.08em", textTransform: "uppercase", fontWeight: 700 }}>or</span>
        <span style={{ flex: 1, height: 1, background: colors.border }} />
      </div>

      <button
        type="button"
        onClick={handleGoogle}
        disabled={submitting}
        style={{
          width: "100%",
          display: "flex",
          alignItems: "center",
          justifyContent: "center",
          gap: 10,
          padding: "13px",
          borderRadius: 12,
          border: `1px solid ${colors.borderStrong}`,
          background: "rgba(255,255,255,0.04)",
          color: colors.textPrimary,
          fontFamily: "inherit",
          fontSize: 14,
          fontWeight: 700,
          cursor: submitting ? "not-allowed" : "pointer",
          opacity: submitting ? 0.5 : 1,
        }}
      >
        <svg width="18" height="18" viewBox="0 0 18 18" aria-hidden="true">
          <path fill="#4285F4" d="M17.64 9.2c0-.64-.06-1.25-.16-1.84H9v3.48h4.84a4.14 4.14 0 0 1-1.8 2.72v2.26h2.92c1.7-1.57 2.68-3.88 2.68-6.62z" />
          <path fill="#34A853" d="M9 18c2.43 0 4.47-.8 5.96-2.18l-2.92-2.26c-.8.54-1.84.86-3.04.86-2.34 0-4.32-1.58-5.03-3.7H.96v2.33A9 9 0 0 0 9 18z" />
          <path fill="#FBBC05" d="M3.97 10.72a5.4 5.4 0 0 1 0-3.44V4.95H.96a9 9 0 0 0 0 8.1l3.01-2.33z" />
          <path fill="#EA4335" d="M9 3.58c1.32 0 2.5.45 3.44 1.35l2.58-2.58C13.47.89 11.43 0 9 0A9 9 0 0 0 .96 4.95l3.01 2.33C4.68 5.16 6.66 3.58 9 3.58z" />
        </svg>
        {submitting ? "Redirecting…" : "Continue with Google"}
      </button>

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
