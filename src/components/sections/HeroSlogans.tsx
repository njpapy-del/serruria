"use client";

import { useEffect, useState } from "react";

const ROTATE_MS = 4500;

/**
 * Slogans qui se succèdent en fondu sous l'accroche. Les lecteurs d'écran
 * reçoivent la liste complète (pas d'annonce répétée) ; sans animation si
 * l'utilisateur a demandé à réduire les mouvements.
 */
export function HeroSlogans({ slogans }: { slogans: string[] }) {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    if (slogans.length < 2) return;
    if (window.matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const timers: ReturnType<typeof setTimeout>[] = [];
    const id = setInterval(() => {
      setVisible(false);
      timers.push(
        setTimeout(() => {
          setIndex((i) => (i + 1) % slogans.length);
          setVisible(true);
        }, 400)
      );
    }, ROTATE_MS);
    return () => {
      clearInterval(id);
      timers.forEach(clearTimeout);
    };
  }, [slogans.length]);

  if (slogans.length === 0) return null;

  return (
    <>
      <ul className="sr-only">
        {slogans.map((s) => (
          <li key={s}>{s}</li>
        ))}
      </ul>
      <p
        aria-hidden="true"
        className={`min-h-[3.5rem] border-l-4 border-amber-400 pl-3 text-lg font-semibold italic leading-snug text-white transition-opacity duration-400 sm:min-h-[2rem] sm:text-xl ${
          visible ? "opacity-100" : "opacity-0"
        }`}
      >
        {slogans[index]}
      </p>
    </>
  );
}
