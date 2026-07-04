import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

const requiredFirebaseEnv = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY,
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN,
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID,
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET,
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID,
  appId: import.meta.env.VITE_FIREBASE_APP_ID,
};

const missingFirebaseEnv = Object.entries(requiredFirebaseEnv)
  .filter(([, value]) => !value)
  .map(([key]) => key);

export const firebaseConfigured = missingFirebaseEnv.length === 0;

if (!firebaseConfigured) {
  console.warn(
    `Firebase config is missing: ${missingFirebaseEnv.join(", ")}. ` +
      "Running Orion Gym in local-only mode.",
  );
}

const app = firebaseConfigured ? initializeApp(requiredFirebaseEnv) : null;

export const auth = app ? getAuth(app) : null;
export const db = app ? getFirestore(app) : null;
