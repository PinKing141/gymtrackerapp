import { useEffect, useState } from "react";
import { firebaseConfigured } from "../firebase.js";
import { listenToAuth } from "../services/firebaseAuth.js";
import { markBoot } from "../services/bootTiming.js";

export function useFirebaseAuth() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    // Safety net: if the auth state never resolves (e.g. Firebase unreachable),
    // stop blocking on "Loading…" and fall through to the login screen.
    const fallback = setTimeout(() => {
      markBoot("firebase-auth-resolved (timeout)");
      setAuthLoading(false);
    }, 8000);

    const unsubscribe = listenToAuth((firebaseUser) => {
      clearTimeout(fallback);
      markBoot("firebase-auth-resolved");
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return () => {
      clearTimeout(fallback);
      unsubscribe();
    };
  }, []);

  return {
    user,
    authLoading,
    isLoggedIn: firebaseConfigured ? Boolean(user) : true,
  };
}
