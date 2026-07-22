"use client";

/**
 * StripePaymentSheet — bottom-sheet checkout for orders that have a real
 * charge (Giant upcharge / post-hour surcharge). Renders Stripe's Payment
 * Element, which automatically surfaces Apple Pay / Google Pay when the
 * device/browser supports them and the domain is verified, falling back to
 * card entry otherwise.
 *
 * The amount is fixed by the PaymentIntent created server-side — this sheet
 * only confirms it. On success it hands the PaymentIntent id back to the
 * caller, which finalizes the order server-side.
 */

import { useState } from "react";
import { Elements, PaymentElement, useStripe, useElements } from "@stripe/react-stripe-js";
import { X, Lock, ShieldCheck } from "lucide-react";
import { getStripePromise } from "@/lib/stripeClient";
import { cn, fmtUSD } from "@/lib/utils";

interface StripePaymentSheetProps {
  clientSecret: string;
  amountCents:  number;
  onSuccess:    (paymentIntentId: string) => void;
  onCancel:     () => void;
}

function PayForm({ amountCents, onSuccess, onCancel }: Omit<StripePaymentSheetProps, "clientSecret">) {
  const stripe   = useStripe();
  const elements = useElements();
  const [busy,  setBusy]  = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [ready, setReady] = useState(false);

  const handlePay = async () => {
    if (!stripe || !elements || busy) return;
    setBusy(true);
    setError(null);

    const { error: err, paymentIntent } = await stripe.confirmPayment({
      elements,
      // Wallets and most cards confirm inline (no redirect). return_url is a
      // safety net for any method that does require one.
      confirmParams: { return_url: window.location.href },
      redirect: "if_required",
    });

    if (err) {
      setError(err.message ?? "Payment could not be completed.");
      setBusy(false);
      return;
    }
    if (paymentIntent && (paymentIntent.status === "succeeded" || paymentIntent.status === "processing")) {
      onSuccess(paymentIntent.id);
      return;
    }
    // Unexpected non-error, non-succeeded state — let the guest retry.
    setError("Payment didn't complete. Please try again.");
    setBusy(false);
  };

  return (
    <div className="space-y-4">
      <PaymentElement onReady={() => setReady(true)} options={{ layout: "tabs" }} />

      {error && (
        <div className="flex items-center gap-2 bg-red-500/8 border border-red-500/25 rounded-xl px-3 py-2.5">
          <p className="text-red-400 text-xs font-body">{error}</p>
        </div>
      )}

      <button
        onClick={handlePay}
        disabled={!stripe || !ready || busy}
        className={cn(
          "w-full py-4 rounded-2xl font-body font-bold text-lg flex items-center justify-center gap-2.5",
          "transition-all duration-200 active:scale-[0.98]",
          (!stripe || !ready || busy)
            ? "bg-lift border border-edge text-mist-400 cursor-not-allowed"
            : "bg-felt-grad text-white shadow-btn-felt hover:brightness-110",
        )}
      >
        {busy ? (
          <>
            <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
            Processing…
          </>
        ) : (
          <><Lock size={18} /> Pay {fmtUSD(amountCents / 100)}</>
        )}
      </button>

      <button
        onClick={onCancel}
        disabled={busy}
        className="w-full text-center text-mist-400 hover:text-white text-xs font-body font-semibold transition-colors disabled:opacity-50"
      >
        Cancel
      </button>
    </div>
  );
}

export function StripePaymentSheet({ clientSecret, amountCents, onSuccess, onCancel }: StripePaymentSheetProps) {
  return (
    <>
      <div className="fixed inset-0 z-[60] bg-void/85 backdrop-blur-md animate-fade-in" onClick={onCancel} aria-hidden />
      <div className="fixed inset-0 z-[70] flex items-end justify-center sm:items-center pointer-events-none sm:p-4">
        <div className="pointer-events-auto w-full max-w-md bg-card rounded-t-3xl sm:rounded-3xl shadow-modal flex flex-col max-h-[92dvh] sm:max-h-[85vh] animate-sheet-up">
          <div className="h-[3px] w-full bg-gold-grad flex-shrink-0" />

          <div className="flex items-center justify-between px-5 py-3.5 border-b border-edge flex-shrink-0">
            <div>
              <h3 className="font-display text-xl font-semibold text-white leading-none">Secure Payment</h3>
              <p className="text-[11px] text-mist-400 font-mono mt-0.5 flex items-center gap-1">
                <ShieldCheck size={11} className="text-felt-400" /> Powered by Stripe
              </p>
            </div>
            <button
              onClick={onCancel}
              aria-label="Cancel payment"
              className="w-8 h-8 rounded-full bg-lift flex items-center justify-center text-mist-400 hover:text-white transition-colors"
            >
              <X size={14} />
            </button>
          </div>

          <div
            className="flex-1 overflow-y-auto overscroll-contain p-5"
            // Extra bottom clearance so the Pay/Cancel buttons — the last thing
            // in this sheet — don't sit flush against the home indicator when
            // installed to the Home Screen.
            style={{ paddingBottom: "calc(1.25rem + env(safe-area-inset-bottom))" }}
          >
            <Elements
              stripe={getStripePromise()}
              options={{
                clientSecret,
                appearance: {
                  theme: "night",
                  variables: {
                    colorPrimary: "#10b981",
                    colorBackground: "#111f30",
                    colorText: "#f0f6ff",
                    borderRadius: "12px",
                    fontFamily: "system-ui, sans-serif",
                  },
                },
              }}
            >
              <PayForm amountCents={amountCents} onSuccess={onSuccess} onCancel={onCancel} />
            </Elements>
          </div>
        </div>
      </div>
    </>
  );
}
