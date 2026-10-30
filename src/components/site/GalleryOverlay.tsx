"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { archive, pad, type GalleryItem } from "@/lib/site/content";

type Filter = "all" | "photo" | "video";
const C = 8, R = 6; // wall: 8×6 cells that wrap infinitely; cell size depends on the screen (see `cell`)
const label = { font: "500 11px var(--mono)", letterSpacing: ".08em", textTransform: "uppercase" } as const;
const ink = (c: string) => (c.includes("233,151,4") ? "rgba(233,151,4,.5)" : "rgb(var(--a-rgb) / .13)");
const hatch = (c: string) => `repeating-linear-gradient(-45deg,${ink(c)} 0 1px,transparent 1px 7px),var(--a-tile)`;

// faint "details" scattered behind the photos: wordmarks, archive metadata, marks
const marks = ["✳", "®", "●", "↗", "+", "◐"];
const ghostFor = (k: number) => {
  const g = archive[(k * 5) % archive.length], n = archive[(k * 3 + 1) % archive.length];
  switch (k % 4) {
    case 0: return { w: 360, big: true, text: "TEC®", style: { fontSize: 92, color: "rgb(var(--a-rgb) / .07)" } };
    case 1: return { w: 300, big: true, text: "The Electronics\nClub", style: { fontSize: 44, color: "rgb(var(--a-rgb) / .09)" } };
    case 2: return { w: 210, big: false, text: `${g.id}  ${g.title}\n${g.tag}, ${g.year}\n${n.id}  ${n.title}\n${n.tag}, ${n.year}\nLICET, Chennai — Est. 2019\nInspiring the next.`, style: { fontSize: 11, color: "rgb(var(--a-rgb) / .38)" } };
    default: return { w: 60, big: false, text: marks[(k >> 2) % marks.length], style: { fontSize: 34, color: "rgb(var(--a-rgb) / .22)" } };
  }
};

export default function GalleryOverlay({ onClosed }: { onClosed: () => void }) {
  const [filter, setFilter] = useState<Filter>("all");
  const [view, setView] = useState<"grid" | "index">("grid");
  const [clip, setClip] = useState("inset(100% 0 0 0)");
  const [lb, setLb] = useState<GalleryItem | null>(null);
  const wallRef = useRef<HTMLDivElement>(null);
  const curRef = useRef<HTMLDivElement>(null);
  const glowRef = useRef<HTMLDivElement>(null);
  const [theme, setTheme] = useState<"light" | "dark">("dark"); // opens dark from the homepage button; the toggle still switches to light

  // Big cells on desktop; smaller on phones so a tile never spills past a 375px screen.
  const [CW, CH] = useMemo(() => (innerWidth < 600 ? [300, 380] : [460, 560]), []);
  const list = useMemo(() => archive.filter((g) => filter === "all" || (filter === "video") === g.vid), [filter]);
  const tiles = useMemo(() => {
    const out = [];
    for (let r = 0; r < R; r++) for (let c = 0; c < C; c++) {
      const k = r * C + c, g = list[(k * 7 + r) % list.length], [a, b] = g.ar.split("/").map(Number);
      const w = Math.round(CW * (0.62 + ((k * 37) % 28) / 100)), h = Math.min(CH * 0.85, Math.round((w * b) / a));
      out.push({ g, k, w, h, bx: c * CW + ((k * 53) % (CW - w + 1)), by: r * CH + ((k * 29) % Math.max(1, CH - h)) });
    }
    return out;
  }, [list, CW, CH]);
  const ghosts = useMemo(
    () => Array.from({ length: C * R }, (_, k) => ({ k, ...ghostFor(k), bx: (k % C) * CW + ((k * 97) % 140), by: Math.floor(k / C) * CH + ((k * 61) % 330) })),
    [CW, CH],
  );

  // open: wipe in from the bottom, lock page scroll
  useEffect(() => {
    document.body.style.overflow = "hidden";
    const id = requestAnimationFrame(() => requestAnimationFrame(() => setClip("inset(0 0 0 0)")));
    return () => { cancelAnimationFrame(id); document.body.style.overflow = ""; };
  }, []);
  const close = () => { setClip("inset(0 0 100% 0)"); setTimeout(onClosed, 1000); };

  // drag / wheel / inertia on the wall
  useEffect(() => {
    const el = wallRef.current;
    if (!el) return;
    const W = C * CW, H = R * CH, md = (a: number, n: number) => ((a % n) + n) % n;
    const els = Array.from(el.querySelectorAll<HTMLElement>("[data-tile]"));
    const gels = Array.from(el.querySelectorAll<HTMLElement>("[data-ghost]"));
    // Opening: the wall zooms out into place. Every frame starts bigger and pushed out from the centre of the screen,
    // then glides to its own spot and shrinks to its real size (the photo stays fitted to its frame). Frames near the
    // centre settle first.
    if (!matchMedia("(prefers-reduced-motion: reduce)").matches) els.forEach((t, i) => {
      const x = md(tiles[i].bx - CW, W) - CW + tiles[i].w / 2 - innerWidth / 2, y = md(tiles[i].by - CH, H) - CH + tiles[i].h / 2 - innerHeight / 2;
      const delay = 350 + Math.min(500, Math.hypot(x, y) * 0.3);
      t.firstElementChild?.animate(
        [{ transform: `translate(${x * 0.6}px,${y * 0.6}px) scale(1.6)`, opacity: 0 }, { opacity: 1, offset: 0.25 }, { transform: "translate(0,0) scale(1)", opacity: 1 }],
        { duration: 1400, delay, easing: "cubic-bezier(.16,1,.3,1)", fill: "backwards" },
      );
    });
    let tx = innerWidth / 2, ty = innerHeight / 2, cx = tx, cy = ty;
    let ox = -CW, oy = -CH, vx = 0, vy = 0, moved = 0, run = true, down: { x: number; y: number } | null = null;
    const pd = (e: PointerEvent) => { down = { x: e.clientX, y: e.clientY }; moved = 0; vx = vy = 0; el.style.cursor = "grabbing"; };
    const pm = (e: PointerEvent) => {
      tx = e.clientX; ty = e.clientY;
      if (curRef.current) curRef.current.style.transform = `translate(${e.clientX + 16}px,${e.clientY + 16}px)`;
      if (!down) return;
      const dx = e.clientX - down.x, dy = e.clientY - down.y;
      moved += Math.abs(dx) + Math.abs(dy); ox += dx; oy += dy; vx = dx; vy = dy; down = { x: e.clientX, y: e.clientY };
    };
    const pu = (e: PointerEvent) => {
      el.style.cursor = "grab";
      if (down && moved < 6) {
        const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tile]");
        if (t) setLb(tiles[+t.dataset.tile!].g);
      }
      down = null;
    };
    const wh = (e: WheelEvent) => { e.preventDefault(); vx -= e.deltaX * 0.25; vy -= e.deltaY * 0.25; };
    const ov = (e: PointerEvent) => {
      const t = (e.target as HTMLElement).closest<HTMLElement>("[data-tile]"), cur = curRef.current;
      if (!cur) return;
      cur.style.opacity = t ? "1" : "0";
      if (t) { const g = tiles[+t.dataset.tile!].g; cur.textContent = `${g.id} — ${g.title}, ${g.year}`; }
    };
    el.addEventListener("pointerdown", pd); addEventListener("pointermove", pm); addEventListener("pointerup", pu);
    el.addEventListener("wheel", wh, { passive: false }); el.addEventListener("pointerover", ov);
    const floaty = !matchMedia("(prefers-reduced-motion: reduce)").matches;
    const loop = () => {
      if (!run) return;
      if (!down) { ox += vx; oy += vy; vx *= 0.93; vy *= 0.93; }
      const sk = Math.max(-6, Math.min(6, vx * 0.15)), sc = 1 - Math.min(0.08, Math.hypot(vx, vy) * 0.002);
      // cursor response: smoothed pointer drives parallax, a proximity swell on tiles, and a glow
      cx += (tx - cx) * 0.12; cy += (ty - cy) * 0.12;
      const nx = cx / innerWidth - 0.5, ny = cy / innerHeight - 0.5, now = performance.now() / 1000;
      els.forEach((t, i) => {
        const { w, h } = tiles[i];
        let x = md(tiles[i].bx + ox, W) - CW - nx * 36, y = md(tiles[i].by + oy, H) - CH - ny * 36;
        const dx = cx - (x + w / 2), dy = cy - (y + h / 2), near = Math.max(0, 1 - Math.hypot(dx, dy) / 380);
        x += dx * near * 0.05; y += dy * near * 0.05;
        // idle float: each frame bobs a few px on its own slow rhythm, like a light cloud, around its fixed spot
        if (floaty) { x += Math.sin(now * 0.55 + i * 1.7) * 5; y += Math.sin(now * 0.42 + i * 2.3) * 8; }
        t.style.transform = `translate3d(${x}px,${y}px,0) skewX(${sk}deg) scale(${sc * (1 + near * 0.09)})`;
        t.style.zIndex = String(Math.round(near * 10));
      });
      if (glowRef.current) glowRef.current.style.background = `radial-gradient(560px circle at ${cx}px ${cy}px, rgb(233 151 4 / var(--a-glow)), transparent 62%)`;
      // background details drift slower than the photos, for depth
      gels.forEach((t, i) => {
        const x = md(ghosts[i].bx + ox * 0.6, W) - CW, y = md(ghosts[i].by + oy * 0.6, H) - CH;
        t.style.transform = `translate3d(${x + nx * 22}px,${y + ny * 22}px,0)`;
      });
      requestAnimationFrame(loop);
    };
    loop();
    return () => {
      run = false;
      el.removeEventListener("pointerdown", pd); removeEventListener("pointermove", pm); removeEventListener("pointerup", pu);
      el.removeEventListener("wheel", wh); el.removeEventListener("pointerover", ov);
    };
  }, [tiles, ghosts, view, CW, CH]);

  const tabs: [Filter, string][] = [["all", "All"], ["photo", "Photos"], ["video", "Videos"]];
  const count = (f: Filter) => pad(archive.filter((g) => f === "all" || (f === "video") === g.vid).length);

  return (
    <div className="arch" data-theme={theme} style={{ display: "contents" }}>
      <div style={{ position: "fixed", inset: 0, zIndex: 200, background: "var(--a-bg)", color: "var(--a-ink)", overflow: "hidden", clipPath: clip, transition: "clip-path 1s cubic-bezier(.76,0,.24,1)" }}>
        {view === "grid" ? (
          <div ref={wallRef} style={{ position: "absolute", inset: 0, zIndex: 1, isolation: "isolate", cursor: "grab", touchAction: "none", userSelect: "none" }}>
            <div ref={glowRef} style={{ position: "absolute", inset: 0, pointerEvents: "none" }} />
            {ghosts.map((s) => (
              <div key={"g" + s.k} data-ghost style={{ position: "absolute", left: 0, top: 0, width: s.w, pointerEvents: "none", willChange: "transform" }}>
                <div className={s.big ? "display" : "mono"} style={{ whiteSpace: "pre-line", lineHeight: s.big ? 0.92 : 1.55, fontWeight: s.big ? 900 : 500, letterSpacing: s.big ? "-.03em" : ".04em", ...s.style }}>{s.text}</div>
              </div>
            ))}
            {tiles.map(({ g, k, w, h }) => (
              <div key={k} data-tile={k} style={{ position: "absolute", left: 0, top: 0, width: w, height: h, willChange: "transform" }}>
                <div className="tile-in" style={{ width: "100%", height: "100%", overflow: "hidden", background: hatch(g.c), outline: "1px solid rgb(var(--a-rgb) / .08)" }}>
                  {/* eslint-disable-next-line @next/next/no-img-element -- static webp */}
                  <img src={g.src} alt={g.title} loading="lazy" decoding="async" draggable={false} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
                  {g.vid && <div style={{ ...label, position: "absolute", top: 10, left: 10, fontSize: 10, color: "#e99704" }}>● {g.dur}</div>}
                  <div style={{ ...label, position: "absolute", left: 10, bottom: 10, fontSize: 10, color: "#f2f0ea", textShadow: "0 1px 6px rgba(0,0,0,.8)" }}>{g.id}</div>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div style={{ position: "absolute", inset: 0, overflowY: "auto", padding: "140px var(--gx) 120px" }}>
            <div className="idx-row" style={{ ...label, cursor: "default", color: "#6f6a60", paddingTop: 0, borderBottomColor: "rgb(var(--a-rgb) / .2)" }}>
              <span>No.</span><span>Title</span><span>Category</span><span>Type</span><span style={{ textAlign: "right" }}>Year</span>
            </div>
            {list.map((g) => (
              <div key={g.id} className="idx-row" onClick={() => setLb(g)}>
                <span style={label}>{g.id}</span>
                <span className="display" style={{ fontSize: "clamp(28px,3.4vw,56px)", lineHeight: 1, textTransform: "uppercase" }}>{g.title}</span>
                <span style={label}>{g.tag}</span>
                <span style={label}>{g.type}</span>
                <span style={{ ...label, textAlign: "right" }}>{g.year}</span>
              </div>
            ))}
          </div>
        )}

        {/* the wall keeps its own stacking context (tiles swell above each other, never above the UI); scrims keep header/footer text legible */}
        <div style={{ position: "absolute", left: 0, right: 0, top: 0, height: 150, zIndex: 4, pointerEvents: "none", background: "linear-gradient(var(--a-bg) 40%, transparent)" }} />
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: "clamp(120px, 30vh, 300px)", zIndex: 4, pointerEvents: "none", background: "linear-gradient(transparent, var(--a-bg) 60%)" }} />
        <div className="arch-head" style={{ ...label, fontSize: 12, position: "absolute", left: 0, right: 0, top: 0, zIndex: 5, display: "grid", gridTemplateColumns: "1fr auto 1fr", alignItems: "start", padding: "22px var(--gx)", pointerEvents: "none" }}>
          <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
            <span className="display" style={{ fontSize: 22, textTransform: "none" }}>TEC Archive®</span>
            <span style={{ color: "#9a968c" }}>Est. 2019 — LICET, Chennai</span>
          </div>
          <div style={{ display: "flex", gap: 6, pointerEvents: "auto" }}>
            {tabs.map(([k, name]) => (
              <button key={k} className="dim-hover" style={{ opacity: filter === k ? 1 : 0.45 }} onClick={() => setFilter(k)}>{name} ({count(k)}),</button>
            ))}
          </div>
          <div style={{ display: "flex", justifyContent: "flex-end", gap: 18, pointerEvents: "auto" }}>
            <button onClick={() => setTheme(theme === "light" ? "dark" : "light")}>{theme === "light" ? "Dark" : "Light"},</button>
            <button style={{ opacity: view === "grid" ? 1 : 0.45 }} onClick={() => setView("grid")}>Grid,</button>
            <button style={{ opacity: view === "index" ? 1 : 0.45 }} onClick={() => setView("index")}>Index</button>
            <button style={{ marginLeft: 18, color: "#e99704" }} onClick={close}>Close ✕</button>
          </div>
        </div>
        <div style={{ position: "absolute", left: "var(--gx)", right: "var(--gx)", bottom: 18, zIndex: 5, display: "flex", justifyContent: "space-between", alignItems: "flex-end", pointerEvents: "none" }}>
          <div className="display" style={{ fontSize: "clamp(16px,4.2vw,72px)", lineHeight: 0.92, textTransform: "uppercase", whiteSpace: "nowrap" }}>The Electronics Club®<br />Est.2019<br />LICET, Chennai</div>
          <div className="hide-phone" style={{ ...label, fontSize: 12, color: "#9a968c", textAlign: "right", lineHeight: 1.7, flexShrink: 0, paddingLeft: 24 }}>
            {view === "grid" ? "Drag or scroll to explore — " : ""}{pad(list.length)} items
          </div>
        </div>
        <div ref={curRef} style={{ ...label, position: "absolute", left: 0, top: 0, zIndex: 6, pointerEvents: "none", padding: "6px 10px", background: "#e99704", color: "#0a0a09", opacity: 0, transition: "opacity .2s", whiteSpace: "nowrap" }} />
      </div>

      {lb && (
        <div onClick={() => setLb(null)} className="lb-grid" style={{ position: "fixed", inset: 0, zIndex: 210, background: "var(--a-bg)", display: "grid", gridTemplateColumns: "1fr minmax(0,1.6fr)", gap: "clamp(20px,4vw,40px)", padding: "80px var(--gx) var(--gx)", boxSizing: "border-box", cursor: "zoom-out" }}>
          <div style={{ ...label, fontSize: 12, display: "flex", flexDirection: "column", justifyContent: "space-between", color: "#8a857b" }}>
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              <span style={{ color: "#e99704" }}>{lb.id} — {lb.type}</span>
              <span className="display" style={{ fontSize: "clamp(30px,5vw,88px)", lineHeight: 0.88, color: "var(--a-ink)" }}>{lb.title}</span>
            </div>
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}><span>{lb.tag}, {lb.year}</span><span>Click anywhere to close</span></div>
          </div>
          <div style={{ ...label, fontSize: 12, position: "relative", maxHeight: "var(--lb-h)", width: `min(100%, calc(var(--lb-h) * (${lb.ar})))`, aspectRatio: lb.ar, justifySelf: "end", background: hatch(lb.c), outline: "1px solid rgb(var(--a-rgb) / .08)", display: "grid", placeItems: "center", color: "#6f6a60", overflow: "hidden" }}>
            {/* eslint-disable-next-line @next/next/no-img-element -- static webp */}
            <img src={lb.src} alt={lb.title} style={{ width: "100%", height: "100%", objectFit: "cover", display: "block" }} />
          </div>
        </div>
      )}
    </div>
  );
}
