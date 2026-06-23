"use client";

/**
 * useFocusTrap — Fix 9 (Accessibility)
 *
 * When a modal is open:
 *  - Focus moves to the first interactive element inside it
 *  - Tab cycles forward within the modal only
 *  - Shift+Tab cycles backward within the modal only
 *  - Focus is never allowed to escape to the page underneath
 *  - When the modal closes, focus returns to the element that opened it
 *
 * This is required by WCAG 2.1 SC 2.1.2 and the WAI-ARIA modal dialog pattern.
 * Without it, screen reader and keyboard users cannot interact with modals.
 */

import { useEffect, useRef, type RefObject } from "react";

const FOCUSABLE = [
  "a[href]",
  "button:not([disabled])",
  "textarea:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  '[tabindex]:not([tabindex="-1"])',
].join(", ");

export function useFocusTrap(
  ref:      RefObject<HTMLElement | null>,
  isActive: boolean
) {
  // Remember what had focus before the modal opened
  const previousFocus = useRef<HTMLElement | null>(null);

  useEffect(() => {
    if (!isActive || !ref.current) return;

    // Save the element that triggered the modal
    previousFocus.current = document.activeElement as HTMLElement;

    const el = ref.current;
    const focusable = Array.from(el.querySelectorAll<HTMLElement>(FOCUSABLE))
      .filter(n => !n.closest("[aria-hidden]"));

    const first = focusable[0];
    const last  = focusable[focusable.length - 1];

    // Move focus inside the modal
    first?.focus();

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key !== "Tab") return;

      if (focusable.length === 0) {
        e.preventDefault();
        return;
      }

      if (e.shiftKey) {
        // Shift+Tab: wrap from first → last
        if (document.activeElement === first || !el.contains(document.activeElement)) {
          e.preventDefault();
          last?.focus();
        }
      } else {
        // Tab: wrap from last → first
        if (document.activeElement === last || !el.contains(document.activeElement)) {
          e.preventDefault();
          first?.focus();
        }
      }
    };

    el.addEventListener("keydown", handleKeyDown);

    return () => {
      el.removeEventListener("keydown", handleKeyDown);
      // Restore focus to the element that opened the modal
      previousFocus.current?.focus();
    };
  }, [isActive, ref]);
}
