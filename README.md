# Orion Gym Tracker

Single-page gym tracking app built with React, Vite, and a mobile-first layout for GitHub Pages.

## Auto shot tracking

The basketball tracker now has a browser-based auto mode that runs entirely inside the app:

1. Open a basketball workout.
2. Switch to `Auto Mode`.
3. Start the camera.
4. Calibrate the rim once.
5. The app will log detected makes and misses into the active workout automatically.

Current implementation layout:

1. Live browser detector and tracking logic: `src/hooks/useAutoShotMode.js`, `src/lib/ballDetector.js`, `src/lib/shotTracker.js`, `src/lib/rimCalibration.js`
2. Auto mode UI: `src/screens/AutoShotMode.jsx`, `src/screens/RimCalibrationScreen.jsx`
3. Legacy Python YOLO prototype and training assets: `ai/reference-python-detector/`

Notes:

1. Auto logging depends on good lighting, a stable phone angle, and a correct rim calibration.
2. If auto detection misses a rep, the manual make/miss buttons still work as an override.

## Local setup

1. Open a terminal in this folder.
2. Install dependencies with `npm install`.
3. Copy `.env.example` to `.env.local` if you want cloud sync.
4. Start the dev server with `npm run dev`.

## iPhone / GitHub Pages

1. Push your latest code to `main`.
2. In GitHub, open `Settings -> Pages`.
3. Set `Source` to `GitHub Actions`.
4. Wait for the `Deploy Orion Gym Tracker to Pages` workflow to finish.
5. Open the live site on your phone:
   `https://pinking141.github.io/gymtrackerapp/`

To install it like an app on iPhone:

1. Open the site in Safari.
2. Tap `Share`.
3. Tap `Add to Home Screen`.

## What changed

1. Safe-area aware headers and timer so top controls stay tappable on notched iPhones.
2. Workout snapshots stored inside every logged session so future program edits do not rewrite old history.
3. App state moved out of `App.jsx` into a controller hook.
4. Optional Supabase login + cloud sync for cross-device data.
5. Versioned data migrations for older saved app data.

## Cloud sync setup

The app still works fully offline with local storage. Cloud sync is optional and uses Supabase so it can still run as a static GitHub Pages app.

### 1. Create a Supabase project

Create a project at `https://supabase.com/`.

### 2. Create the data table

Open the Supabase SQL editor and run the SQL in [supabase/schema.sql](supabase/schema.sql).

### 3. Enable email auth

In Supabase Auth, keep Email enabled. This app uses email + password sign-in.

Note:

1. Hosted Supabase projects usually require email confirmation by default.
2. For real production email delivery, Supabase recommends configuring custom SMTP.

### 4. Add env vars locally

Create `.env.local`:

```env
VITE_SUPABASE_URL=your-project-url
VITE_SUPABASE_ANON_KEY=your-anon-key
```

### 5. Add env vars for GitHub Pages builds

In GitHub, open `Settings -> Secrets and variables -> Actions -> Variables` and add:

1. `VITE_SUPABASE_URL`
2. `VITE_SUPABASE_ANON_KEY`

The workflow already forwards those values into the Vite build.

### 6. Use the app

Open the `More` tab.

1. Create an account or sign in.
2. Your local data will sync automatically.
3. Use `Sync Now` anytime if you want a manual push.

## Backup and recovery

Even with cloud sync enabled, the app still keeps local backups on the device.

1. `Export Backup` downloads a JSON file.
2. `Import Backup` restores from a downloaded JSON file.
3. `Restore Local Backup` reloads the last local backup copy.

## Build

Run `npm run build` to create the production bundle in `dist/`.
