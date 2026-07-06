"use client";

import { useState } from "react";
import { Lock, ChevronRight, AlertCircle, Mail, ArrowLeft, CheckCircle2 } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  // Forgot-password sub-flow — toggles the same card into a "send reset
  // link" form instead of navigating to a separate page.
  const [showForgot,   setShowForgot]   = useState(false);
  const [resetEmail,    setResetEmail]   = useState("");
  const [resetSent,     setResetSent]    = useState(false);
  const [resetLoading,  setResetLoading] = useState(false);
  const [resetError,    setResetError]   = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError("Invalid email or password.");
  };

  const handleForgotSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setResetError(null);
    setResetLoading(true);
    // Same-origin redirect — works on any deployment with no hardcoded URL.
    // AuthGate detects the resulting PASSWORD_RECOVERY session and shows the
    // "set new password" screen regardless of which page this lands on.
    const { error: err } = await supabase.auth.resetPasswordForEmail(resetEmail, {
      redirectTo: window.location.origin,
    });
    setResetLoading(false);
    if (!err) {
      setResetSent(true);
      return;
    }
    // Supabase never reveals whether the email has an account here — errors
    // at this point are things like rate limiting or a malformed address,
    // never "no such user" — so it's safe to surface the real message
    // instead of a generic one that hides what actually happened.
    setResetError(err.message || "Something went wrong. Please try again.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-void flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(201,142,8,0.07),transparent)] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: "radial-gradient(circle,rgba(28,47,68,0.65) 1px,transparent 1px)", backgroundSize: "32px 32px" }}
      />

      <div className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gold-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold-md">
            <Lock size={22} className="text-void" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-bold text-2xl text-white mb-1">
            {showForgot ? "Reset Password" : "Admin Sign In"}
          </h1>
          <p className="text-[11px] font-mono text-gold-500/70 tracking-[0.2em] uppercase">
            POUR
          </p>
        </div>

        <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
          <div className="h-[2px] w-full bg-gold-gradient" />

          {showForgot ? (
            resetSent ? (
              <div className="p-6 text-center space-y-3">
                <div className="w-12 h-12 rounded-full bg-emerald-500/15 border border-emerald-500/25 flex items-center justify-center mx-auto">
                  <CheckCircle2 size={22} className="text-emerald-400" />
                </div>
                <p className="text-white font-body font-semibold text-sm">Check your email</p>
                <p className="text-ink-500 text-xs font-body leading-relaxed">
                  If an account exists for {resetEmail}, a password reset link is on its way.
                </p>
                <button
                  onClick={() => { setShowForgot(false); setResetSent(false); setResetEmail(""); }}
                  className="text-gold-500/80 hover:text-gold-400 text-xs font-body font-semibold transition-colors inline-flex items-center gap-1 mt-2"
                >
                  <ArrowLeft size={12} /> Back to sign in
                </button>
              </div>
            ) : (
              <form onSubmit={handleForgotSubmit} className="p-5 space-y-4">
                <p className="text-ink-400 text-xs font-body leading-relaxed">
                  Enter your account email and we&apos;ll send you a link to set a new password.
                </p>
                <div>
                  <p className="text-[10px] font-mono text-ink-600 uppercase tracking-wider mb-1.5">Email</p>
                  <input
                    type="email"
                    value={resetEmail}
                    onChange={e => setResetEmail(e.target.value)}
                    required
                    autoComplete="email"
                    autoFocus
                    placeholder="you@company.com"
                    className="w-full bg-raised border border-edge rounded-xl px-3.5 py-2.5 text-sm text-ink-100 placeholder-ink-600 font-body focus:outline-none focus:border-gold-500/40 transition-colors"
                  />
                </div>

                {resetError && (
                  <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/25 rounded-xl px-3 py-2.5">
                    <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                    <p className="text-red-400 text-xs font-body">{resetError}</p>
                  </div>
                )}

                <button
                  type="submit"
                  disabled={resetLoading}
                  className={cn(
                    "w-full py-3.5 rounded-xl font-body font-bold text-base flex items-center justify-center gap-2",
                    "transition-all active:scale-[0.98]",
                    resetLoading
                      ? "bg-raised border border-edge text-ink-600 cursor-not-allowed"
                      : "bg-gold-gradient text-void shadow-btn-gold hover:brightness-110",
                  )}
                >
                  {resetLoading ? "Sending…" : "Send Reset Link"}
                  {!resetLoading && <Mail size={16} />}
                </button>

                <button
                  type="button"
                  onClick={() => setShowForgot(false)}
                  className="w-full text-center text-ink-500 hover:text-white text-xs font-body font-semibold transition-colors inline-flex items-center justify-center gap-1"
                >
                  <ArrowLeft size={12} /> Back to sign in
                </button>
              </form>
            )
          ) : (
            <form onSubmit={handleSubmit} className="p-5 space-y-4">

              <div>
                <p className="text-[10px] font-mono text-ink-600 uppercase tracking-wider mb-1.5">Email</p>
                <input
                  type="email"
                  value={email}
                  onChange={e => setEmail(e.target.value)}
                  required
                  autoComplete="email"
                  autoFocus
                  placeholder="you@company.com"
                  className="w-full bg-raised border border-edge rounded-xl px-3.5 py-2.5 text-sm text-ink-100 placeholder-ink-600 font-body focus:outline-none focus:border-gold-500/40 transition-colors"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1.5">
                  <p className="text-[10px] font-mono text-ink-600 uppercase tracking-wider">Password</p>
                  <button
                    type="button"
                    onClick={() => setShowForgot(true)}
                    className="text-[10px] font-mono text-gold-500/70 hover:text-gold-400 transition-colors"
                  >
                    Forgot password?
                  </button>
                </div>
                <input
                  type="password"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                  required
                  autoComplete="current-password"
                  placeholder="••••••••"
                  className="w-full bg-raised border border-edge rounded-xl px-3.5 py-2.5 text-sm text-ink-100 placeholder-ink-600 font-body focus:outline-none focus:border-gold-500/40 transition-colors"
                />
              </div>

              {error && (
                <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/25 rounded-xl px-3 py-2.5">
                  <AlertCircle size={13} className="text-red-400 flex-shrink-0" />
                  <p className="text-red-400 text-xs font-body">{error}</p>
                </div>
              )}

              <button
                type="submit"
                disabled={loading}
                className={cn(
                  "w-full py-3.5 rounded-xl font-body font-bold text-base flex items-center justify-center gap-2",
                  "transition-all active:scale-[0.98]",
                  loading
                    ? "bg-raised border border-edge text-ink-600 cursor-not-allowed"
                    : "bg-gold-gradient text-void shadow-btn-gold hover:brightness-110",
                )}
              >
                {loading ? "Signing in…" : "Sign In"}
                {!loading && <ChevronRight size={18} />}
              </button>
            </form>
          )}
        </div>

        <p className="text-center text-[11px] text-ink-600 font-mono mt-4">
          Authorized personnel only.
        </p>
      </div>
    </div>
  );
}
