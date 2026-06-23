"use client";

import { useEffect } from "react";
import { X } from "lucide-react";
import { cn } from "@/lib/utils";

interface ModalProps {
  open:     boolean;
  onClose:  () => void;
  title:    string;
  subtitle?: string;
  children: React.ReactNode;
  size?:    "sm" | "md" | "lg";
}

export function Modal({ open, onClose, title, subtitle, children, size = "md" }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    document.addEventListener("keydown", handler);
    document.body.style.overflow = "hidden";
    return () => {
      document.removeEventListener("keydown", handler);
      document.body.style.overflow = "";
    };
  }, [open, onClose]);

  if (!open) return null;

  const widths = { sm: "max-w-sm", md: "max-w-lg", lg: "max-w-2xl" };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-void/85 backdrop-blur-md animate-fade-in"
        onClick={onClose}
      />
      {/* Panel */}
      <div className={cn(
        "relative w-full bg-surface border border-rim rounded-2xl shadow-modal",
        "animate-scale-in overflow-hidden max-h-[90vh] flex flex-col",
        widths[size],
      )}>
        {/* Gold top stripe */}
        <div className="h-[2px] w-full bg-gold-gradient flex-shrink-0" />

        {/* Header */}
        <div className="flex items-start justify-between px-6 py-5 border-b border-edge flex-shrink-0">
          <div>
            <h3 className="font-display text-xl font-semibold text-white">{title}</h3>
            {subtitle && <p className="text-ink-400 text-sm font-body mt-0.5">{subtitle}</p>}
          </div>
          <button
            onClick={onClose}
            className="w-8 h-8 rounded-xl flex items-center justify-center text-ink-400 hover:text-white hover:bg-raised transition-all ml-4 flex-shrink-0"
          >
            <X size={15} />
          </button>
        </div>

        {/* Scrollable body */}
        <div className="overflow-y-auto flex-1 p-6">{children}</div>
      </div>
    </div>
  );
}

// Confirm dialog
interface ConfirmProps {
  open:     boolean;
  title:    string;
  message:  string;
  onConfirm:() => void;
  onCancel: () => void;
  confirmLabel?: string;
  variant?: "danger" | "gold";
}

export function ConfirmDialog({ open, title, message, onConfirm, onCancel, confirmLabel = "Confirm", variant = "danger" }: ConfirmProps) {
  if (!open) return null;
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      <div className="absolute inset-0 bg-void/85 backdrop-blur-md animate-fade-in" onClick={onCancel} />
      <div className="relative w-full max-w-sm bg-surface border border-rim rounded-2xl shadow-modal animate-scale-in overflow-hidden">
        <div className="h-[2px] w-full bg-red-600" />
        <div className="p-6">
          <h3 className="font-display text-lg font-semibold text-white mb-2">{title}</h3>
          <p className="text-ink-300 text-sm font-body leading-relaxed mb-6">{message}</p>
          <div className="flex gap-3 justify-end">
            <button
              onClick={onCancel}
              className="px-4 py-2 rounded-xl text-sm font-body font-semibold text-ink-300 bg-raised border border-edge hover:bg-rim transition-all"
            >
              Cancel
            </button>
            <button
              onClick={onConfirm}
              className="px-4 py-2 rounded-xl text-sm font-body font-semibold bg-red-600/20 border border-red-500/30 text-red-400 hover:bg-red-600/30 transition-all"
            >
              {confirmLabel}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
