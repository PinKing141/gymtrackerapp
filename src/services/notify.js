// Fire a local notification immediately, best-effort. This is only useful while
// the page is still alive (e.g. briefly backgrounded) — browsers freeze timers
// once the app is fully closed, so this cannot guarantee delivery in the
// background. True background reminders would need Web Push + a server.
export async function notifyNow(title, body, tag = "orion-gym") {
  if (typeof window === "undefined") return false;
  if (!("Notification" in window) || Notification.permission !== "granted") return false;

  const options = { body, tag, icon: "./icons/icon-192.png", renotify: false };
  try {
    if (typeof navigator !== "undefined" && "serviceWorker" in navigator) {
      const registration = await navigator.serviceWorker.ready;
      if (registration?.showNotification) {
        await registration.showNotification(title, options);
        return true;
      }
    }
    new Notification(title, options);
    return true;
  } catch {
    return false;
  }
}

// Only notify when the user has actually left the tab/app — when it's in the
// foreground the in-app sound + haptic already cover the moment.
export function notifyIfHidden(title, body, tag) {
  if (typeof document !== "undefined" && document.visibilityState !== "hidden") {
    return Promise.resolve(false);
  }
  return notifyNow(title, body, tag);
}
