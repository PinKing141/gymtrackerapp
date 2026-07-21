import React from "react";
import ReactDOM from "react-dom/client";
import { App } from "./App.jsx";
import { AppErrorBoundary } from "./AppErrorBoundary.jsx";

ReactDOM.createRoot(document.getElementById("root")).render(
  <React.StrictMode>
    <AppErrorBoundary>
      <App />
    </AppErrorBoundary>
  </React.StrictMode>
);

if ("serviceWorker" in navigator) {
  let refreshing = false;
  // Only reload when an UPDATED worker takes over. On the very first visit the
  // fresh worker claiming control also fires controllerchange, and reloading
  // then throws away whatever the user typed (e.g. mid-onboarding).
  let hadController = Boolean(navigator.serviceWorker.controller);

  navigator.serviceWorker.addEventListener("controllerchange", () => {
    if (!hadController) {
      hadController = true;
      return;
    }
    if (refreshing) return;
    refreshing = true;
    window.location.reload();
  });

  window.addEventListener("load", () => {
    navigator.serviceWorker
      .register(`${import.meta.env.BASE_URL}sw.js`)
      .then((registration) => registration.update().catch(() => {}))
      .catch(() => {});
  });
}
