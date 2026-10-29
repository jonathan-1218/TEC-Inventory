"use client";

import { useEffect, useRef } from "react";
import { visionMission } from "@/lib/site/content";

const vision = visionMission.slice(0, 3);
const mission = visionMission.slice(3);
const STOPS = [0.14, 0.4, 0.66, 0.92]; // where the milestones sit along the road
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ss = (x: number) => x * x * (3 - 2 * x);

const Letters = ({ text }: { text: string }) =>
  text.split("").map((c, i) => <span key={i} data-l className="vm-l">{c}</span>);

/** Vision & mission: the heading rolls from VISION to MISSION, vision statements rise word by word, then a road is
 *  drawn across the stage and the four missions light up as milestones on it. All driven by scroll, no per-frame loop. */
export default function VisionMission() {
  const sec = useRef<HTMLElement>(null);

  useEffect(() => {
    const root = sec.current!;
    const $ = (s: string) => root.querySelector<HTMLElement>(s)!;
    const $$ = (s: string) => [...root.querySelectorAll<HTMLElement>(s)];
    const our = $$("[data-our] [data-l]"), vis = $$("[data-vis] [data-l]"), mis = $$("[data-mis] [data-l]");
    const stmts = $$("[data-stmt]").map((el) => ({ el, words: [...el.querySelectorAll<HTMLElement>("[data-w]")] }));
    const pips = $$("[data-pip]");
    const road = $("[data-road]");
    const svg = road.querySelector("svg")!;
    const fill = svg.querySelector<SVGPathElement>("[data-fill]")!;
    const track = svg.querySelectorAll<SVGPathElement>("[data-track]");
    const dot = svg.querySelector<SVGGElement>("[data-dot]")!;
    const stations = $$("[data-st]");
    let len = 1, raf = 0;

    const layout = () => {
      const mobile = innerWidth <= 900;
      const [W, H] = mobile ? [400, 640] : [1000, 520];
      const d = mobile
        ? "M70 610 C70 510 335 530 335 430 S70 350 70 260 S335 190 335 80"
        : "M20 430 C220 430 250 250 440 270 S640 450 740 300 S860 90 985 110";
      svg.setAttribute("viewBox", `0 0 ${W} ${H}`);
      road.style.aspectRatio = `${W} / ${H}`;
      [fill, ...track].forEach((p) => p.setAttribute("d", d));
      len = fill.getTotalLength();
      fill.style.strokeDasharray = String(len);
      stations.forEach((st, i) => {
        const { x, y } = fill.getPointAtLength(STOPS[i] * len);
        const px = (x / W) * 100, py = (y / H) * 100;
        st.style.left = px + "%"; st.style.top = py + "%";
        const card = st.querySelector<HTMLElement>("[data-card]")!;
        card.style.cssText = mobile
          ? `top:50%;${px < 50 ? `left:34px;` : `right:34px;text-align:right;`}--dy:0px;--dx:${px < 50 ? 16 : -16}px;transform:translateY(-50%)`
          : `${i % 3 ? "top:38px;" : "bottom:38px;"}left:${Math.round(((Math.min(88, Math.max(12, px)) - px) / 100) * road.clientWidth)}px;width:${Math.round(road.clientWidth * 0.2)}px;--dx:0px;--dy:${i % 3 ? 16 : -16}px;transform:translateX(-50%)`;
        if (!mobile) card.style.marginLeft = "0";
      });
      update();
    };

    const update = () => {
      raf = 0;
      const r = root.getBoundingClientRect(), vh = root.querySelector<HTMLElement>(".vm")?.offsetHeight || innerHeight; // pinned height (svh): steady as the phone address bar collapses
      const p = r.height > vh ? clamp(-r.top / (r.height - vh)) : 0;

      const rise = (els: HTMLElement[], start: number, out = 0) =>
        els.forEach((el, i) => {
          const e = ss(clamp((p - start) / 0.05 - i * 0.12)), o = ss(clamp(out * 1.7 - i * 0.12));
          el.style.transform = `translateY(${(1 - e) * 110 - o * 110}%)`;
        });
      const m = clamp((p - 0.4) / 0.09);
      rise(our, 0); rise(vis, 0.01, m);
      mis.forEach((el, i) => { el.style.transform = `translateY(${(1 - ss(clamp(m * 2.2 - 0.25 - i * 0.12))) * 110}%)`; });

      stmts.forEach(({ el, words }, k) => {
        const s = 0.06 + k * 0.11, L = (p - s) / 0.11, inn = clamp(L / 0.3), out = clamp((L - 0.8) / 0.2);
        el.style.visibility = L > -0.05 && L < 1.05 ? "visible" : "hidden";
        words.forEach((w, j) => {
          const e = ss(clamp(inn * 1.6 - j * 0.06)), o = ss(clamp(out * 1.6 - j * 0.04));
          w.style.transform = `translateY(${(1 - e) * 110 - o * 110}%)`;
        });
        pips[k].style.transform = `scaleX(${clamp(L)})`;
      });

      $("[data-pips]").style.opacity = String(1 - m);
      const rp = clamp((p - 0.46) / 0.5);
      road.style.opacity = String(ss(clamp((p - 0.43) / 0.06)));
      fill.style.strokeDashoffset = String(len * (1 - rp));
      if (!(len > 1)) return;
      const pt = fill.getPointAtLength(rp * len);
      dot.setAttribute("transform", `translate(${pt.x} ${pt.y})`);
      stations.forEach((st, i) => {
        const on = ss(clamp((rp - STOPS[i] + 0.03) / 0.08));
        st.style.setProperty("--on", String(on));
      });
    };

    const queue = () => { if (!raf) raf = requestAnimationFrame(update); };
    layout();
    addEventListener("scroll", queue, { passive: true });
    addEventListener("resize", layout);
    return () => { cancelAnimationFrame(raf); removeEventListener("scroll", queue); removeEventListener("resize", layout); };
  }, []);

  return (
    <section ref={sec} id="about" data-index="About" data-pin="vm" style={{ position: "relative", zIndex: 1, height: "1000vh" }}>
      <div className="vm">
        <div className="vm-left">
          <div className="kicker">02 — VISION &amp; MISSION</div>
          <h2 className="display vm-heading">
            <span className="vm-line" data-our><Letters text="OUR" /></span>
            <span className="vm-line vm-swap">
              <span data-vis><Letters text="VISION" /></span>
              <span data-mis className="vm-mis"><Letters text="MISSION" /></span>
            </span>
          </h2>
        </div>
        <div className="vm-right">
          <div className="vm-stack">
            {vision.map(([k, t], n) => (
              <div key={k} data-stmt className="vm-stmt" style={{ visibility: "hidden" }}>
                <div className="mono vm-key">{k} — VISION<b>{"0" + (n + 1)}</b></div>
                <p className="display vm-vtext">
                  {t.split(" ").map((w, i) => (
                    <span key={i}><span className="vm-wm"><span data-w className="vm-wi">{w}</span></span>{" "}</span>
                  ))}
                </p>
              </div>
            ))}
            <div data-pips className="vm-pips">{vision.map((v) => <i key={v[0]}><s data-pip /></i>)}</div>
          </div>
          <div data-road className="vm-road" style={{ opacity: 0 }}>
            <svg preserveAspectRatio="none" aria-hidden>
              <path data-track fill="none" stroke="#1c1b18" strokeWidth="22" strokeLinecap="round" vectorEffect="non-scaling-stroke" />
              <path data-track fill="none" stroke="#3a3832" strokeWidth="2" strokeDasharray="8 10" vectorEffect="non-scaling-stroke" />
              <path data-fill fill="none" stroke="#e99704" strokeWidth="4" strokeLinecap="round" vectorEffect="non-scaling-stroke" style={{ filter: "drop-shadow(0 0 8px #e99704)" }} />
              <g data-dot><circle r="22" fill="#e99704" opacity=".22" /><circle r="9" fill="#ffd58a" /></g>
            </svg>
            {mission.map(([k, t]) => (
              <div key={k} data-st className="vm-st">
                <i className="vm-node" />
                <div data-card className="vm-card"><div className="mono vm-key">{k} — MISSION</div><div className="vm-mtext">{t}</div></div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
