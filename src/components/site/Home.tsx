"use client";

import { useEffect, useRef, useState, type CSSProperties } from "react";
import Link from "next/link"
import { TecLogo } from "@/components/tec-logo";
import { MorphicNavbar } from "@/components/ui/split-nav";
import ScrollIndex from "@/components/ui/scroll-index";
import VisionMission from "./VisionMission";
import FootRotor from "./FootRotor";
import { archive, core, galleryCards, manifesto, pad } from "@/lib/site/content";
import { featuredEvents } from "@/lib/site/events";
import GalleryOverlay from "./GalleryOverlay";

const DASHBOARD = "/dashboard"; // the inventory app lives in the same site
const GITHUB = "https://github.com/jonathan-1218/TEC-Inventory";

const sticky: CSSProperties = { position: "sticky", top: 0, height: "var(--vh)", overflow: "hidden" };

const clamp = (v: number) => Math.max(0, Math.min(1, v));
const ss = (x: number) => x * x * (3 - 2 * x);

/** Seconds after the intro when the hero letters have landed: the scroll hint appears and scrolling unlocks. */
const HINT_AT = 2.1;
const SITE_NAV = Object.fromEntries(["top", "about", "events", "gallery", "core"].map((id) => ["#" + id, { name: id === "top" ? "HOME" : id.toUpperCase() }]));

export default function Home() {
  const rootRef = useRef<HTMLDivElement>(null);
  const [galOpen, setGalOpen] = useState(false);
  const galOpenRef = useRef(false);
  useEffect(() => { galOpenRef.current = galOpen; }, [galOpen]);

  useEffect(() => {
    const root = rootRef.current!;
    const $ = <E extends HTMLElement = HTMLElement>(s: string) => root.querySelector<E>(s)!;
    const $$ = (s: string) => Array.from(root.querySelectorAll<HTMLElement>(s));

    const nav = $("[data-nav]"), herotext = $("[data-herotext]"), manwrap = $("[data-manwrap]");
    const heroSec = $("[data-pin=hero]"), gbox = $<HTMLVideoElement>("[data-gl]");
    const evSec = $("[data-pin=ev]"), evTrack = $("[data-track=ev]");
    const galSec = $("#gallery"), galCards = $$("[data-gc]"), galBtn = $("[data-galbtn]");
    const reveals = $$("[data-rv]");

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

    // The board fly-through, quotes included, is a pre-rendered video: a 16:9 cut for wide screens and a tall cut
    // for phones held upright (re-record both if the quotes change). It plays by itself whenever it is on screen;
    // scrolling is never hijacked and never moves the video.
    gbox.src = matchMedia("(orientation: portrait)").matches ? "/site/hero-portrait.mp4" : "/site/hero.mp4";
    gbox.defaultPlaybackRate = gbox.playbackRate = 0.9;
    let playing = false;
    let mx = 0, my = 0, raf = 0;
    const onMove = (e: MouseEvent) => { mx = e.clientX / innerWidth - 0.5; my = e.clientY / innerHeight - 0.5; };
    // Parallax is for pointers only; on touch it would just keep the frame loop busy.
    if (matchMedia("(hover: hover)").matches) addEventListener("mousemove", onMove);
    // 100svh probe: unlike innerHeight it doesn't change as the phone's address bar collapses mid-scroll, so the pinned
    // sections don't jitter.
    const probe = document.createElement("div");
    probe.style.cssText = "position:absolute;left:0;top:0;height:100svh;width:0;visibility:hidden;pointer-events:none";
    root.appendChild(probe);
    const small = matchMedia("(max-width: 600px)");

    let ly = -1, lx = 0, lyy = 0, lw = 0;
    const tick = () => {
      const vh = probe.offsetHeight || innerHeight, sy = scrollY;
      // Nothing moved and the hero's board is off-screen: skip the whole frame.
      if (sy === ly && mx === lx && my === lyy && innerWidth + vh === lw && sy > heroSec.offsetHeight) { raf = requestAnimationFrame(tick); return; }
      ly = sy; lx = mx; lyy = my; lw = innerWidth + vh;

      // hero: board fly-through + phrases
      const hr = heroSec.getBoundingClientRect();
      const hp = clamp(-hr.top / (hr.height - vh));
      // Play while the video is on screen, pause when it is scrolled away; a finished video starts over next time.
      // ponytail: if the browser refuses autoplay (iOS Low Power Mode) it stays on its first frame.
      const show = hp > 0.08 && hp < 0.87;
      if (show !== playing) {
        playing = show;
        if (!show) gbox.pause();
        else { if (gbox.ended) gbox.currentTime = 0; gbox.play().catch(() => {}); }
      }
      gbox.style.opacity = String(ss(clamp((hp - 0.08) / 0.14)) * (1 - ss(clamp((hp - 0.8) / 0.07))));
      herotext.style.opacity = String(1 - ss(clamp((hp - 0.03) / 0.1)));
      herotext.style.transform = `scale(${1 + Math.min(hp, 0.15) * 1.5})`;
      nav.dataset.on = hp > 0.84 ? "1" : "0";
      manwrap.style.opacity = String(ss(clamp((hp - 0.86) / 0.05)));
      // Words light up one after another on their own clock (CSS delays), not squeezed into the scroll.
      manwrap.dataset.lit = hp > 0.9 ? "1" : "0";

      // Read every rect first, then write: interleaving forces a layout per element on each frame.
      const rv = reveals.map((el) => clamp((vh * 0.94 - el.getBoundingClientRect().top) / (vh * 0.28)));
      reveals.forEach((el, i) => { el.style.opacity = String(rv[i]); el.style.translate = `0 ${(1 - rv[i]) * 50}px`; });

      // events: horizontal track
      const er = evSec.getBoundingClientRect(), ep = clamp(-er.top / (er.height - vh));
      evTrack.style.transform = `translateX(${-ep * Math.max(0, evTrack.scrollWidth - innerWidth)}px)`;

      // gallery: fan out the stack
      {
        const p = clamp(-galSec.getBoundingClientRect().top / (galSec.offsetHeight - vh));
        const spread = ss(clamp((p - 0.08) / 0.5)), gap = galCards[0].offsetWidth * (small.matches ? 0.98 : 1.12);
        galCards.forEach((c, i) => {
          const d = i - 1, k = ss(clamp(spread * 1.25 - Math.abs(d) * 0.12 - (i === 1 ? 0.1 : 0)));
          const x = d * gap * k + (1 - k) * d * 18, y = (1 - k) * (i * 14) + Math.sin(k * Math.PI) * -40 + (d === 0 ? 0 : 28 * k);
          const r = galleryCards[i].rot * (1 - k) + d * 3 * k;
          c.style.transform = `translate(${x + mx * 14 * (i + 1)}px,${y + my * 10 * (i + 1)}px) rotate(${r}deg) scale(${0.86 + 0.14 * k})`;
          (c.lastElementChild as HTMLElement).style.opacity = String(k); // captions only once the stack has fanned out
        });
        const b = ss(clamp((p - 0.62) / 0.2));
        galBtn.style.opacity = String(b);
        galBtn.style.transform = `translate(-50%,${(1 - b) * 40}px)`;
      }

      raf = requestAnimationFrame(tick);
    };
    raf = requestAnimationFrame(tick);
    return () => {
      cancelAnimationFrame(raf); removeEventListener("mousemove", onMove); probe.remove();
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
      <section id="top" data-index="Power on" data-pin="hero" style={{ position: "relative", zIndex: 1, height: "400vh" }}>
        <div style={sticky}>
          <video data-gl muted playsInline preload="auto" aria-hidden="true" style={{ position: "absolute", inset: 0, zIndex: 1, opacity: 0, width: "100%", height: "100%", objectFit: "cover" }} />
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
                <span key={i}>{i > 0 && " "}<span data-mw style={{ "--d": `${i * 0.09}s` } as CSSProperties}>{w}</span></span>
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
            {featuredEvents.map((e, i) => (
              <article key={e.id} className="ev-card" style={{ background: i % 2 ? "#e99704" : "#f1eee6" }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static webp, already sized for the card */}
                <img src={e.img} alt={e.title} loading="lazy" decoding="async" className="ev-img" />
                <div className="mono ev-meta"><span>{pad(i + 1)} · {e.kind}</span><span>{e.when.toUpperCase()}</span></div>
                <div className="display ev-title">{e.title}</div>
                <p className="ev-desc">{e.desc}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      {/* 04 — gallery teaser */}
      <section id="gallery" data-index="Gallery" style={{ position: "relative", zIndex: 1, height: "380vh" }}>
        <div style={sticky}>
          <div style={{ position: "absolute", left: "var(--gx)", right: "var(--gx)", top: 84, display: "flex", justifyContent: "space-between", alignItems: "flex-end", zIndex: 5, pointerEvents: "none" }}>
            <div><div className="kicker">04 — GALLERY</div><h2 className="display h2">ON THE BENCH</h2></div>
            <div className="mono" style={{ color: "var(--muted)", textAlign: "right", lineHeight: 1.6 }}>03 FRAMES<br />OF {archive.length}</div>
          </div>
          <div style={{ position: "absolute", inset: 0, top: 40 }}>
            {galleryCards.map((g, i) => (
              <div key={g.label} data-gc style={{ position: "absolute", left: "50%", top: "50%", width: "var(--gal-w)", aspectRatio: "4/5", margin: "calc(var(--gal-w) * -0.625) 0 0 calc(var(--gal-w) * -0.5)", willChange: "transform", zIndex: i === 1 ? 3 : 2 - i / 2 }}>
                {/* eslint-disable-next-line @next/next/no-img-element -- static webp */}
                <img src={g.src} alt="" loading="lazy" decoding="async" style={{ position: "absolute", inset: 0, width: "100%", height: "100%", objectFit: "cover", borderRadius: 14, boxShadow: "0 30px 80px rgba(0,0,0,.55)", border: "1px solid #2a2824", background: "#1a1915" }} />
                <div className="mono" style={{ position: "absolute", left: 0, right: 0, top: "calc(100% + 14px)", display: "flex", justifyContent: "space-between", color: "var(--muted)" }}>
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

      {/* 05 — core team */}
      <section id="core" data-index="Core team" style={{ position: "relative", zIndex: 1, padding: "80px var(--gx) clamp(96px,14vw,160px)" }}>
        <div className="kicker">05 — CORE TEAM</div>
        <h2 className="display h2" style={{ marginBottom: 56 }}>THE PEOPLE</h2>
        <div style={{ borderTop: "1px solid var(--line)" }}>
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
            <p style={{ color: "var(--muted)", lineHeight: 1.55, margin: "16px 0 0", }}>The Electronics Club of LICET.<br />A community that builds. Inspiring the next.</p>
          </div>
          <div>
            <div className="mono foot-h">EXPLORE</div>
            <div className="mono foot-list">
              {["about", "events", "gallery", "core"].map((s) => <a key={s} href={"#" + s} className="foot-link">{s.toUpperCase()}</a>)}
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
