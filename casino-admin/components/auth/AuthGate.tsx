"use client";

import { useState, useEffect, useRef } from "react";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "@/lib/supabase";
import { LoginScreen } from "./LoginScreen";
import { ResetPasswordScreen } from "./ResetPasswordScreen";

const IDLE_TIMEOUT_MS = 15 * 60 * 1000;
const ACTIVITY_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll"] as const;

export function AuthGate({ children }: { children: React.ReactNode }) {
  const [session,    setSession]    = useState<Session | null>(null);
  const [loading,    setLoading]    = useState(true);
  // Set when Supabase reports the user arrived via a password-reset email
  // link — takes over the whole screen until they've set a new password,
  // regardless of what their existing role/session would otherwise show.
  const [recovering, setRecovering] = useState(false);
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });
    const { data: listener } = supabase.auth.onAuthStateChange((event, s) => {
      setSession(s);
      if (event === "PASSWORD_RECOVERY") setRecovering(true);
    });
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

  // A recovery-link session takes priority over everything else — the user
  // is authenticated, but the whole point of the visit is to set a new
  // password, not to land straight in the console with their old one gone.
  if (recovering) {
    return <ResetPasswordScreen onDone={() => setRecovering(false)} />;
  }

  const role = session.user.app_metadata.role;
  if (role !== "admin" && role !== "platform_admin") {
    return (
      <div className="min-h-screen bg-void flex flex-col items-center justify-center gap-4 px-4 text-center">
        <p className="text-white font-body text-lg">This account doesn&apos;t have admin access.</p>
        <button
          onClick={() => supabase.auth.signOut()}
          className="px-4 py-2 rounded-xl bg-raised border border-edge text-ink-400 hover:text-white hover:border-rim transition-colors text-sm font-body"
        >
          Sign out
        </button>
      </div>
    );
  }

  return <>{children}</>;
}
