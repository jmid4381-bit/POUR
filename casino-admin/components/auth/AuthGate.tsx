"use client";

import { useState, useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { LogOut } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { LoginScreen } from "./LoginScreen";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((_event, s) => setSession(s));
    return () => listener.subscription.unsubscribe();
  }, []);

  // Auto sign-out after a period of no mouse/keyboard/touch activity
  useEffect(() => {
    if (!session) return;

    const resetTimer = () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => supabase.auth.signOut(), IDLE_TIMEOUT_MS);
    };

    resetTimer();
    ACTIVITY_EVENTS.forEach(evt => window.addEventListener(evt, resetTimer));

    return () => {
      if (idleTimer.current) clearTimeout(idleTimer.current);
      ACTIVITY_EVENTS.forEach(evt => window.removeEventListener(evt, resetTimer));
    };
  }, [session]);

  if (loading) {
    return (
      <div className="min-h-screen bg-void flex items-center justify-center">
        <div className="w-6 h-6 border-2 border-gold-500/30 border-t-gold-500 rounded-full animate-spin" />
      </div>
    );
  }

  if (!session) {
    return <LoginScreen />;
  }

  if (session.user.app_metadata.role !== "admin") {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-white font-body text-lg">This account doesn&apos;t have admin access.</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="px-4 py-2 rounded-xl bg-raised border border-edge text-ink-500 hover:text-white hover:border-rim transition-colors text-sm font-body"
        >
          Sign out
        </button>
      </div>
    );
  }

  return (
    <>
      {children}
      <button
        onClick={() => supabase.auth.signOut()}
        aria-label="Sign out"
        className="fixed bottom-3 right-3 z-50 w-9 h-9 rounded-xl bg-raised border border-edge flex items-center justify-center text-ink-500 hover:text-white hover:border-rim transition-colors shadow-card"
      >
        <LogOut size={14} />
      </button>
    </>
  );
}
