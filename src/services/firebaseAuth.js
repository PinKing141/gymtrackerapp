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

export function listenToAuth(callback) {
  return onAuthStateChanged(auth, callback);
}

// Redirect (not popup) is the reliable path inside installed PWAs and on iOS
// Safari, where popups get blocked or lose the auth session. The signed-in user
// lands back via onAuthStateChanged after the round trip; getGoogleRedirectResult
// lets the login screen surface any error that happened during it.
export function signInWithGoogle() {
  return signInWithRedirect(auth, googleProvider);
}

export function getGoogleRedirectResult() {
  return getRedirectResult(auth);
}

export function signUpWithEmail(email, password) {
  return createUserWithEmailAndPassword(auth, email, password);
}

export function signInWithEmail(email, password) {
  return signInWithEmailAndPassword(auth, email, password);
}

export function signOutUser() {
  return signOut(auth);
}
