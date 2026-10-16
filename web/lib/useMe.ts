"use client";

import { useEffect, useState } from "react";
import { api, ApiError, type Me } from "./api";
import { clearSession } from "./auth";

/** Loads the signed-in user's profile and stats. A 401 means the token died: sign out. */
export function useMe(): { me: Me | null; error: string | null; reload: () => void } {
  const [me, setMe] = useState<Me | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [tick, setTick] = useState(0);

  useEffect(() => {
    let cancelled = false;
    api
      .me()
      .then((m) => {
        if (!cancelled) setMe(m);
      })
      .catch((err: unknown) => {
        if (cancelled) return;
        if (err instanceof ApiError && err.status === 401) {
          clearSession();
          window.location.assign("/welcome");
          return;
        }
        setError(err instanceof Error ? err.message : "Could not load your profile.");
      });
    return () => {
      cancelled = true;
    };
  }, [tick]);

  return { me, error, reload: () => setTick((t) => t + 1) };
}
