"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link"
import { TecLogo } from "@/components/tec-logo";
import { MorphicNavbar } from "@/components/ui/split-nav";
import ScrollIndex from "@/components/ui/scroll-index";
import type { initBoard as InitBoard } from "@/lib/site/board-scene";
import VisionMission from "./VisionMission";
import FootRotor from "./FootRotor";
import { core, events, galleryCards, manifesto, pad, phrases } from "@/lib/site/content";
import GalleryOverlay from "./GalleryOverlay";

const DASHBOARD = "/dashboard"; // the inventory app lives in the same site
const GITHUB = "https://github.com/jonathan-1218/TEC-Inventory";

const sticky: CSSProperties = { position: "sticky", top: 0, height: "var(--vh)", overflow: "hidden" };
const phraseLine: CSSProperties = { fontSize: "clamp(30px,7.4vw,132px)" };

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

/** Seconds after the intro when the hero letters have landed: the scroll hint appears and scrolling unlocks. */
const HINT_AT = 2.1;
const SITE_NAV = Object.fromEntries(["top", "about", "events", "teams", "gallery", "core"].map((id) => ["#" + id, { name: id === "top" ? "HOME" : id.toUpperCase() }]));

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [galOpen, setGalOpen] = useState(false);

  useEffect(() => {
    const root = rootRef.current!;
    const $ = <E extends HTMLElement = HTMLElement>(s: string) => root.querySelector<E>(s)!;
    const $$ = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));

    const nav = $("[data-nav]"), herotext = $("[data-herotext]"), manwrap = $("[data-manwrap]");
    const heroSec = $("[data-pin=hero]"), gbox = $("[data-gl]"), scrim = $("[data-scrim]");
    const evSec = $("[data-pin=ev]"), evTrack = $("[data-track=ev]");
    const galSec = $("#gallery"), galCards = $$("[data-gc]"), galBtn = $("[data-galbtn]");
    const tilt = $("[data-tilt]"), reveals = $$("[data-rv]"), manWords = $$("[data-mw]");
    const phs = $$("[data-ph]").map((el) => {
      const [a, b] = el.dataset.ph!.split(",").map(Number);
      return { el, a, b, ws: Array.from(el.querySelectorAll<HTMLElement>("[data-w]")), k: el.querySelector<HTMLElement>("[data-k]")! };
    });

    // Hold the page at the top until the TEC intro is over and the hero letters have risen, then let scrolling
    // (and the board fly-through it drives) begin.
    const html = document.documentElement;
    const hold = html.dataset.intro === "play" && !matchMedia("(prefers-reduced-motion: reduce)").matches;
    let releaseTimer = 0;
    const release = () => { releaseTimer = window.setTimeout(() => { html.style.overflow = ""; }, HINT_AT * 1000); };
    if (hold) {
      history.scrollRestoration = "manual";
      scrollTo(0, 0);
      html.style.overflow = "hidden";
      if (html.dataset.introDone) release();
      else addEventListener("tec:intro-done", release, { once: true });
    }

    // three.js is the bulk of the JS: load it after first paint instead of blocking it.
    let board: ReturnType<typeof InitBoard> | null = null, dead = false;
    import("@/lib/site/board-scene").then((m) => {
      if (!dead) board = m.initBoard(gbox, { mono: cssVar("--font-geist-mono"), display: cssVar("--font-archivo") });
    });
    let mx = 0, my = 0, raf = 0;
    const t0 = performance.now();
    const onMove = (e: MouseEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    addEventListener("mousemove", onMove);

    let ly = -1, lx = 0, lyy = 0, lw = 0;
    const tick = (now: number) => {
      const vh = innerHeight, sy = scrollY;
      // Nothing moved and the hero's board is off-screen: skip the whole frame.
      if (sy === ly && mx === lx && my === lyy && innerWidth + vh === lw && sy > heroSec.offsetHeight) { raf = requestAnimationFrame(tick); return; }
      ly = sy; lx = mx; lyy = my; lw = innerWidth + vh;

      // hero: board fly-through + phrases
      const hr = heroSec.getBoundingClientRect();
      const hp = clamp(-hr.top / (hr.height - vh)), gp = clamp((hp - 0.1) / 0.7);
      if (hp > 0.04 && hp < 0.9) board?.update(gp, mx, my, (now - t0) / 1000);
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
      nav.dataset.on = hp > 0.84 ? "1" : "0";
      manwrap.style.opacity = String(ss(clamp((hp - 0.86) / 0.05)));
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

      tilt.style.transform = `rotateY(${mx * 8}deg) rotateX(${-my * 6}deg)`;
      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      dead = true; cancelAnimationFrame(raf); removeEventListener("mousemove", onMove); board?.dispose();
      clearTimeout(releaseTimer); removeEventListener("tec:intro-done", release); html.style.overflow = ""; history.scrollRestoration = "auto";
    };
  }, []);

  return (
    <>
    {/* Outside .tec-site: that stylesheet unsets every <button>, which would flatten the rail's ticks. */}
    <ScrollIndex className="max-[900px]:hidden" />
    <div ref={rootRef} className="tec-site" style={{ overflowX: "clip", position: "relative" }}>

      <nav data-nav className="mono site-nav" style={{ position: "fixed", top: 0, left: 0, right: 0, zIndex: 70, display: "flex", alignItems: "center", justifyContent: "space-between", padding: "14px var(--gx)", background: "linear-gradient(rgba(14,13,11,.94) 45%,rgba(14,13,11,0))", backdropFilter: "blur(10px)" }}>
        <a href="#top" className="brand">
          <TecLogo height={34} className="brand-logo" />
          <i className="brand-bar" />
          <span className="brand-text display">THE ELECTRONICS<br /><em>CLUB</em></span>
        </a>
        <div className="nav-links" style={{ display: "flex", gap: 28, alignItems: "center" }}>
          <MorphicNavbar dark className="nav-split p-0" items={SITE_NAV} defaultPath="#top" />
          <Link href={DASHBOARD} className="cta">DASHBOARD ↗</Link>
        </div>
      </nav>

      {/* 01 — hero */}
      <section id="top" data-index="Power on" data-pin="hero" style={{ position: "relative", zIndex: 1, height: "950vh" }}>
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
                  <span key={i} data-rise style={{ display: "inline-block", animation: "tec-rise 1s cubic-bezier(.2,.8,.2,1) both", animationDelay: 0.25 + (li * 9 + i) * 0.06 + "s" }}>
                    {c === " " ? " " : c}
                  </span>
                ))}
              </div>
            ))}
            {/* Scroll hint: fades up once the letters have landed; the dot keeps rolling down the mouse. */}
            <div aria-hidden="true" data-rise className="scroll-hint" style={{ marginTop: "clamp(28px,5vh,56px)", display: "flex", flexDirection: "column", alignItems: "center", gap: 10, animation: `tec-hint-in .6s ease-out ${HINT_AT}s both` }}>
              <span style={{ width: 22, height: 34, border: "1.5px solid rgba(242,240,234,.55)", borderRadius: 12, display: "flex", justifyContent: "center", paddingTop: 6, boxSizing: "border-box" }}>
                <span style={{ width: 3, height: 7, borderRadius: 2, background: "#e99704", animation: "tec-hint-dot 1.6s ease-in-out infinite" }} />
              </span>
              <span className="mono" style={{ fontSize: 11, letterSpacing: ".2em", color: "#a09b91", WebkitTextStroke: 0 }}>SCROLL</span>
            </div>
          </div>
          <div data-manwrap style={{ position: "absolute", inset: 0, zIndex: 3, display: "flex", flexDirection: "column", justifyContent: "center", padding: "0 var(--gx)", opacity: 0 }}>
            <div className="kicker">01 — WHAT IS TEC</div>
            <p className="display" style={{ fontSize: "clamp(26px,5vw,60px)", lineHeight: 1.08, letterSpacing: "-.02em", margin: "28px 0 0", maxWidth: 1200, textWrap: "pretty" }}>
              {manifesto.split(" ").map((w, i) => (
                <span key={i}>{i > 0 && " "}<span data-mw style={{ color: "#3a3832", transition: "color .25s" }}>{w}</span></span>
              ))}
            </p>
          </div>
        </div>
      </section>

      {/* 02 — vision & mission */}
      <VisionMission />

      {/* 03 — events */}
      <section id="events" data-index="Events" data-pin="ev" style={{ position: "relative", zIndex: 1, height: "520vh" }}>
        <div style={{ ...sticky, display: "flex", flexDirection: "column", justifyContent: "center", gap: 44 }}>
          <div style={{ padding: "0 var(--gx)", display: "flex", justifyContent: "space-between", alignItems: "flex-end" }}>
            <div><div className="kicker">03 — EVENTS ORGANISED</div><h2 className="display h2">THE LOG</h2></div>
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
      <section id="teams" data-index="Teams" style={{ position: "relative", zIndex: 1, padding: "clamp(96px,14vw,160px) var(--gx)" }}>
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
      <section id="gallery" data-index="Gallery" style={{ position: "relative", zIndex: 1, height: "380vh" }}>
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
      <section id="core" data-index="Core team" style={{ position: "relative", zIndex: 1, padding: "80px var(--gx) clamp(96px,14vw,160px)" }}>
        <div className="kicker">06 — CORE TEAM</div>
        <h2 className="display h2" style={{ marginBottom: 56 }}>THE PEOPLE</h2>
        <div style={{ borderTop: "1px solid #2a2824" }}>
          {core.map((m) => (
            <div key={m.n} data-rv className="core-row">
              <span className="mono core-n">{m.n}</span>
              <span className="core-av" aria-hidden>{m.name.split(" ").slice(0, 2).map((w) => w[0]).join("")}</span>
              <span className="mono">{m.role.toUpperCase()}</span>
              <span className="core-name">{m.name}</span>
              <span className="mono core-go" aria-hidden>TEC / {m.n} →</span>
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

      {/* footer */}
      <footer className="site-foot">
        <FootRotor lines={["THE ELECTRONICS CLUB", "TEC"]} className="foot-mark display" />
        <div className="foot-grid">
          <div>
            <span style={{ background: "#f1eee6", borderRadius: 8, padding: "5px 8px", display: "inline-flex" }}>
              {/* eslint-disable-next-line @next/next/no-img-element -- tiny inline SVG logo */}
              <img src="/site/tec-logo.svg" alt="TEC" style={{ height: 26, display: "block" }} />
            </span>
            <p style={{ color: "#a09b91", lineHeight: 1.55, margin: "16px 0 0", }}>The Electronics Club of LICET.<br />A community that builds. Inspiring the next.</p>
          </div>
          <div>
            <div className="mono foot-h">EXPLORE</div>
            <div className="mono foot-list">
              {["about", "events", "teams", "gallery", "core"].map((s) => <a key={s} href={"#" + s} className="foot-link">{s.toUpperCase()}</a>)}
            </div>
          </div>
          <div>
            <div className="mono foot-h">MEMBERS</div>
            <div className="mono foot-list">
              <Link href={DASHBOARD} className="foot-link">INVENTORY DASHBOARD ↗</Link>
              <a href={GITHUB} className="foot-link">GITHUB / TEC-INVENTORY ↗</a>
            </div>
          </div>
        </div>
        <div className="mono foot-bar"><span>DEVELOPED BY <b className="foot-dev">JONATHAN JESHUA S</b> · <b className="foot-dev">OPHRIEL SYSTEMS</b></span></div>
      </footer>
    </div>
    </>
  );
}
