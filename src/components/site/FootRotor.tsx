"use client";

import { useEffect, useRef } from "react";

const ABC = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** Split-flap style wordmark: each letter now and then spins through random letters before landing back on its own. */
export default function FootRotor({ text, className }: { text: string; className?: string }) {
  const root = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = root.current!;
    const cells = [...el.querySelectorAll<HTMLElement>("[data-c]")];
    cells.forEach((c) => { c.style.width = c.offsetWidth + "px"; }); // lock widths so spinning letters don't shift the row
    const st = cells.map(() => ({ at: 0, left: 0 }));
    let timer = 0, visible = false;
    const step = (t: number) => {
      cells.forEach((c, i) => {
        const s = st[i], ch = c.dataset.c!;
        if (ch === " ") return;
        if (s.left > 0) {
          s.left--;
          c.textContent = s.left ? ABC[(Math.random() * 26) | 0] : ch;
          c.animate([{ transform: "scaleY(.15)" }, { transform: "none" }], { duration: 90 });
          s.at = t + 60;
        } else if (t >= s.at) {
          s.left = 4 + ((Math.random() * 6) | 0);
          s.at = t + 1200 + Math.random() * 2400;
        }
      });
    };
    const tick = () => step(performance.now());
    const io = new IntersectionObserver(([e]) => {
      visible = e.isIntersecting;
      clearInterval(timer);
      if (visible) timer = window.setInterval(tick, 60);
    });
    io.observe(el);
    if (matchMedia("(prefers-reduced-motion: reduce)").matches) io.disconnect();
    return () => { io.disconnect(); clearInterval(timer); };
  }, []);

  return (
    <div ref={root} className={className} aria-hidden>
      {text.split("").map((c, i) => (
        <span key={i} data-c={c} style={{ display: "inline-block", textAlign: "center" }}>{c === " " ? " " : c}</span>
      ))}
    </div>
  );
}
