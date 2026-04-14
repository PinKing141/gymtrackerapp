# Orion Gym Tracker

Single-page gym tracking web app built with React (CDN) in [index.html](index.html).

## Local setup

1. Open a terminal in this folder.
2. Start a local web server:

```bash
python3 -m http.server 8080
```

3. Open http://localhost:8080 in your browser.

## Access on iPhone

### Option 1: GitHub Pages (best)

This repo now includes a Pages deployment workflow at [.github/workflows/deploy-pages.yml](.github/workflows/deploy-pages.yml).

1. Push your latest code to the main branch.
2. In GitHub, open Settings -> Pages.
3. Under Build and deployment, set Source to GitHub Actions.
4. Wait for the Actions run named Deploy Orion Gym Tracker to Pages to finish.
5. Open your live site on iPhone:
	- https://pinking141.github.io/gymtrackerapp/

To install it like an app on iPhone:
1. Open the site in Safari.
2. Tap Share.
3. Tap Add to Home Screen.

### Option 2: Same Wi-Fi network (quick test)

1. Start the server from this folder:

```bash
python3 -m http.server 8080 --bind 0.0.0.0
```

2. Find your computer IP (example: 192.168.1.22).
3. On iPhone (same Wi-Fi), open:
	- http://YOUR_IP:8080

## Production notes

1. Deploy all files at the project root together:
	- [index.html](index.html)
	- [manifest.webmanifest](manifest.webmanifest)
	- [sw.js](sw.js)
2. Serve over HTTPS (required for service workers and install prompts).
3. Keep same-origin hosting for app files so offline caching works reliably.

## What is set up

1. Mobile-first viewport and Apple web-app meta tags.
2. Web app manifest for installability.
3. Service worker registration and basic offline shell caching.
4. LocalStorage persistence for workouts and progress data.