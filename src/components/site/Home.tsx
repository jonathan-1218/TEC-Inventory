"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link";
import { initBoard } from "@/lib/site/board-scene";
import { core, events, galleryCards, manifesto, pad, phrases, visionMission } from "@/lib/site/content";
import GalleryOverlay from "./GalleryOverlay";

const DASHBOARD = "/dashboard"; // the inventory app lives in the same site
const GITHUB = "https://github.com/jonathan-1218/TEC-Inventory";

const sticky: CSSProperties = { position: "sticky", top: 0, height: "var(--vh)", overflow: "hidden" };
const phraseLine: CSSProperties = { fontSize: "clamp(30px,7.4vw,132px)" };
const vmWord: CSSProperties = {
  position: "absolute", left: 0, top: 60, lineHeight: 0.88, letterSpacing: "-.02em",
  transition: "opacity .5s, transform .6s cubic-bezier(.2,.8,.2,1)",
};

// next/font exposes each loaded family as a CSS variable on <html>
const cssVar = (name: string) => getComputedStyle(document.documentElement).getPropertyValue(name).trim() || "sans-serif";
const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ss = (x: number) => x * x * (3 - 2 * x);

function Words({ text }: { text: string }) {
  return text.split(" ").map((w, i) => (
    <span key={i}>
      {i > 0 && " "}
      <span style={{ display: "inline-block", overflow: "hidden", verticalAlign: "top", padding: "0 .02em .08em" }}>
        <span data-w style={{ display: "inline-block", willChange: "transform" }}>{w}</span>
      </span>
    </span>
  ));
}

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [galOpen, setGalOpen] = useState(false);

  useEffect(() => {
    const root = rootRef.current!;
    const $ = <E extends HTMLElement = HTMLElement>(s: string) => root.querySelector<E>(s)!;
    const $$ = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));

    const bar = $("[data-bar]"), herotext = $("[data-herotext]"), cap = $("[data-cap]"), manwrap = $("[data-manwrap]");
    const heroSec = $("[data-pin=hero]"), gbox = $("[data-gl]"), scrim = $("[data-scrim]");
    const evSec = $("[data-pin=ev]"), evTrack = $("[data-track=ev]"), evCount = $("[data-evcount]");
    const vmSec = $("[data-pin=vm]"), vmCol = $("[data-vmcol]"), vmFill = $("[data-vmfill]"), vmCount = $("[data-vmcount]");
    const w0 = $("[data-vmword='0']"), w1 = $("[data-vmword='1']"), vmItems = $$("[data-vmitem]");
    const galSec = $("#gallery"), galCards = $$("[data-gc]"), galBtn = $("[data-galbtn]");
    const tilt = $("[data-tilt]"), reveals = $$("[data-rv]"), manWords = $$("[data-mw]");
    const phs = $$("[data-ph]").map((el) => {
      const [a, b] = el.dataset.ph!.split(",").map(Number);
      return { el, a, b, ws: Array.from(el.querySelectorAll<HTMLElement>("[data-w]")), k: el.querySelector<HTMLElement>("[data-k]")! };
    });

    const board = initBoard(gbox, { mono: cssVar("--font-geist-mono"), display: cssVar("--font-archivo") });
    let mx = 0, my = 0, raf = 0;
    const t0 = performance.now();
    const onMove = (e: MouseEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    addEventListener("mousemove", onMove);

    const tick = (now: number) => {
      const vh = innerHeight, sy = scrollY;
      bar.style.width = (sy / (document.documentElement.scrollHeight - vh)) * 100 + "%";

      // hero: board fly-through + phrases
      const hr = heroSec.getBoundingClientRect();
      const hp = clamp(-hr.top / (hr.height - vh)), gp = clamp((hp - 0.1) / 0.7);
      board.update(gp, mx, my, (now - t0) / 1000);
      const fade = 1 - ss(clamp((hp - 0.8) / 0.07));
      let scrimOp = 0;
      for (const P of phs) {
        const L = (gp - P.a) / (P.b - P.a), inn = clamp(L / 0.3), outp = clamp((L - 0.75) / 0.25), live = L > 0 && L < 1;
        P.el.style.opacity = String(live ? fade : 0);
        P.ws.forEach((w, i) => {
          const e = ss(clamp(inn * 1.6 - i * 0.12)), o = ss(clamp(outp * 1.6 - i * 0.08));
          w.style.transform = `translateY(${(1 - e) * 110 - o * 110}%) skewY(${(1 - e) * 6}deg)`;
        });
        P.k.style.opacity = String(ss(inn) * (1 - ss(outp)));
        P.k.style.letterSpacing = 0.14 + (1 - ss(inn)) * 0.5 + "em";
        if (live) scrimOp = Math.max(scrimOp, ss(clamp(L / 0.2)) * (1 - ss(clamp((L - 0.85) / 0.15))));
      }
      scrim.style.opacity = String(scrimOp * fade);
      gbox.style.opacity = String(ss(clamp((hp - 0.08) / 0.14)) * (1 - ss(clamp((hp - 0.8) / 0.07))));
      herotext.style.opacity = String(1 - ss(clamp((hp - 0.03) / 0.1)));
      herotext.style.transform = `scale(${1 + Math.min(hp, 0.15) * 1.5})`;
      manwrap.style.opacity = String(ss(clamp((hp - 0.86) / 0.05)));
      cap.textContent = hp < 0.08 ? "SCROLL TO POWER ON" : hp > 0.82 ? "TEC / ABOUT" : gp < 0.28 ? "BOARD / TRACES" : gp < 0.52 ? "BOARD / THE CHIP" : gp < 0.74 ? "CHIP / DIE" : "DIE / TRANSISTORS";
      const mp = clamp((hp - 0.88) / 0.1);
      manWords.forEach((w, i) => { w.style.color = i / manWords.length < mp * 1.1 ? "#f2f0ea" : "#3a3832"; });

      for (const el of reveals) {
        const p = clamp((vh * 0.94 - el.getBoundingClientRect().top) / (vh * 0.28));
        el.style.opacity = String(p);
        el.style.translate = `0 ${(1 - p) * 50}px`;
      }

      // events: horizontal track
      const er = evSec.getBoundingClientRect(), ep = clamp(-er.top / (er.height - vh));
      evTrack.style.transform = `translateX(${-ep * Math.max(0, evTrack.scrollWidth - innerWidth)}px)`;
      evCount.textContent = pad(Math.min(5, 1 + Math.floor(ep * 5))) + " / 05";

      // gallery: fan out the stack
      {
        const p = clamp(-galSec.getBoundingClientRect().top / (galSec.offsetHeight - vh));
        const spread = ss(clamp((p - 0.08) / 0.5)), gap = galCards[0].offsetWidth * 1.12;
        galCards.forEach((c, i) => {
          const d = i - 1, k = ss(clamp(spread * 1.25 - Math.abs(d) * 0.12 - (i === 1 ? 0.1 : 0)));
          const x = d * gap * k + (1 - k) * d * 18, y = (1 - k) * (i * 14) + Math.sin(k * Math.PI) * -40 + (d === 0 ? 0 : 28 * k);
          const r = galleryCards[i].rot * (1 - k) + d * 3 * k;
          c.style.transform = `translate(${x + mx * 14 * (i + 1)}px,${y + my * 10 * (i + 1)}px) rotate(${r}deg) scale(${0.86 + 0.14 * k})`;
        });
        const b = ss(clamp((p - 0.62) / 0.2));
        galBtn.style.opacity = String(b);
        galBtn.style.transform = `translate(-50%,${(1 - b) * 40}px)`;
      }

      // vision & mission: light up nodes along the rail
      const vp = clamp(-vmSec.getBoundingClientRect().top / (vmSec.offsetHeight - vh)), cr = vmCol.getBoundingClientRect();
      const fillPx = clamp(vp * 1.08) * (cr.height - 24);
      vmFill.style.height = fillPx + "px";
      let lit = 0;
      vmItems.forEach((it, i) => {
        const nd = it.querySelector<HTMLElement>("[data-vmnode]")!, on = fillPx + 12 >= nd.getBoundingClientRect().top - cr.top + 10;
        if (on) lit = i + 1;
        it.style.opacity = on ? "1" : ".25";
        it.style.transform = on ? "none" : "translateX(20px)";
        nd.style.background = on ? "#e99704" : "#0e0d0b";
        nd.style.borderColor = on ? "#e99704" : "#3a3832";
        nd.style.boxShadow = on ? "0 0 22px 4px rgba(233,151,4,.7)" : "none";
      });
      const mis = lit >= 4;
      w0.style.opacity = mis ? "0" : "1"; w0.style.transform = mis ? "translateY(-40px)" : "none";
      w1.style.opacity = mis ? "1" : "0"; w1.style.transform = mis ? "none" : "translateY(40px)";
      vmCount.textContent = pad(lit) + " / 07 NODES ONLINE";

      tilt.style.transform = `rotateY(${mx * 8}deg) rotateX(${-my * 6}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => { cancelAnimationFrame(raf); removeEventListener("mousemove", onMove); board.dispose(); };
  }, []);

  return (
    <div ref={rootRef} className="tec-site" style={{ overflowX: "clip", position: "relative" }}>
      <div data-bar style={{ position: "fixed", top: 0, left: 0, height: 3, width: 0, background: "#e99704", zIndex: 80 }} />

      <nav className="mono" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px var(--gx)", background: "linear-gradient(#0e0d0b 40%,rgba(14,13,11,0))" }}>
        <a href="#top" style={{ display: "flex", alignItems: "center", gap: 12, color: "#f2f0ea" }}>
          <span style={{ background: "#f1eee6", borderRadius: 8, padding: "5px 8px", display: "flex" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG logo */}
            <img src="/site/tec-logo.svg" alt="TEC" style={{ height: 26, display: "block" }} />
          </span>
          <span className="nav-brand-text">THE ELECTRONICS CLUB</span>
        </a>
        <div className="nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          {["about", "events", "teams", "gallery", "core"].map((s) => (
            <a key={s} href={"#" + s} className="navlink">{s.toUpperCase()}</a>
          ))}
          <Link href={DASHBOARD} className="cta">DASHBOARD ↗</Link>
        </div>
      </nav>

      {/* 01 — hero */}
      <section id="top" data-pin="hero" style={{ position: "relative", zIndex: 1, height: "650vh" }}>
        <div style={sticky}>
          <div data-gl style={{ position: "absolute", inset: 0, zIndex: 1, opacity: 0 }} />
          <div data-scrim style={{ position: "absolute", inset: 0, zIndex: 2, pointerEvents: "none", opacity: 0, background: "linear-gradient(90deg,rgba(14,13,11,.92) 0%,rgba(14,13,11,.75) 38%,rgba(14,13,11,0) 72%)" }} />
          <div className="display" style={{ position: "absolute", inset: 0, zIndex: 3, pointerEvents: "none", fontVariationSettings: "'wdth' 118", lineHeight: 0.9, textShadow: "0 2px 30px rgba(14,13,11,.9)" }}>
            {phrases.map((p) => (
              <div key={p.k} data-ph={p.range} className="phrase" style={{ position: "absolute", left: "var(--gx)", top: "50%", transform: "translateY(-50%)", maxWidth: "min(62vw,980px)", opacity: 0 }}>
                <div data-k style={{ font: "500 14px var(--mono)", letterSpacing: ".14em", color: "#e99704", marginBottom: 28, display: "flex", gap: 14, alignItems: "center" }}>
                  <span style={{ width: 28, height: 2, background: "#e99704" }} />{p.k}
                </div>
                <div style={phraseLine}><Words text={p.a} /></div>
                <div style={{ ...phraseLine, color: "#e99704" }}><Words text={p.b} /></div>
              </div>
            ))}
          </div>
          <div data-herotext className="display" style={{ position: "absolute", inset: 0, display: "flex", flexDirection: "column", justifyContent: "center", alignItems: "center", fontSize: "15.5vw", lineHeight: 0.82, textAlign: "center", pointerEvents: "none", userSelect: "none", zIndex: 2 }}>
            {["INSPIRING", "THE NEXT"].map((line, li) => (
              <div key={line} style={{ overflow: "hidden", padding: "0 .04em .06em", ...(li ? { color: "transparent", WebkitTextStroke: "2px #e99704" } : {}) }}>
                {line.split("").map((c, i) => (
                  <span key={i} style={{ display: "inline-block", animation: "tec-rise 1s cubic-bezier(.2,.8,.2,1) both", animationDelay: 0.25 + (li * 9 + i) * 0.06 + "s" }}>
                    {c === " " ? " " : c}
                  </span>
                ))}
              </div>
            ))}
          </div>
          <div data-manwrap style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 var(--gx)", opacity: 0 }}>
            <div className="kicker">01 — WHAT IS TEC</div>
            <p className="display" style={{ fontSize: "clamp(26px,5vw,60px)", lineHeight: 1.08, letterSpacing: "-.02em", margin: "28px 0 0", maxWidth: 1200, textWrap: "pretty" }}>
              {manifesto.split(" ").map((w, i) => (
                <span key={i}>{i > 0 && " "}<span data-mw style={{ color: "#3a3832", transition: "color .25s" }}>{w}</span></span>
              ))}
            </p>
          </div>
          <div className="mono" style={{ position: "absolute", left: "var(--gx)", bottom: 30, zIndex: 4, fontWeight: 400, color: "#a09b91", display: "flex", gap: 10, alignItems: "center" }}>
            <span style={{ width: 8, height: 8, borderRadius: "50%", background: "#e99704", animation: "tec-blink 1.4s infinite" }} />
            <span data-cap>SCROLL TO POWER ON</span>
          </div>
          <div className="mono hide-phone" style={{ position: "absolute", right: "var(--gx)", bottom: 30, zIndex: 4, fontWeight: 400, color: "#a09b91" }}>LICET · THE ELECTRONICS CLUB</div>
        </div>
      </section>

      {/* 02 — vision & mission */}
      <section id="about" data-pin="vm" style={{ position: "relative", zIndex: 1, height: "700vh" }}>
        <div className="vm-grid" style={{ position: "sticky", top: 0, height: "var(--vh)", display: "grid", gap: 40, padding: "100px var(--gx) 56px", boxSizing: "border-box" }}>
          <div style={{ position: "relative" }}>
            <div className="kicker">02 — VISION &amp; MISSION</div>
            <div data-vmword="0" className="display vm-word" style={vmWord}>OUR<br />VISION</div>
            <div data-vmword="1" className="display vm-word" style={{ ...vmWord, color: "#e99704", opacity: 0, transform: "translateY(40px)" }}>OUR<br />MISSION</div>
            <div data-vmcount className="mono" style={{ position: "absolute", left: 0, bottom: 0, fontSize: 13, color: "#a09b91" }}>00 / 07 NODES ONLINE</div>
          </div>
          <div data-vmcol className="vm-rail" style={{ position: "relative", display: "flex", flexDirection: "column", justifyContent: "space-between", paddingLeft: 64 }}>
            <i style={{ position: "absolute", left: 11, top: 12, bottom: 12, width: 2, background: "#2a2824" }} />
            <i data-vmfill style={{ position: "absolute", left: 11, top: 12, width: 2, height: 0, background: "#e99704", boxShadow: "0 0 14px 2px #e99704" }} />
            {visionMission.map(([k, t]) => (
              <div key={k} data-vmitem style={{ position: "relative", opacity: 0.25, transform: "translateX(20px)", transition: "opacity .4s, transform .5s cubic-bezier(.2,.8,.2,1)" }}>
                <span data-vmnode style={{ position: "absolute", left: -64, top: 0, width: 24, height: 24, boxSizing: "border-box", borderRadius: "50%", border: "2px solid #3a3832", background: "#0e0d0b", transition: "all .3s" }} />
                <div className="mono" style={{ color: "#e99704", marginBottom: 6 }}>{k}</div>
                <div className="vm-text" style={{ lineHeight: 1.35, maxWidth: 620 }}>{t}</div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 03 — events */}
      <section id="events" data-pin="ev" style={{ position: "relative", zIndex: 1, height: "340vh" }}>
        <div style={{ ...sticky, display: "flex", flexDirection: "column", justifyContent: "center", gap: 44 }}>
          <div style={{ padding: "0 var(--gx)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div><div className="kicker">03 — EVENTS ORGANISED</div><h2 className="display h2">THE LOG</h2></div>
            <div data-evcount className="mono" style={{ fontSize: 13, color: "#a09b91" }}>01 / 05</div>
          </div>
          <div data-track="ev" style={{ display: "flex", gap: "min(24px, 4vw)", padding: "0 var(--gx)", width: "max-content", willChange: "transform" }}>
            {events.map((e) => (
              <div key={e.code} style={{ width: "var(--ev-w)", height: "var(--ev-h)", borderRadius: 16, background: e.bg, color: e.fg, padding: 28, boxSizing: "border-box", display: "flex", flexDirection: "column", justifyContent: "space-between", position: "relative", overflow: "hidden" }}>
                <div style={{ position: "absolute", right: -30, top: -30, width: 200, height: 200, borderRadius: "50%", border: `1px dashed ${e.fg}`, opacity: 0.25 }} />
                <div className="mono" style={{ display: "flex", justifyContent: "space-between", position: "relative" }}><span>{e.code}</span><span>{e.kind}</span></div>
                <div style={{ position: "relative" }}>
                  <div className="mono" style={{ height: 120, marginBottom: 18, borderRadius: 8, border: `1px dashed ${e.fg}`, opacity: 0.6, display: "grid", placeItems: "center", fontWeight: 400, fontSize: 11 }}>[ EVENT PHOTO ]</div>
                  <div className="display" style={{ fontSize: 30, letterSpacing: "-.01em" }}>{e.name}</div>
                  <div style={{ marginTop: 8, opacity: 0.75 }}>{e.desc}</div>
                </div>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — teams */}
      <section id="teams" style={{ position: "relative", zIndex: 1, padding: "clamp(96px,14vw,160px) var(--gx)" }}>
        <div className="kicker">04 — SPIN-OFF TEAMS</div>
        <h2 className="display h2" style={{ marginBottom: 56 }}>BORN IN TEC.</h2>
        <div data-rv style={{ perspective: 1400 }}>
          <div data-tilt className="team-grid" style={{ display: "grid", border: "1px solid #2a2824", borderRadius: 20, overflow: "hidden", background: "#161512", transition: "transform .15s ease-out", transformStyle: "preserve-3d" }}>
            <div className="mono" style={{ minHeight: 460, background: "repeating-linear-gradient(-45deg,rgba(233,151,4,.35) 0 1.5px,transparent 1.5px 6px),#1c1a16", display: "grid", placeItems: "center", fontWeight: 400, color: "#a09b91" }}>[ MARS ROVER PHOTO ]</div>
            <div style={{ padding: "clamp(24px,5vw,44px)", display: "flex", flexDirection: "column", justifyContent: "space-between", gap: 40 }}>
              <div className="mono" style={{ color: "#a09b91", display: "flex", justifyContent: "space-between" }}><span>TEAM 01</span><span style={{ color: "#e99704" }}>● ACTIVE</span></div>
              <div>
                <div className="display" style={{ fontSize: "clamp(56px,12vw,96px)", lineHeight: 0.9, color: "#e99704" }}>VAAGI</div>
                <div className="mono" style={{ fontSize: 14, marginTop: 14 }}>MARS ROVER TEAM</div>
                <p style={{ color: "#a09b91", lineHeight: 1.55, margin: "18px 0 0", maxWidth: 380 }}>Spun off from TEC. Add a short description of the rover and its competitions here.</p>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* 05 — gallery teaser */}
      <section id="gallery" style={{ position: "relative", zIndex: 1, height: "260vh" }}>
        <div style={sticky}>
          <div style={{ position: "absolute", left: "var(--gx)", right: "var(--gx)", top: 84, display: "flex", justifyContent: "space-between", alignItems: "flex-end", zIndex: 5, pointerEvents: "none" }}>
            <div><div className="kicker">05 — GALLERY</div><h2 className="display h2">ON THE BENCH</h2></div>
            <div className="mono" style={{ color: "#a09b91", textAlign: "right", lineHeight: 1.6 }}>03 FRAMES<br />OF 120+</div>
          </div>
          <div style={{ position: "absolute", inset: 0, top: 40 }}>
            {galleryCards.map((g, i) => (
              <div key={g.label} data-gc style={{ position: "absolute", left: "50%", top: "50%", width: "var(--gal-w)", aspectRatio: "4/5", margin: "calc(var(--gal-w) * -0.625) 0 0 calc(var(--gal-w) * -0.5)", willChange: "transform", zIndex: 3 - i }}>
                {/* ponytail: placeholder until gallery photos exist — swap for next/image */}
                <div className="mono" style={{ position: "absolute", inset: 0, borderRadius: 14, overflow: "hidden", background: "repeating-linear-gradient(-45deg,rgba(242,240,234,.05) 0 1px,transparent 1px 7px),#1a1915", boxShadow: "0 30px 80px rgba(0,0,0,.55)", border: "1px solid #2a2824", display: "grid", placeItems: "center", color: "#6f6a60", fontWeight: 400 }}>
                  [ {g.label} PHOTO ]
                </div>
                <div className="mono" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 14px)", display: "flex", justifyContent: "space-between", color: "#a09b91" }}>
                  <span>F/{pad(i + 1)}</span><span>{g.label}</span>
                </div>
              </div>
            ))}
          </div>
          <div data-galbtn style={{ position: "absolute", left: "50%", bottom: "7vh", transform: "translate(-50%,40px)", opacity: 0, zIndex: 6 }}>
            <button className="gal-btn display" onClick={() => setGalOpen(true)}>
              VIEW FULL GALLERY
              <span style={{ width: 40, height: 40, borderRadius: "50%", background: "#14130f", color: "#e99704", display: "grid", placeItems: "center", fontSize: 18 }}>↗</span>
            </button>
          </div>
        </div>
      </section>

      {galOpen && <GalleryOverlay onClosed={() => setGalOpen(false)} />}

      {/* 06 — core team */}
      <section id="core" style={{ position: "relative", zIndex: 1, padding: "80px var(--gx) clamp(96px,14vw,160px)" }}>
        <div className="kicker">06 — CORE TEAM</div>
        <h2 className="display h2" style={{ marginBottom: 56 }}>THE PEOPLE</h2>
        <div style={{ borderTop: "1px solid #2a2824" }}>
          {core.map((m) => (
            <div key={m.n} data-rv className="core-row">
              <span className="mono" style={{ opacity: 0.6 }}>{m.n}</span>
              <span className="mono">{m.role.toUpperCase()}</span>
              <span style={{ fontFamily: "var(--display)", fontWeight: 800, fontVariationSettings: "'wdth' 110", fontSize: 40, letterSpacing: "-.02em", lineHeight: 1 }}>{m.name}</span>
            </div>
          ))}
        </div>
        <div className="faculty" style={{ marginTop: 28, display: "flex", justifyContent: "space-between", alignItems: "center", padding: "24px 28px", background: "#f1eee6", color: "#14130f", borderRadius: 12 }}>
          <div>
            <div className="mono" style={{ opacity: 0.6 }}>FACULTY IN-CHARGE</div>
            <div className="display" style={{ fontSize: 30, marginTop: 6, letterSpacing: 0 }}>Mr.C.Augustine</div>
          </div>
          <div style={{ fontSize: 18 }}>Assistant Professor</div>
        </div>
      </section>

      {/* 07 — dashboard + footer */}
      <section id="dashboard" style={{ position: "relative", zIndex: 1, padding: "0 var(--gx) 40px" }}>
        <Link href={DASHBOARD} data-rv className="dash">
          <div className="mono" style={{ fontSize: 13 }}>07 — MEMBERS</div>
          <div className="display" style={{ fontSize: "10.5vw", lineHeight: 0.85, letterSpacing: "-.04em", marginTop: 24 }}>OPEN THE<br />DASHBOARD ↗</div>
          <div className="mono" style={{ marginTop: 36, fontSize: 13 }}>TEC-INVENTORY.VERCEL.APP</div>
        </Link>
        <div className="mono foot" style={{ display: "flex", justifyContent: "space-between", alignItems: "center", padding: "28px 4px 0", color: "#a09b91" }}>
          <span>TEC · THE ELECTRONICS CLUB · LICET</span>
          <a href={GITHUB} className="foot-link">GITHUB / TEC-INVENTORY ↗</a>
          <span>INSPIRING THE NEXT</span>
        </div>
      </section>
    </div>
  );
}
