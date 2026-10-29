"use client";

import { useEffect, useRef } from "react";

const EASE = "cubic-bezier(.19, 1, .22, 1)"; // easeOutExpo

/** Footer wordmark in the "ml11" style: a bar grows, sweeps across the line and each letter fades in as it passes;
 *  then the bar retracts back, erasing the line, and expands again with the other line. Built on the Web Animations API (no library). */
export default function FootRotor({ lines, className }: { lines: [string, string]; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) return;
    const rows = [...el.querySelectorAll<HTMLElement>(".fr-line")];
    let active: Animation[] = [], run = 0;

    const play = async (k: number, id: number) => {
      const row = rows[k], bar = row.querySelector<HTMLElement>(".fr-bar")!;
      const letters = [...row.querySelectorAll<HTMLElement>(".fr-l")];
      const w = row.querySelector<HTMLElement>(".fr-txt")!.getBoundingClientRect().width;
      const go = (t: HTMLElement, kf: Keyframe[], o: KeyframeAnimationOptions) => {
        const a = t.animate(kf, { fill: "both", easing: EASE, ...o });
        active.push(a);
        return a;
      };
      rows[k ^ 1].style.opacity = "0";
      row.style.opacity = "1";
      const n = letters.length, inEnd = Math.max(1500, 725 + 34 * n + 600), R = inEnd + 1400; // R: when the bar starts back
      // expand: the bar grows, sweeps right, letters appear behind it
      go(bar, [{ scale: "1 0", opacity: 0.5 }, { scale: "1 1", opacity: 1 }], { duration: 700 });
      go(bar, [{ translate: "0px" }, { translate: w + 10 + "px" }], { duration: 700, delay: 800 });
      letters.forEach((l, i) => go(l, [{ opacity: 0 }, { opacity: 1 }], { duration: 600, delay: 725 + 34 * (i + 1) }));
      // retract: the bar sweeps back left, erasing letters from the end, then collapses
      go(bar, [{ translate: w + 10 + "px" }, { translate: "0px" }], { duration: 800, delay: R, easing: "cubic-bezier(.76, 0, .24, 1)" });
      letters.forEach((l, i) => go(l, [{ opacity: 1 }, { opacity: 0 }], { duration: 350, delay: R + 30 * (n - 1 - i), easing: "ease-in" }));
      const out = go(bar, [{ scale: "1 1", opacity: 1 }, { scale: "1 0", opacity: 0.5 }], { duration: 500, delay: R + 800 });
      await out.finished;
      if (id !== run) return;
      active.forEach((a) => a.cancel());
      active = [];
      row.style.opacity = "0";
    };

    const start = async () => {
      const id = ++run;
      for (let k = 0; id === run; k ^= 1) {
        try { await play(k, id); } catch { return; } // cancelled
      }
    };
    const stop = () => {
      run++;
      active.forEach((a) => a.cancel());
      active = [];
      rows.forEach((r, i) => { r.style.opacity = i ? "0" : ""; });
    };
    const io = new IntersectionObserver(([e]) => (e.isIntersecting ? start() : stop()));
    io.observe(el);
    return () => { io.disconnect(); stop(); };
  }, []);

  return (
    <div ref={root} className={"fr " + (className ?? "")} role="img" aria-label={lines.join(" / ")}>
      {lines.map((line, k) => (
        <div key={k} className={"fr-line fr-" + k} aria-hidden>
          <span className="fr-txt">
            {line.split("").map((c, i) => <span key={i} className="fr-l">{c === " " ? " " : c}</span>)}
          </span>
          <i className="fr-bar" />
        </div>
      ))}
    </div>
  );
}
