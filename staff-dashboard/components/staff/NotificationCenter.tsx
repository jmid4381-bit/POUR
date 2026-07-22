"use client";

import { useEffect, useRef } from "react";
import { Bell, X, Star, Clock } from "lucide-react";
import { cn } from "@/lib/utils";
import type { StaffNotification } from "@/hooks/useStaffOrders";

interface NotificationCenterProps {
  notifications:   StaffNotification[];
  unreadCount:     number;
  isOpen:          boolean;
  onOpen:          () => void;
  onClose:         () => void;
  onMarkAllRead:   () => void;
}

function timeAgo(date: Date): string {
  const secs = Math.floor((Date.now() - date.getTime()) / 1000);
  if (secs < 60)   return `${secs}s ago`;
  if (secs < 3600) return `${Math.floor(secs / 60)}m ago`;
  return `${Math.floor(secs / 3600)}h ago`;
}

export function NotificationCenter({
  notifications, unreadCount, isOpen, onOpen, onClose, onMarkAllRead,
}: NotificationCenterProps) {
  const panelRef = useRef<HTMLDivElement>(null);

  // Close on outside click
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: MouseEvent) => {
      if (panelRef.current && !panelRef.current.contains(e.target as Node)) {
        onClose();
      }
    };
    document.addEventListener("mousedown", handler);
    return () => document.removeEventListener("mousedown", handler);
  }, [isOpen, onClose]);

  // Close on Escape
  useEffect(() => {
    if (!isOpen) return;
    const handler = (e: KeyboardEvent) => { if (e.key === "Escape") onClose(); };
    window.addEventListener("keydown", handler);
    return () => window.removeEventListener("keydown", handler);
  }, [isOpen, onClose]);

  return (
    <div ref={panelRef} className="relative">
      {/* Bell button */}
      <button
        onClick={isOpen ? onClose : onOpen}
        aria-label={`Notifications${unreadCount > 0 ? ` (${unreadCount} unread)` : ""}`}
        className={cn(
          "relative w-9 h-9 rounded-xl flex items-center justify-center transition-all",
          isOpen
            ? "bg-amber-400/15 border border-amber-400/25 text-amber-400"
            : "bg-surface border border-border text-slate-400 hover:text-white hover:border-rim",
        )}
      >
        <Bell size={16} className={unreadCount > 0 ? "animate-pulse-ring" : ""} />
        {unreadCount > 0 && (
          <span className="absolute -top-1 -right-1 min-w-[16px] h-4 bg-amber-400 text-void text-[9px] font-bold font-mono rounded-full flex items-center justify-center px-1 shadow">
            {unreadCount > 9 ? "9+" : unreadCount}
          </span>
        )}
      </button>

      {/* Slide-down panel */}
      {isOpen && (
        <div className="absolute right-0 top-11 w-80 bg-surface border border-border rounded-2xl shadow-[0_8px_32px_rgba(0,0,0,0.7)] overflow-hidden z-50 animate-slide-down">
          {/* Header */}
          <div className="flex items-center justify-between px-4 py-3 border-b border-border">
            <div className="flex items-center gap-2">
              <Bell size={14} className="text-amber-400" />
              <span className="text-sm font-display font-semibold text-white">Order Notifications</span>
              {unreadCount > 0 && (
                <span className="text-[10px] font-mono bg-amber-400/15 text-amber-400 border border-amber-400/20 rounded-full px-1.5 py-0.5">
                  {unreadCount} new
                </span>
              )}
            </div>
            <div className="flex items-center gap-2">
              {unreadCount > 0 && (
                <button
                  onClick={onMarkAllRead}
                  className="text-[10px] font-mono text-slate-400 hover:text-slate-300 transition-colors"
                >
                  Mark all read
                </button>
              )}
              <button onClick={onClose} className="text-slate-400 hover:text-white transition-colors">
                <X size={14} />
              </button>
            </div>
          </div>

          {/* Notification list */}
          <div className="max-h-80 overflow-y-auto overscroll-contain">
            {notifications.length === 0 ? (
              <div className="py-10 text-center">
                <Bell size={24} className="text-slate-400 mx-auto mb-2" />
                <p className="text-slate-400 text-sm font-body">No notifications yet</p>
              </div>
            ) : (
              <div className="divide-y divide-border/60">
                {notifications.map(notif => (
                  <div
                    key={notif.id}
                    className={cn(
                      "px-4 py-3 transition-colors",
                      !notif.read && "bg-amber-400/4",
                    )}
                  >
                    <div className="flex items-start gap-2.5">
                      {/* Unread dot */}
                      <div className="w-1.5 h-1.5 rounded-full bg-amber-400 mt-2 flex-shrink-0 opacity-0" 
                           style={{ opacity: notif.read ? 0 : 1 }} />
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-1.5 mb-0.5">
                          {notif.isPriority && (
                            <Star size={9} className="text-gold-400 fill-gold-400 flex-shrink-0" />
                          )}
                          <p className="text-white text-sm font-body font-medium truncate">
                            {notif.locationName}
                          </p>
                          <span className="text-[10px] font-mono text-slate-400 ml-auto flex-shrink-0 flex items-center gap-0.5">
                            <Clock size={9} />
                            {timeAgo(notif.arrivedAt)}
                          </span>
                        </div>
                        <p className="text-slate-400 text-xs font-body truncate">{notif.itemSummary}</p>
                        <p className="text-[10px] font-mono text-slate-400 mt-0.5">{notif.orderId}</p>
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
