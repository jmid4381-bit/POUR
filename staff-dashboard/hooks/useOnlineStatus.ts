"use client";

/**
 * useOnlineStatus — tracks browser online/offline state and data freshness.
 *
 * In production this would monitor the Supabase realtime WebSocket.
 * Here it uses navigator.onLine + online/offline events as a proxy,
 * plus a lastSync timestamp that updates whenever orders change.
 */

import { useState, useEffect, useCallback } from "react";

export type ConnectionState = "live" | "slow" | "offline" | "reconnecting";

export interface OnlineStatus {
  state:      ConnectionState;
  lastSync:   Date;
  markSynced: () => void;   // call whenever fresh data arrives
}

export function useOnlineStatus(): OnlineStatus {
  const [isOnline, setIsOnline] = useState(
    typeof navigator !== "undefined" ? navigator.onLine : true
  );
  const [lastSync,    setLastSync]    = useState(new Date());
  const [state,       setState]       = useState<ConnectionState>("live");

  // Browser network events
  useEffect(() => {
    const goOnline  = () => { setIsOnline(true);  setState("live"); };
    const goOffline = () => { setIsOnline(false); setState("offline"); };
    window.addEventListener("online",  goOnline);
    window.addEventListener("offline", goOffline);
    return () => {
      window.removeEventListener("online",  goOnline);
      window.removeEventListener("offline", goOffline);
    };
  }, []);

  // Mark data as stale if no sync within 30s while "online"
  useEffect(() => {
    if (!isOnline) return;
    const id = setInterval(() => {
      const ageSeconds = (Date.now() - lastSync.getTime()) / 1000;
      if (ageSeconds > 60)      setState("reconnecting");
      else if (ageSeconds > 30) setState("slow");
      else                      setState("live");
    }, 5_000);
    return () => clearInterval(id);
  }, [isOnline, lastSync]);

  const markSynced = useCallback(() => {
    setLastSync(new Date());
    if (isOnline) setState("live");
  }, [isOnline]);

  return { state, lastSync, markSynced };
}
