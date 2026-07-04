import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
  GoogleAuthProvider,
  signInWithRedirect,
  getRedirectResult,
} from "firebase/auth";
import { auth } from "../firebase.js";

const googleProvider = new GoogleAuthProvider();

function firebaseUnavailableError() {
  const error = new Error("Firebase is not configured.");
  error.code = "auth/firebase-not-configured";
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

export function getGoogleRedirectResult() {
  if (!auth) return Promise.resolve(null);
  return getRedirectResult(auth);
}

export function signUpWithEmail(email, password) {
  if (!auth) return Promise.reject(firebaseUnavailableError());
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email, password) {
  if (!auth) return Promise.reject(firebaseUnavailableError());
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  if (!auth) return Promise.resolve();
  return signOut(auth);
}
