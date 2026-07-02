import { initializeApp } from "firebase/app";
import { getAuth } from "firebase/auth";
import { getFirestore } from "firebase/firestore";

// Firebase web config is public (it identifies the project; access is controlled
// by Auth + Firestore rules). Embed it as defaults so every build initializes
// correctly, and let env vars override it when present.
const firebaseConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || "AIzaSyA5KWcwkonB-72X5grPWbOdSiDNHQYCVHg",
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || "gymtracker-9eeca.firebaseapp.com",
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || "gymtracker-9eeca",
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || "gymtracker-9eeca.firebasestorage.app",
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || "53227914778",
  appId: import.meta.env.VITE_FIREBASE_APP_ID || "1:53227914778:web:db89f79ab85e1715ff73a3",
};

const app = initializeApp(firebaseConfig);

export const auth = getAuth(app);
export const db = getFirestore(app);
