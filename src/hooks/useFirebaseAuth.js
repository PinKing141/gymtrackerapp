import { useEffect, useState } from "react";
import { listenToAuth } from "../services/firebaseAuth.js";

export function useFirebaseAuth() {
  const [user, setUser] = useState(null);
  const [authLoading, setAuthLoading] = useState(true);

  useEffect(() => {
    const unsubscribe = listenToAuth((firebaseUser) => {
      setUser(firebaseUser);
      setAuthLoading(false);
    });

    return unsubscribe;
  }, []);

  return {
    user,
    authLoading,
    isLoggedIn: Boolean(user),
  };
}
