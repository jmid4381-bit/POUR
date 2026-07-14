/**
 * lib/notify.ts — in-app "get their attention" helpers for the live order
 * tracker. This is the Phase-1, no-install layer: it works while the guest
 * has the tab open (even backgrounded) but does NOT require a service worker
 * or push permission. Real lock-screen push (with the app closed) is Phase 2.
 *
 * Everything here is best-effort and defensively wrapped — a browser that
 * blocks audio, lacks the Vibration API, or is mid-SSR must never throw.
 */

// ─── Sound ──────────────────────────────────────────────────────────────────
// One shared AudioContext, created lazily and "warmed" (resumed) right after
// the place-order tap so a chime minutes later — when there's no fresh user
// gesture — still plays. Synthesized with oscillators so there's no audio
// asset to ship or fail to load.

let audioCtx: AudioContext | null = null;

function getCtx(): AudioContext | null {
  if (typeof window === "undefined") return null;
  try {
    if (!audioCtx) {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      audioCtx = new Ctor();
    }
    return audioCtx;
  } catch {
    return null;
  }
}

/**
 * Unlock audio on the user's FIRST tap anywhere. Mobile browsers only let an
 * AudioContext start from inside a real gesture handler, so warming it from a
 * useEffect (which runs after mount, not during a tap) silently fails — the
 * context stays suspended and no later chime plays. Binding a one-time global
 * listener means the very first interaction in the ordering flow (placing an
 * order, tapping the menu, anything) unlocks it, so a chime minutes later on
 * the tracker works. iOS additionally needs a silent buffer played inside the
 * gesture to fully unlock, not just resume().
 */
let unlockBound = false;
export function ensureAudioUnlock(): void {
  if (typeof window === "undefined" || unlockBound) return;
  unlockBound = true;
  const unlock = () => {
    const ctx = getCtx();
    if (!ctx) return;
    ctx.resume().catch(() => {});
    try {
      const buf = ctx.createBuffer(1, 1, 22050);
      const src = ctx.createBufferSource();
      src.buffer = buf;
      src.connect(ctx.destination);
      src.start(0);
    } catch { /* non-fatal */ }
    if (ctx.state === "running") {
      window.removeEventListener("pointerdown", unlock);
      window.removeEventListener("touchend", unlock);
      window.removeEventListener("click", unlock);
    }
  };
  window.addEventListener("pointerdown", unlock, { passive: true });
  window.addEventListener("touchend", unlock, { passive: true });
  window.addEventListener("click", unlock, { passive: true });
}

/**
 * Call from a user gesture (e.g. the "Place Order" tap) to unlock audio
 * synchronously, and bind the global first-gesture unlock as a fallback.
 */
export function warmAudio(): void {
  const ctx = getCtx();
  if (ctx && ctx.state === "suspended") ctx.resume().catch(() => {});
  ensureAudioUnlock();
}

/**
 * A short, pleasant ascending chime. `bright` uses a higher, brighter arpeggio
 * for the "delivered" celebration vs. the softer "on the way" cue.
 */
export function playChime(bright = false): void {
  const ctx = getCtx();
  if (!ctx) return;
  try {
    if (ctx.state === "suspended") ctx.resume().catch(() => {});
    // Two/three-note arpeggio (major triad-ish). Frequencies in Hz.
    const notes = bright ? [659.25, 830.61, 987.77, 1318.5] : [523.25, 659.25, 783.99];
    const now = ctx.currentTime;
    notes.forEach((freq, i) => {
      const osc  = ctx.createOscillator();
      const gain = ctx.createGain();
      osc.type = "sine";
      osc.frequency.value = freq;
      const start = now + i * 0.12;
      const end   = start + 0.22;
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(0.28, start + 0.02);
      gain.gain.exponentialRampToValueAtTime(0.0001, end);
      osc.connect(gain).connect(ctx.destination);
      osc.start(start);
      osc.stop(end + 0.02);
    });
  } catch {
    /* audio blocked — the visual banner + vibration still fire */
  }
}

// ─── Haptics ──────────────────────────────────────────────────────────────────

export function vibrate(pattern: number | number[]): void {
  try {
    navigator.vibrate?.(pattern);
  } catch {
    /* unsupported (iOS Safari has no Vibration API) — non-fatal */
  }
}

// ─── Tab-title attention pulse ───────────────────────────────────────────────
// When the guest has switched to another tab, flashing the document title is
// the one signal a backgrounded browser tab reliably shows. We flash the alert
// text a few times, then restore, and stop early the moment they return.

let titleTimer: ReturnType<typeof setInterval> | null = null;
let originalTitle: string | null = null;

export function pulseTitle(message: string, flashes = 6): void {
  if (typeof document === "undefined") return;
  // Don't bother if the tab is already focused — they can see the banner.
  if (document.visibilityState === "visible" && document.hasFocus()) return;

  if (titleTimer) { clearInterval(titleTimer); titleTimer = null; }
  if (originalTitle === null) originalTitle = document.title;

  let on = false;
  let count = 0;
  const restore = () => {
    if (titleTimer) { clearInterval(titleTimer); titleTimer = null; }
    if (originalTitle !== null) { document.title = originalTitle; originalTitle = null; }
    document.removeEventListener("visibilitychange", onVisible);
    window.removeEventListener("focus", onVisible);
  };
  const onVisible = () => { if (document.visibilityState === "visible") restore(); };

  document.addEventListener("visibilitychange", onVisible);
  window.addEventListener("focus", onVisible);

  titleTimer = setInterval(() => {
    on = !on;
    document.title = on ? `🔔 ${message}` : (originalTitle ?? document.title);
    if (++count >= flashes * 2) restore();
  }, 800);
}

// ─── Combined fire-once alert ────────────────────────────────────────────────

/**
 * Fire every channel at once for a milestone the guest should notice:
 * chime + haptic + tab-title flash. The on-screen banner is handled by the
 * component so it can animate with the rest of the tracker UI.
 */
export function fireAlert(titleMessage: string, bright = false): void {
  playChime(bright);
  vibrate(bright ? [120, 60, 120, 60, 240] : [200, 100, 200]);
  pulseTitle(titleMessage);
}
