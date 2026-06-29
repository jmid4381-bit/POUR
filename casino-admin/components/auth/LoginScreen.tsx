"use client";

import { useState } from "react";
import { Lock, ChevronRight, AlertCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { cn } from "@/lib/utils";

export function LoginScreen() {
  const [email,    setEmail]    = useState("");
  const [password, setPassword] = useState("");
  const [error,    setError]    = useState<string | null>(null);
  const [loading,  setLoading]  = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);
    const { error: err } = await supabase.auth.signInWithPassword({ email, password });
    setLoading(false);
    if (err) setError("Invalid email or password.");
  };

  return (
    <div className="fixed inset-0 z-50 bg-void flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_60%_40%_at_50%_30%,rgba(201,142,8,0.07),transparent)] pointer-events-none" />
      <div
        className="absolute inset-0 pointer-events-none opacity-40"
        style={{ backgroundImage: "radial-gradient(circle,rgba(28,47,68,0.65) 1px,transparent 1px)", backgroundSize: "32px 32px" }}
      />

      <form onSubmit={handleSubmit} className="relative z-10 w-full max-w-sm animate-fade-up">
        <div className="text-center mb-8">
          <div className="w-14 h-14 bg-gold-gradient rounded-2xl flex items-center justify-center mx-auto mb-4 shadow-gold-md">
            <Lock size={22} className="text-void" strokeWidth={2.5} />
          </div>
          <h1 className="font-display font-bold text-2xl text-white mb-1">Admin Sign In</h1>
          <p className="text-[11px] font-mono text-gold-500/70 tracking-[0.2em] uppercase">
            POUR
          </p>
        </div>

        <div className="bg-surface border border-edge rounded-2xl overflow-hidden shadow-card">
          <div className="h-[2px] w-full bg-gold-gradient" />
          <div className="p-5 space-y-4">

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
              <p className="text-[10px] font-mono text-ink-600 uppercase tracking-wider mb-1.5">Password</p>
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
          </div>
        </div>

        <p className="text-center text-[11px] text-ink-600 font-mono mt-4">
          Authorized personnel only.
        </p>
      </form>
    </div>
  );
}
