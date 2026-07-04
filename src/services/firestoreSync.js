import { doc, getDoc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

export async function loadUserAppData(userId) {
  if (!userId || !db) return null;

  const ref = doc(db, "users", userId);
  const snap = await getDoc(ref);

  if (!snap.exists()) return null;

  return snap.data();
}

export async function saveUserAppData(userId, appData) {
  if (!userId || !db) return null;

  const ref = doc(db, "users", userId);

  await setDoc(
    ref,
    {
      appData,
      updatedAt: serverTimestamp(),
    },
    { merge: true }
  );

  return true;
}
