// Scheduled sender: finds users whose training is overdue and pushes a reminder
// to every device they've registered. Designed to run on a cron (see
// .github/workflows/push-reminders.yml) — no always-on server required.
//
// Required env:
//   FIREBASE_SERVICE_ACCOUNT  - JSON of a Firebase service account key
//   VAPID_PUBLIC_KEY          - from generate-vapid-keys.js
//   VAPID_PRIVATE_KEY         - from generate-vapid-keys.js
//   VAPID_SUBJECT             - a contact URL, e.g. "mailto:you@example.com"
import admin from "firebase-admin";
import webpush from "web-push";

function requireEnv(name) {
  const value = process.env[name];
  if (!value) {
    console.error(`Missing required env var: ${name}`);
    process.exit(1);
  }
  return value;
}

const serviceAccount = JSON.parse(requireEnv("FIREBASE_SERVICE_ACCOUNT"));
const VAPID_PUBLIC_KEY = requireEnv("VAPID_PUBLIC_KEY");
const VAPID_PRIVATE_KEY = requireEnv("VAPID_PRIVATE_KEY");
const VAPID_SUBJECT = process.env.VAPID_SUBJECT || "mailto:admin@example.com";

admin.initializeApp({ credential: admin.credential.cert(serviceAccount) });
webpush.setVapidDetails(VAPID_SUBJECT, VAPID_PUBLIC_KEY, VAPID_PRIVATE_KEY);

const db = admin.firestore();

function todayKey() {
  return new Date().toISOString().slice(0, 10);
}

// Days since the most recent logged session, or null if the user has never
// trained (matches the in-app rule, which skips reminders for those users).
function daysSinceLastSession(appData) {
  const sessions = Array.isArray(appData?.sessions) ? appData.sessions : [];
  const lastDate = sessions.reduce((max, s) => (s?.date && s.date > max ? s.date : max), "");
  if (!lastDate) return null;
  const last = new Date(`${lastDate}T00:00:00Z`).getTime();
  const now = new Date(`${todayKey()}T00:00:00Z`).getTime();
  return Math.floor((now - last) / 86400000);
}

function reminderBody(days) {
  if (days === 1) return "It's been a day since your last session. Keep the streak alive.";
  return `It's been ${days} days since your last session. Time to train.`;
}

async function run() {
  const key = todayKey();
  const snapshot = await db.collection("users").get();
  let sent = 0;
  let skipped = 0;
  let pruned = 0;

  for (const docSnap of snapshot.docs) {
    const data = docSnap.data() || {};
    const push = data.push;

    if (!push?.reminderEnabled || !push?.subscription) {
      skipped += 1;
      continue;
    }

    // Only one reminder per user per day.
    if (push.lastPushKey === key) {
      skipped += 1;
      continue;
    }

    const days = daysSinceLastSession(data.appData);
    const threshold = Number(push.thresholdDays) || 3;
    if (days === null || days < threshold) {
      skipped += 1;
      continue;
    }

    const payload = JSON.stringify({
      title: "Time to train",
      body: reminderBody(days),
      tag: "orion-gym-reminder",
      data: { url: "./" },
    });

    try {
      await webpush.sendNotification(push.subscription, payload);
      await docSnap.ref.set({ push: { lastPushKey: key } }, { merge: true });
      sent += 1;
    } catch (error) {
      // 404/410 mean the subscription is dead — clear it so we stop trying.
      if (error?.statusCode === 404 || error?.statusCode === 410) {
        await docSnap.ref.set(
          { push: { subscription: null, reminderEnabled: false } },
          { merge: true },
        );
        pruned += 1;
      } else {
        console.error(`Push failed for ${docSnap.id}:`, error?.statusCode || error?.message || error);
      }
    }
  }

  console.log(`Done. sent=${sent} skipped=${skipped} pruned=${pruned} total=${snapshot.size}`);
}

run()
  .then(() => process.exit(0))
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });
