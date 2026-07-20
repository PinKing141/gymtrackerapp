import { useState } from "react";
import { ConfirmModal } from "./ConfirmModal.jsx";
import { ActionButton } from "./ui.jsx";
import { SettingsField as Field, SettingsGroup as Group } from "./ProfileSettings.jsx";
import { IS } from "../storage.js";
import {
  changeEmail,
  changePassword,
  isPasswordAccount,
  refreshCurrentUser,
  sendVerificationEmail,
} from "../services/firebaseAuth.js";

const ERROR_MESSAGES = {
  "auth/invalid-credential": "Current password is incorrect.",
  "auth/wrong-password": "Current password is incorrect.",
  "auth/missing-password": "Enter your current password.",
  "auth/weak-password": "New password must be at least 6 characters.",
  "auth/invalid-email": "That email address doesn't look right.",
  "auth/email-already-in-use": "An account already exists for that email.",
  "auth/operation-not-allowed": "This change isn't available right now.",
  "auth/requires-recent-login": "For security, sign out and sign back in, then try again.",
  "auth/too-many-requests": "Too many attempts. Try again in a moment.",
  "auth/network-request-failed": "Network error. Check your connection.",
};

function describeError(error) {
  return ERROR_MESSAGES[error?.code] || "Something went wrong. Please try again.";
}

function StatusText({ status }) {
  if (!status) return null;
  return <p style={{ margin: 0, fontSize: 12, color: status.ok ? "#7FD98A" : "#FF8A8A" }}>{status.text}</p>;
}

// Account security & lifecycle controls for the Account settings section:
// email verification, password/email change (email-password accounts only),
// removing the account's data from this device, and full account deletion.
export function AccountSecurity({ firebaseUser, onRemoveFromDevice, onDeleteAccount }) {
  const passwordAccount = isPasswordAccount(firebaseUser);

  // Verification state is tracked locally so "Refresh status" can surface a
  // just-clicked link without waiting for a new auth event.
  const [verified, setVerified] = useState(Boolean(firebaseUser?.emailVerified));
  const [verifyStatus, setVerifyStatus] = useState(null);
  const [verifyBusy, setVerifyBusy] = useState(false);

  const [currentPw, setCurrentPw] = useState("");
  const [newPw, setNewPw] = useState("");
  const [confirmPw, setConfirmPw] = useState("");
  const [pwStatus, setPwStatus] = useState(null);
  const [pwBusy, setPwBusy] = useState(false);

  const [emailPw, setEmailPw] = useState("");
  const [newEmail, setNewEmail] = useState("");
  const [emailStatus, setEmailStatus] = useState(null);
  const [emailBusy, setEmailBusy] = useState(false);

  const [deletePw, setDeletePw] = useState("");
  const [deleteStatus, setDeleteStatus] = useState(null);
  const [deleteBusy, setDeleteBusy] = useState(false);
  const [removeOpen, setRemoveOpen] = useState(false);
  const [deleteOpen, setDeleteOpen] = useState(false);

  const resendVerification = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setVerifyStatus(null);
    try {
      await sendVerificationEmail();
      setVerifyStatus({ ok: true, text: "Verification email sent. Check your inbox and spam folder." });
    } catch (error) {
      setVerifyStatus({ ok: false, text: describeError(error) });
    }
    setVerifyBusy(false);
  };

  const refreshVerification = async () => {
    if (verifyBusy) return;
    setVerifyBusy(true);
    setVerifyStatus(null);
    try {
      const user = await refreshCurrentUser();
      const isVerified = Boolean(user?.emailVerified);
      setVerified(isVerified);
      setVerifyStatus(isVerified ? { ok: true, text: "Email verified." } : { ok: false, text: "Not verified yet. Click the link in the email, then refresh again." });
    } catch (error) {
      setVerifyStatus({ ok: false, text: describeError(error) });
    }
    setVerifyBusy(false);
  };

  const submitPasswordChange = async () => {
    if (pwBusy) return;
    if (!currentPw) {
      setPwStatus({ ok: false, text: "Enter your current password." });
      return;
    }
    if (newPw.length < 6) {
      setPwStatus({ ok: false, text: "New password must be at least 6 characters." });
      return;
    }
    if (newPw !== confirmPw) {
      setPwStatus({ ok: false, text: "New passwords don't match." });
      return;
    }
    setPwBusy(true);
    setPwStatus(null);
    try {
      await changePassword(currentPw, newPw);
      setCurrentPw("");
      setNewPw("");
      setConfirmPw("");
      setPwStatus({ ok: true, text: "Password updated." });
    } catch (error) {
      setPwStatus({ ok: false, text: describeError(error) });
    }
    setPwBusy(false);
  };

  const submitEmailChange = async () => {
    if (emailBusy) return;
    const trimmed = newEmail.trim();
    if (!emailPw) {
      setEmailStatus({ ok: false, text: "Enter your current password." });
      return;
    }
    if (!trimmed) {
      setEmailStatus({ ok: false, text: "Enter the new email address." });
      return;
    }
    setEmailBusy(true);
    setEmailStatus(null);
    try {
      await changeEmail(emailPw, trimmed);
      setEmailPw("");
      setNewEmail("");
      setEmailStatus({ ok: true, text: `Confirmation link sent to ${trimmed}. Your email changes once you click it.` });
    } catch (error) {
      setEmailStatus({ ok: false, text: describeError(error) });
    }
    setEmailBusy(false);
  };

  const confirmDelete = async () => {
    setDeleteOpen(false);
    if (deleteBusy) return;
    setDeleteBusy(true);
    setDeleteStatus(null);
    try {
      // On success the auth listener signs the app out; no message survives it.
      await onDeleteAccount?.(deletePw);
    } catch (error) {
      setDeleteStatus({ ok: false, text: describeError(error) });
      setDeleteBusy(false);
    }
  };

  return (
    <>
      {passwordAccount && !verified && (
        <Group title="Email verification">
          <p style={{ margin: 0, color: "#FFCA8A", fontSize: 12 }}>Your email address isn't verified yet. Verifying protects account recovery.</p>
          <ActionButton compact tone="tinted" color="#F5A623" disabled={verifyBusy} onClick={resendVerification}>Resend verification email</ActionButton>
          <ActionButton compact tone="secondary" disabled={verifyBusy} onClick={refreshVerification}>I've clicked the link — refresh status</ActionButton>
          <StatusText status={verifyStatus} />
        </Group>
      )}

      {passwordAccount ? (
        <>
          <Group title="Change password">
            <Field label="Current password">
              <input style={IS} type="password" autoComplete="current-password" value={currentPw} onChange={(e) => setCurrentPw(e.target.value)} />
            </Field>
            <Field label="New password">
              <input style={IS} type="password" autoComplete="new-password" value={newPw} onChange={(e) => setNewPw(e.target.value)} />
            </Field>
            <Field label="Confirm new password">
              <input style={IS} type="password" autoComplete="new-password" value={confirmPw} onChange={(e) => setConfirmPw(e.target.value)} />
            </Field>
            <ActionButton compact tone="tinted" color="#2D7DD2" disabled={pwBusy} onClick={submitPasswordChange}>{pwBusy ? "Working…" : "Update password"}</ActionButton>
            <StatusText status={pwStatus} />
          </Group>

          <Group title="Change email">
            <Field label="Current password">
              <input style={IS} type="password" autoComplete="current-password" value={emailPw} onChange={(e) => setEmailPw(e.target.value)} />
            </Field>
            <Field label="New email">
              <input style={IS} type="email" inputMode="email" autoComplete="email" value={newEmail} onChange={(e) => setNewEmail(e.target.value)} />
            </Field>
            <p style={{ margin: 0, color: "#8A8F9C", fontSize: 12 }}>We'll send a confirmation link to the new address. Your email only changes after you click it.</p>
            <ActionButton compact tone="tinted" color="#2D7DD2" disabled={emailBusy} onClick={submitEmailChange}>{emailBusy ? "Working…" : "Send confirmation link"}</ActionButton>
            <StatusText status={emailStatus} />
          </Group>
        </>
      ) : (
        <Group title="Sign-in method">
          <p style={{ margin: 0, color: "#fff" }}>Signed in with <strong>Google</strong></p>
          <p style={{ margin: 0, color: "#8A8F9C", fontSize: 12 }}>Your password and email address are managed by your Google account.</p>
        </Group>
      )}

      <Group title="This device">
        <p style={{ margin: 0, color: "#8A8F9C", fontSize: 12 }}>Removes this account's data from this device only. Your cloud copy is untouched and comes back when you sign in again.</p>
        <ActionButton compact tone="secondary" onClick={() => setRemoveOpen(true)}>Remove this account from this device</ActionButton>
      </Group>

      <Group title="Delete account">
        <p style={{ margin: 0, color: "#FF8A8A", fontSize: 12 }}>Permanently deletes your account, your cloud data and this device's copy. This can't be undone.</p>
        {passwordAccount && (
          <Field label="Current password">
            <input style={IS} type="password" autoComplete="current-password" value={deletePw} onChange={(e) => setDeletePw(e.target.value)} />
          </Field>
        )}
        <ActionButton
          compact
          tone="danger"
          disabled={deleteBusy || (passwordAccount && !deletePw)}
          onClick={() => setDeleteOpen(true)}
        >
          {deleteBusy ? "Deleting…" : "Delete account & cloud data"}
        </ActionButton>
        <StatusText status={deleteStatus} />
      </Group>

      <ConfirmModal
        open={removeOpen}
        title="Remove from this device?"
        message="This signs you out and deletes this account's local data from this device. Your cloud data stays safe and syncs back on your next sign-in."
        confirmLabel="Remove & sign out"
        onCancel={() => setRemoveOpen(false)}
        onConfirm={() => { setRemoveOpen(false); onRemoveFromDevice?.(); }}
      />
      <ConfirmModal
        open={deleteOpen}
        title="Delete account?"
        message="Your account, cloud data and this device's copy will be permanently deleted. This can't be undone."
        requireText="DELETE"
        confirmLabel="Delete forever"
        onCancel={() => setDeleteOpen(false)}
        onConfirm={confirmDelete}
      />
    </>
  );
}
