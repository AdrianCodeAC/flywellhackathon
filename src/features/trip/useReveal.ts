import { useEffect, useRef } from "react";

/** Lets an element with the "reveal" class animate in the first time it scrolls into view. */
export function useReveal<T extends HTMLElement>() {
  const ref = useRef<T>(null);
  useEffect(() => {
    const element = ref.current;
    if (!element) return;
    const observer = new IntersectionObserver(
      ([entry]) => {
        if (!entry?.isIntersecting) return;
        observer.disconnect();
        // Drop the classes afterwards so the entrance delay never slows down hover effects.
        element.addEventListener(
          "transitionend",
          () => element.classList.remove("reveal", "is-in"),
          { once: true },
        );
        element.classList.add("is-in");
      },
      { threshold: 0.15 },
    );
    observer.observe(element);
    return () => observer.disconnect();
  }, []);
  return ref;
}
