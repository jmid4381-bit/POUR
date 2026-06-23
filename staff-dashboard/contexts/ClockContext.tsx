"use client";

/**
 * ClockContext — single source of truth for the current second.
 *
 * One setInterval drives every LiveTimer on the page.
 * Without this, 50 active orders = 50 intervals = 50 re-renders/second.
 * With this, 50 active orders = 1 interval = 1 re-render/second.
 */

import {
  createContext, useContext, useState,
  useEffect, type ReactNode,
} from "react";

const ClockContext = createContext<number>(0);

export function ClockProvider({ children }: { children: ReactNode }) {
  const [tick, setTick] = useState(() => Math.floor(Date.now() / 1000));

  useEffect(() => {
    // Align to the next whole second before starting so all timers
    // update simultaneously rather than at different offsets.
    const msUntilNextSecond = 1000 - (Date.now() % 1000);
    let intervalId: NodeJS.Timeout;

    const timeoutId = setTimeout(() => {
      setTick(Math.floor(Date.now() / 1000));
      intervalId = setInterval(() => {
        setTick(Math.floor(Date.now() / 1000));
      }, 1000);
    }, msUntilNextSecond);

    return () => {
      clearTimeout(timeoutId);
      clearInterval(intervalId);
    };
  }, []);

  return (
    <ClockContext.Provider value={tick}>
      {children}
    </ClockContext.Provider>
  );
}

export const useClock = () => useContext(ClockContext);
