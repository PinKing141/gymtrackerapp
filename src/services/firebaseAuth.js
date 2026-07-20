import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
  getAdditionalUserInfo,
  sendPasswordResetEmail,
  sendEmailVerification,
  updatePassword,
  verifyBeforeUpdateEmail,
  reauthenticateWithCredential,
  EmailAuthProvider,
  deleteUser,
  reload,
} from "firebase/auth";
import { auth } from "../firebase.js";

const googleProvider = new GoogleAuthProvider();

function firebaseUnavailableError() {
  const error = new Error("Firebase is not configured.");
  error.code = "auth/firebase-not-configured";
  return error;
}

function noUserError() {
  const error = new Error("No account is signed in.");
  error.code = "auth/no-current-user";
  return error;
}

export function listenToAuth(callback) {
  if (!auth) {
    const timeoutId = setTimeout(() => callback(null), 0);
    return () => clearTimeout(timeoutId);
  }
  return onAuthStateChanged(auth, callback);
}

// Redirect (not popup) is the reliable path inside installed PWAs and on iOS
// Safari, where popups get blocked or lose the auth session. The signed-in user
// lands back via onAuthStateChanged after the round trip; getGoogleRedirectResult
// lets the login screen surface any error that happened during it.
export function signInWithGoogle() {
  if (!auth) return Promise.reject(firebaseUnavailableError());
  return signInWithRedirect(auth, googleProvider);
}

// getRedirectResult only yields the credential to its first caller, so the
// resolution is cached: the login screen (for errors) and the boot effect (for
// the new-account check) both need to see the same result.
let redirectResultPromise = null;

function resolveRedirectResult() {
  if (!redirectResultPromise) {
    redirectResultPromise = getRedirectResult(auth).then((result) => {
      // A first-time Google sign-in is a brand-new account: mark it so the app
      // boots it blank + straight to onboarding, same as an email signup.
      if (result?.user && getAdditionalUserInfo(result)?.isNewUser) {
        recentSignupUid = result.user.uid;
      }
      return result;
    });
  }
  return redirectResultPromise;
}

export function getGoogleRedirectResult() {
  if (!auth) return Promise.resolve(null);
  return resolveRedirectResult();
}

// Boot-effect variant: the redirect result races with onAuthStateChanged, so the
// app waits for it before deciding whether a signed-in uid is a fresh signup.
// Errors are surfaced by the login screen's own call and swallowed here.
export function waitForPendingRedirect() {
  if (!auth) return Promise.resolve(null);
  return resolveRedirectResult().catch(() => null);
}

// Tracks the uid of an account created in this session so the app can boot it as
// a brand-new profile (blank + straight to onboarding) rather than reconciling it
// against local/cloud data as if it were a returning user.
let recentSignupUid = null;

export function consumeRecentSignup(uid) {
  if (uid && recentSignupUid === uid) {
    recentSignupUid = null;
    return true;
  }
  return false;
}

export async function signUpWithEmail(email, password) {
  if (!auth) return Promise.reject(firebaseUnavailableError());
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  recentSignupUid = credential.user?.uid || null;
  // Best effort — verification status lives in Account settings with a resend.
  if (credential.user) {
    sendEmailVerification(credential.user).catch(() => {});
  }
  return credential;
}

export function signInWithEmail(email, password) {
  if (!auth) return Promise.reject(firebaseUnavailableError());
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}

export function sendPasswordReset(email) {
  if (!auth) return Promise.reject(firebaseUnavailableError());
  return sendPasswordResetEmail(auth, email);
}

// True when the account can sign in with an email + password (as opposed to
// only through Google). Password/email management is only offered to these.
export function isPasswordAccount(user) {
  return Boolean(user?.providerData?.some((provider) => provider.providerId === "password"));
}

export function sendVerificationEmail() {
  if (!auth) return Promise.reject(firebaseUnavailableError());
  if (!auth.currentUser) return Promise.reject(noUserError());
  return sendEmailVerification(auth.currentUser);
}

// Re-fetches the user's server-side state (e.g. emailVerified after they click
// the link). Returns the refreshed user.
export async function refreshCurrentUser() {
  if (!auth?.currentUser) return null;
  await reload(auth.currentUser);
  return auth.currentUser;
}

// Sensitive operations (password/email change, deletion) need a recent sign-in.
// Password accounts prove it inline with their current password; Google accounts
// have no password, so they rely on their session being recent enough.
export async function reauthenticateUser(currentPassword) {
  if (!auth) throw firebaseUnavailableError();
  const user = auth.currentUser;
  if (!user) throw noUserError();
  if (!isPasswordAccount(user)) return user;
  const credential = EmailAuthProvider.credential(user.email, currentPassword);
  await reauthenticateWithCredential(user, credential);
  return user;
}

export async function changePassword(currentPassword, newPassword) {
  const user = await reauthenticateUser(currentPassword);
  await updatePassword(user, newPassword);
}

// The new address only takes effect after the user clicks the link Firebase
// sends to it, so a typo can't lock them out of the account.
export async function changeEmail(currentPassword, newEmail) {
  const user = await reauthenticateUser(currentPassword);
  await verifyBeforeUpdateEmail(user, newEmail);
}

export async function deleteCurrentUser() {
  if (!auth) throw firebaseUnavailableError();
  const user = auth.currentUser;
  if (!user) throw noUserError();
  await deleteUser(user);
}
