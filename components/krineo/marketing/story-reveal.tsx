"use client";

import { useEffect, useRef, type ReactNode } from "react";
import styles from "./landing.module.css";

export function StoryReveal({ children }: { children: ReactNode }) {
  const ref = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const root = ref.current;
    const preference = window.matchMedia("(prefers-reduced-motion: reduce)");
    if (!root || preference.matches || !("IntersectionObserver" in window)) return;

    const cards = [...root.querySelectorAll<HTMLElement>("[data-story]")];
    const observer = new IntersectionObserver(entries => {
      entries.forEach(entry => {
        if (!entry.isIntersecting) return;
        const card = entry.target as HTMLElement;
        card.dataset.reveal = "visible";
        observer.unobserve(card);
      });
    }, { threshold: 0.15 });

    // SSR and already-visible cards remain visible. Only offscreen cards are armed.
    cards.forEach(card => {
      if (card.getBoundingClientRect().top >= window.innerHeight) {
        card.dataset.reveal = "pending";
        observer.observe(card);
      }
    });
    const showAll = () => {
      if (!preference.matches) return;
      observer.disconnect();
      cards.forEach(card => { card.dataset.reveal = "visible"; });
    };
    preference.addEventListener("change", showAll);
    return () => {
      observer.disconnect();
      preference.removeEventListener("change", showAll);
      cards.forEach(card => { delete card.dataset.reveal; });
    };
  }, []);

  return <div ref={ref} className={styles.stories}>{children}</div>;
}
