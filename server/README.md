# Orion Gym — Web Push reminder backend

Background training reminders that fire **even when the app is closed**, using
standard Web Push (VAPID). No always-on server: a GitHub Actions cron runs the
sender once a day.

## How it fits together

1. **Client** (`src/services/push.js`) subscribes the browser to push when the
   user enables reminders, and stores the subscription on their Firestore doc:
   `users/{uid}.push = { subscription, reminderEnabled, thresholdDays, lastPushKey }`.
2. **Service worker** (`public/sw.js`) receives the `push` event and shows the
   notification; tapping it focuses/opens the app.
3. **Sender** (`server/sendReminders.js`) runs on a schedule, finds users whose
   last session is older than their threshold, and pushes a reminder to their
   devices. Dead subscriptions (410/404) are pruned automatically.

Everything is a no-op until `VITE_VAPID_PUBLIC_KEY` is set, so the app keeps
working unchanged until you finish setup.

## Setup

### 1. Generate VAPID keys

```bash
cd server
npm install
npm run generate-keys
```

### 2. Configure the web app

Add the **public** key to the web build environment (same place as the other
`VITE_FIREBASE_*` vars — e.g. GitHub repo → Settings → Secrets and variables →
Actions → Variables, or your `.env`):

```
VITE_VAPID_PUBLIC_KEY=<public key>
```

Redeploy the site. Now "Enable reminders" in Profile → Notifications will also
register the device for push.

### 3. Get a Firebase service account

Firebase Console → Project settings → Service accounts → **Generate new private
key**. This downloads a JSON file. Keep it secret.

### 4. Add the sender's secrets

Repo → Settings → Secrets and variables → **Actions** → Secrets:

| Secret | Value |
| --- | --- |
| `FIREBASE_SERVICE_ACCOUNT` | the entire service-account JSON, pasted as one line |
| `VAPID_PUBLIC_KEY` | public key from step 1 |
| `VAPID_PRIVATE_KEY` | private key from step 1 |
| `VAPID_SUBJECT` | `mailto:you@example.com` |

### 5. Run it

The workflow `.github/workflows/push-reminders.yml` runs daily at 17:00 UTC.
Trigger it manually first: repo → Actions → **Push training reminders** → Run
workflow. Check the logs for `sent=… skipped=… pruned=…`.

## Run locally

```bash
cd server
npm install
export FIREBASE_SERVICE_ACCOUNT="$(cat path/to/service-account.json)"
export VAPID_PUBLIC_KEY=... VAPID_PRIVATE_KEY=... VAPID_SUBJECT=mailto:you@example.com
npm run send-reminders
```

## Notes & limits

- **iOS** delivers Web Push only to apps **installed to the Home Screen**
  (iOS 16.4+). In a normal Safari tab it won't subscribe.
- `thresholdDays` comes from the device that last enabled reminders. The
  device-local streak-freeze logic still lives in the app; this backend only
  handles the "you haven't trained in a while" nudge.
- The Firestore rules already permit `users/{uid}` writes by the owner, so the
  `push` field needs no rule changes. The service account bypasses rules server-side.
