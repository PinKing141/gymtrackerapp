// Web Push (VAPID) client. Subscribes the browser to push and stores the
// subscription + reminder config on the user's Firestore doc, where the server
// job (server/sendReminders.js) reads it to deliver background reminders even
// when the app is closed.
//
// This is a no-op until VITE_VAPID_PUBLIC_KEY is set, so the app behaves exactly
// as before until the backend is configured.
import { doc, setDoc, serverTimestamp } from "firebase/firestore";
import { db } from "../firebase.js";

const VAPID_PUBLIC_KEY = import.meta.env.VITE_VAPID_PUBLIC_KEY;

export function isPushConfigured() {
  return Boolean(VAPID_PUBLIC_KEY);
}

export function isPushSupported() {
  return (
    typeof window !== "undefined" &&
    "serviceWorker" in navigator &&
    "PushManager" in window &&
    "Notification" in window
  );
}

// VAPID public keys are base64url; the Push API wants a Uint8Array.
function urlBase64ToUint8Array(base64String) {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const raw = atob(base64);
  const output = new Uint8Array(raw.length);
  for (let i = 0; i < raw.length; i += 1) {
    output[i] = raw.charCodeAt(i);
  }
  return output;
}

// Subscribe this device to push and persist it for the server to use.
export async function enablePush(uid, { thresholdDays = 3 } = {}) {
  if (!uid || !isPushConfigured() || !isPushSupported()) {
    return { ok: false, reason: "unavailable" };
  }

  if (Notification.permission !== "granted") {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") {
      return { ok: false, reason: "denied" };
    }
  }

  const registration = await navigator.serviceWorker.ready;
  let subscription = await registration.pushManager.getSubscription();
  if (!subscription) {
    subscription = await registration.pushManager.subscribe({
      userVisibleOnly: true,
      applicationServerKey: urlBase64ToUint8Array(VAPID_PUBLIC_KEY),
    });
  }

  await setDoc(
    doc(db, "users", uid),
    {
      push: {
        // JSON round-trip flattens the PushSubscription to a plain object.
        subscription: JSON.parse(JSON.stringify(subscription)),
        reminderEnabled: true,
        thresholdDays,
        lastPushKey: null,
        updatedAt: serverTimestamp(),
      },
    },
    { merge: true },
  );

  return { ok: true };
}

// Stop background reminders for this device.
export async function disablePush(uid) {
  if (!uid) return { ok: false, reason: "unavailable" };

  if (isPushSupported()) {
    try {
      const registration = await navigator.serviceWorker.ready;
      const subscription = await registration.pushManager.getSubscription();
      if (subscription) {
        await subscription.unsubscribe();
      }
    } catch {
      // best effort
    }
  }

  await setDoc(
    doc(db, "users", uid),
    { push: { reminderEnabled: false, subscription: null, updatedAt: serverTimestamp() } },
    { merge: true },
  );

  return { ok: true };
}
