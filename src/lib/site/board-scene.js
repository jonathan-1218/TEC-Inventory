// 3D PCB → chip → die → transistor fly-through, ported verbatim from design/index.html (three r128).
// `p` is hero scroll progress 0..1, (mx, my) the pointer offset, `now` seconds since mount.
import * as T from "three";

export function initBoard(box, fonts) {
  const MONO = fonts.mono, DISPLAY = fonts.display;
    const W = () => box.clientWidth, H = () => box.clientHeight;
    const r = new T.WebGLRenderer({ antialias: true, alpha: true }); r.setPixelRatio(Math.min(2, devicePixelRatio)); r.setSize(W(), H()); r.setClearColor(0x000000, 0);
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; box.appendChild(r.domElement);
    const sc = new T.Scene(); sc.fog = new T.Fog(0x0e0d0b, 26, 75);
    const cam = new T.PerspectiveCamera(45, W() / H(), .1, 200);
    sc.add(new T.HemisphereLight(0xf2f0ea, 0x14130f, .7));
    const key = new T.PointLight(0xe99704, 1.2, 40); key.position.set(0, 8, 0); sc.add(key);
    const dl = new T.DirectionalLight(0xffffff, .7); dl.position.set(-6, 12, 8); sc.add(dl);
    let seed = 11; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const SC = 4096 / 60, X = (x) => (x + 30) * SC, Z = (z) => (z + 17) * SC;
    const cv = document.createElement('canvas'); cv.width = 4096; cv.height = 2322; const c = cv.getContext('2d');
    c.fillStyle = '#10100e'; c.fillRect(0, 0, 4096, 2322); c.lineWidth = 1;
    for (let x = -30; x <= 30; x++) { c.strokeStyle = x % 5 ? 'rgba(242,240,234,.03)' : 'rgba(242,240,234,.07)'; c.beginPath(); c.moveTo(X(x), 0); c.lineTo(X(x), 2322); c.stroke(); }
    for (let z = -17; z <= 17; z++) { c.strokeStyle = z % 5 ? 'rgba(242,240,234,.03)' : 'rgba(242,240,234,.07)'; c.beginPath(); c.moveTo(0, Z(z)); c.lineTo(4096, Z(z)); c.stroke(); }
    const OR = '233,151,4', PA = '242,240,234';
    const hatch = (x0, z0, x1, z1) => { c.save(); c.beginPath(); c.rect(X(x0), Z(z0), (x1 - x0) * SC, (z1 - z0) * SC); c.clip(); c.strokeStyle = 'rgba(' + PA + ',.05)'; c.lineWidth = 2; for (let k = -2400; k < 4200; k += 16) { c.beginPath(); c.moveTo(X(x0) + k, Z(z0)); c.lineTo(X(x0) + k + 2400, Z(z0) + 2400); c.stroke(); } c.restore(); c.strokeStyle = 'rgba(' + PA + ',.12)'; c.lineWidth = 2; c.strokeRect(X(x0), Z(z0), (x1 - x0) * SC, (z1 - z0) * SC); };
    hatch(-29, -16, -19, -8); hatch(19, 8, 29, 16); hatch(19, -16, 29, -9); hatch(-29, 9, -19, 16);
    const poly = (pts, w, col) => { c.strokeStyle = col; c.lineWidth = w; c.lineJoin = 'round'; c.lineCap = 'round'; c.beginPath(); pts.forEach((p, k) => k ? c.lineTo(X(p[0]), Z(p[1])) : c.moveTo(X(p[0]), Z(p[1]))); c.stroke(); };
    const dot = (x, z, r, col) => { c.fillStyle = col; c.beginPath(); c.arc(X(x), Z(z), r * SC, 0, 7); c.fill(); };
    const padc = (x, z, r, a) => { dot(x, z, r, 'rgba(' + OR + ',' + a + ')'); dot(x, z, r * .45, '#10100e'); };
    const txt = (s, x, z, sz, a, rot) => { c.save(); c.translate(X(x), Z(z)); c.rotate(rot || 0); c.fillStyle = 'rgba(' + PA + ',' + a + ')'; c.font = '500 ' + sz + 'px ' + MONO; c.textAlign = 'center'; c.fillText(s, 0, 0); c.restore(); };
    const D = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
    const out = (p) => Math.abs(p[0]) > 23 || Math.abs(p[1]) > 12.5, free = (p, m) => Math.abs(p[0]) > 5.5 + (m || 0) || Math.abs(p[1]) > 5.5 + (m || 0);
    const rp = () => { let p; do { p = [(rng() - .5) * 56, (rng() - .5) * 31]; } while (!free(p, 1)); return p; };
    // dim background routing
    for (let n = 0; n < 110; n++) { let p = rp(), d = Math.floor(rng() * 8); const pts = [p.slice()]; const ns = 2 + Math.floor(rng() * 3);
      for (let s = 0; s < ns; s++) { const v = D[d], m = Math.hypot(v[0], v[1]), L = 1.5 + rng() * 5; p = [p[0] + v[0] / m * L, p[1] + v[1] / m * L]; if (!free(p, .5) || Math.abs(p[0]) > 28.5 || Math.abs(p[1]) > 16) break; pts.push(p.slice()); d = (d + (rng() < .5 ? 1 : 7)) % 8; }
      if (pts.length < 2) continue; poly(pts, 4, 'rgba(' + OR + ',.3)'); padc(pts[0][0], pts[0][1], .13, .45); padc(pts[pts.length - 1][0], pts[pts.length - 1][1], .13, .45); }
    for (let n = 0; n < 90; n++) { const p = rp(), h = rng() < .5, w = h ? .55 : .3, hh = h ? .3 : .55; c.fillStyle = 'rgba(216,201,163,.5)'; c.fillRect(X(p[0] - w / 2), Z(p[1] - hh / 2), w * SC, hh * SC); c.fillStyle = 'rgba(' + OR + ',.8)'; c.fillRect(X(p[0] - w / 2), Z(p[1] - hh / 2), (h ? .13 : w) * SC, (h ? hh : .13) * SC); c.fillRect(X(p[0] + w / 2 - (h ? .13 : w)), Z(p[1] + hh / 2 - (h ? hh : .13)), (h ? .13 : w) * SC, (h ? hh : .13) * SC); if (n % 2) txt((n % 4 ? 'R' : 'C') + n, p[0], p[1] - .5, 20, .35); }
    for (let n = 0; n < 60; n++) { const p = rp(); padc(p[0], p[1], .17, .55); c.strokeStyle = 'rgba(' + OR + ',.5)'; c.lineWidth = 3; c.beginPath(); c.arc(X(p[0]), Z(p[1]), .26 * SC, 0, 7); c.stroke(); }
    [[-12, -15.2], [4, 15.2]].forEach(([hx, hz]) => { c.strokeStyle = 'rgba(' + PA + ',.35)'; c.lineWidth = 3; c.strokeRect(X(hx - .4), Z(hz - .7), 9.8 * SC, 1.4 * SC); for (let k = 0; k < 16; k++) { padc(hx + k * .6, hz - .3, .16, .8); padc(hx + k * .6, hz + .3, .16, .8); } txt('J' + (hx > 0 ? 2 : 1) + ' EXPANSION', hx + 4.5, hz + (hz < 0 ? -1.1 : 1.6), 24, .4); });
    [[-27.5, -14.5], [27.5, -14.5], [-27.5, 14.5], [27.5, 14.5]].forEach(([x, z]) => { dot(x, z, .55, 'rgba(' + PA + ',.18)'); dot(x, z, .3, '#10100e'); });
    // buses
    const lanes = [], ends = [];
    const offs = (pts, d) => pts.map((p, k) => { const a = pts[Math.max(0, k - 1)], b = pts[Math.min(pts.length - 1, k + 1)], p0 = k ? pts[k - 1] : p, p1 = k < pts.length - 1 ? pts[k + 1] : p;
      const n1 = k ? [-(p[1] - p0[1]), p[0] - p0[0]] : null, n2 = k < pts.length - 1 ? [-(p1[1] - p[1]), p1[0] - p[0]] : null, nn = (v) => { const m = Math.hypot(v[0], v[1]); return [v[0] / m, v[1] / m]; };
      const u1 = n1 ? nn(n1) : nn(n2), u2 = n2 ? nn(n2) : u1, dt = 1 + u1[0] * u2[0] + u1[1] * u2[1], s = d / Math.max(.6, dt); return [p[0] + (u1[0] + u2[0]) * s, p[1] + (u1[1] + u2[1]) * s]; });
    const buses = [];
    [{ o: [1, 0], d0: 0 }, { o: [0, 1], d0: 2 }, { o: [-1, 0], d0: 4 }, { o: [0, -1], d0: 6 }].forEach((sd) => {
      const [ox, oz] = sd.o, lx = -oz, lz = ox;
      for (let jb = 0; jb < 3; jb++) {
        const b = (jb * 5 + 2 - 7) * .4; let p = [ox * 3.3 + lx * b, oz * 3.3 + lz * b], d = sd.d0; const pts = [p.slice()];
        const stp = (L) => { const v = D[d], m = Math.hypot(v[0], v[1]); p = [p[0] + v[0] / m * L, p[1] + v[1] / m * L]; };
        stp(1.8 + rng() * 1.4); pts.push(p.slice());
        for (let s = 0; s < 4; s++) { let nd = (d + (rng() < .5 ? 1 : 7)) % 8; const df = Math.min((nd - sd.d0 + 8) % 8, (sd.d0 - nd + 8) % 8); if (df > 2) nd = (d + (((sd.d0 - d + 8) % 8) < 4 ? 1 : 7)) % 8; d = nd; stp(2.4 + rng() * 4.2); if (out(p)) { p = pts[pts.length - 1].slice(); break; } pts.push(p.slice()); }
        if (pts.length < 3) continue; buses.push({ pts, d });
      }
    });
    buses.forEach((bs, bi) => {
      const e = bs.pts[bs.pts.length - 1], q = bs.pts[bs.pts.length - 2], ang = Math.atan2(e[1] - q[1], e[0] - q[0]), ux = Math.cos(ang), uz = Math.sin(ang);
      c.save(); c.translate(X(e[0] + ux * .9), Z(e[1] + uz * .9)); c.rotate(ang); c.fillStyle = '#1b1a16'; c.fillRect(-.9 * SC, -1.5 * SC, 1.8 * SC, 3 * SC); c.strokeStyle = 'rgba(' + PA + ',.5)'; c.lineWidth = 3; c.strokeRect(-.9 * SC, -1.5 * SC, 1.8 * SC, 3 * SC);
      c.fillStyle = 'rgba(' + PA + ',.4)'; for (let k = 0; k < 8; k++) { const zz = (-1.4 + k * .4) * SC; c.fillRect(.9 * SC, zz - 5, .25 * SC, 10); c.fillRect(-1.15 * SC, zz - 5, .25 * SC, 10); }
      c.beginPath(); c.arc(-.6 * SC, -1.1 * SC, 9, 0, 7); c.fill(); c.restore(); txt('U' + (bi + 1), e[0] + ux * .9, e[1] + uz * .9 + .1, 28, .55, 0);
      for (let k = 0; k < 5; k++) { const L = offs(bs.pts, (k - 2) * .4); lanes.push(L); const col = k === 2 ? PA : OR;
        poly(L, 15, 'rgba(' + OR + ',.1)'); poly(L, 5.5, 'rgba(' + col + ',' + (k === 2 ? .55 : .92) + ')'); const t = L[L.length - 1]; padc(t[0], t[1], .15, .95);
        if (k % 2 === 0 && L.length > 3) padc((L[2][0] + L[3][0]) / 2, (L[2][1] + L[3][1]) / 2, .13, .8);
        if (k === 2 && bi % 2 === 0) ends.push(t); }
    });
    c.strokeStyle = 'rgba(' + PA + ',.4)'; c.lineWidth = 3; c.strokeRect(X(-4.3), Z(-4.3), 8.6 * SC, 8.6 * SC); txt('TEC-01  REV A  LICET', 0, 5.2, 30, .45); txt('INSPIRING THE NEXT', 0, -4.8, 24, .35);
    const tex = new T.CanvasTexture(cv); tex.anisotropy = r.capabilities.getMaxAnisotropy(); tex.encoding = T.sRGBEncoding;
    sc.add(new T.Mesh(new T.PlaneGeometry(60, 34).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: tex, emissiveMap: tex, emissive: 0xffffff, emissiveIntensity: .55, roughness: .9, metalness: .1 })));
    const ledM = new T.MeshStandardMaterial({ color: 0xe99704, emissive: 0xe99704, emissiveIntensity: 1.4 }), bandM = new T.MeshStandardMaterial({ color: 0x7a4200 }), dark = new T.MeshStandardMaterial({ color: 0x14130f, roughness: .5 });
    const lead = new T.MeshStandardMaterial({ color: 0xa39e94, metalness: .8, roughness: .4 });
    ends.slice(0, 8).forEach((e) => { const l = new T.Mesh(new T.SphereGeometry(.38, 20, 12, 0, Math.PI * 2, 0, Math.PI / 2), ledM); l.position.set(e[0], .1, e[1]); sc.add(l); const bs = new T.Mesh(new T.CylinderGeometry(.46, .46, .1, 20), bandM); bs.position.set(e[0], .05, e[1]); sc.add(bs); });
    for (let n = 0; n < 9; n++) { const p = rp(), cp = new T.Mesh(new T.CylinderGeometry(.42, .42, 1.1, 20), dark); cp.position.set(p[0], .55, p[1]); sc.add(cp); const tp = new T.Mesh(new T.CylinderGeometry(.43, .43, .04, 20), lead); tp.position.set(p[0], 1.1, p[1]); sc.add(tp); }
    const paths = lanes, lens = lanes.map((P) => { let t = 0; const cl = [0]; for (let k = 1; k < P.length; k++) { t += Math.hypot(P[k][0] - P[k - 1][0], P[k][1] - P[k - 1][1]); cl.push(t); } return { cl, tot: t }; });
    const m4 = new T.Matrix4();
    const NP = 90, pul = Array.from({ length: NP }, (_, i) => ({ pi: (i * 7) % paths.length, s: (i * .137) % 1, sp: .06 + (i % 5) * .02 }));
    const pg = new T.BufferGeometry(), pp = new Float32Array(NP * 3); pg.setAttribute('position', new T.BufferAttribute(pp, 3));
    sc.add(new T.Points(pg, new T.PointsMaterial({ color: 0xffd27a, size: .42, transparent: true, blending: T.AdditiveBlending, depthWrite: false })));
    // ---- chip package: molded QFP with draft angle, laser-marked top, gull-wing tin leads, contact shadow ----
    const chip = new T.Group(); sc.add(chip);
    const PKG = 1024, tc = document.createElement('canvas'); tc.width = tc.height = PKG; const t = tc.getContext('2d');
    t.fillStyle = '#17171a'; t.fillRect(0, 0, PKG, PKG);
    for (let i = 0; i < 26000; i++) { t.fillStyle = 'rgba(255,255,255,' + (rng() * .05) + ')'; t.fillRect(rng() * PKG, rng() * PKG, 2, 2); }   // mould-compound grain
    t.strokeStyle = 'rgba(233,230,220,.16)'; t.lineWidth = 3; t.beginPath(); t.moveTo(150, 56); t.lineTo(968, 56); t.lineTo(968, 968); t.lineTo(56, 968); t.lineTo(56, 150); t.closePath(); t.stroke();   // keep-out outline, chamfered at pin 1
    t.strokeStyle = 'rgba(233,230,220,.5)'; t.lineWidth = 4; t.beginPath(); t.arc(118, 118, 26, 0, 7); t.stroke(); t.fillStyle = 'rgba(233,230,220,.5)'; t.beginPath(); t.arc(118, 118, 8, 0, 7); t.fill();   // pin-1 mark
    const ink = '#e9e6dc';
    t.fillStyle = ink; t.font = '900 250px ' + DISPLAY; t.textAlign = 'center'; t.fillText('TEC', 512, 520);
    // the logo's pulse line, laser-etched in signal orange across the wordmark
    const px = (x) => 150 + (x - 24) / 983 * 724, pz = (y) => 330 + (y - 154) / 432 * 260;
    t.strokeStyle = '#e99704'; t.lineWidth = 12; t.lineJoin = t.lineCap = 'round'; t.beginPath();
    [[36, 365.5], [176, 365], [240.5, 541], [262.5, 225.5], [323.5, 451.5], [362, 313.5], [421, 480], [460.5, 361.5], [652, 361]].forEach(([x, y], k) => k ? t.lineTo(px(x), pz(y) + 120) : t.moveTo(px(x), pz(y) + 120)); t.stroke();
    t.fillStyle = ink; t.textAlign = 'left'; t.font = '500 34px ' + MONO;
    t.fillText('TEC-01', 110, 220); t.fillText('REV A', 110, 262);
    t.textAlign = 'center'; t.font = '500 30px ' + MONO; t.fillText('I N S P I R I N G   T H E   N E X T', 512, 700);
    t.fillStyle = 'rgba(233,230,220,.62)'; t.font = '500 26px ' + MONO; t.fillText('LICET  ·  CHENNAI  ·  DESIGNED IN-HOUSE', 512, 750);
    t.textAlign = 'left'; t.fillText('LOT 26W43', 110, 912); t.fillText('XX-0192-A', 110, 950);
    t.save(); t.translate(780, 740); const DM = 14, cell = 14; t.fillStyle = ink;    // data-matrix style block
    for (let i = 0; i < DM; i++) for (let j = 0; j < DM; j++) { const edge = i === 0 || j === DM - 1 ? true : (i === DM - 1 || j === 0) ? (i + j) % 2 === 0 : rng() < .5; if (edge) t.fillRect(i * cell, j * cell, cell - 2, cell - 2); }
    t.restore();
    const topTex = new T.CanvasTexture(tc); topTex.anisotropy = tex.anisotropy; topTex.encoding = T.sRGBEncoding;
    const top = new T.MeshStandardMaterial({ map: topTex, roughness: .55, metalness: .05, transparent: true });
    const side = new T.MeshStandardMaterial({ color: 0x151517, roughness: .65, metalness: .08, transparent: true });
    const shc = document.createElement('canvas'); shc.width = shc.height = 256; const sx = shc.getContext('2d'), sg = sx.createRadialGradient(128, 128, 60, 128, 128, 128);
    sg.addColorStop(0, 'rgba(0,0,0,.75)'); sg.addColorStop(1, 'rgba(0,0,0,0)'); sx.fillStyle = sg; sx.fillRect(0, 0, 256, 256);
    const shadow = new T.MeshBasicMaterial({ map: new T.CanvasTexture(shc), transparent: true, depthWrite: false });
    const skin = [top, side, shadow];
    const sh = new T.Mesh(new T.PlaneGeometry(8.4, 8.4).rotateX(-Math.PI / 2), shadow); sh.position.y = .012; chip.add(sh);
    const R = (h) => h * Math.SQRT2;   // half-side -> radius of a 4-sided cylinder
    const body = new T.Mesh(new T.CylinderGeometry(R(2.62), R(2.86), .62, 4, 1, true).rotateY(Math.PI / 4), side); body.position.y = .39; chip.add(body);
    const skirt = new T.Mesh(new T.BoxGeometry(5.74, .06, 5.74), side); skirt.position.y = .1; chip.add(skirt);
    const lid = new T.Mesh(new T.PlaneGeometry(5.24, 5.24).rotateX(-Math.PI / 2), top); lid.position.y = .701; chip.add(lid);
    // gull-wing leads: shoulder out of the body, riser, foot soldered to the pad
    const tin = new T.MeshStandardMaterial({ color: 0xd6d8db, metalness: .95, roughness: .26 });
    const leadPart = (geo, cx, y) => { const im = new T.InstancedMesh(geo, tin, 60); let n = 0;
      for (let a = 0; a < 4; a++) for (let i = -7; i <= 7; i++) { m4.makeTranslation(cx, y, i * .4).premultiply(new T.Matrix4().makeRotationY(a * Math.PI / 2)); im.setMatrixAt(n++, m4); }
      chip.add(im); };
    leadPart(new T.BoxGeometry(.46, .04, .12), 3.03, .27); leadPart(new T.BoxGeometry(.04, .27, .12), 3.24, .15); leadPart(new T.BoxGeometry(.52, .035, .13), 3.48, .02);
    // 0402-style decoupling caps around the package
    const mlcc = new T.MeshStandardMaterial({ color: 0x6b5a3c, roughness: .7 }), endc = new T.MeshStandardMaterial({ color: 0xcfd2d6, metalness: .9, roughness: .3 });
    [[-4.3, -3.9, 0], [-4.3, -3.4, 0], [4.3, 3.9, 0], [4.3, 3.4, 0], [3.9, -4.4, 1], [3.4, -4.4, 1], [-3.9, 4.4, 1], [-3.4, 4.4, 1]].forEach(([x, z, r]) => { const c = new T.Group();
      c.add(new T.Mesh(new T.BoxGeometry(.3, .14, .18), mlcc)); [-.14, .14].forEach((o) => { const e = new T.Mesh(new T.BoxGeometry(.07, .15, .19), endc); e.position.x = o; c.add(e); });
      c.position.set(x, .08, z); c.rotation.y = r * Math.PI / 2; sc.add(c); });
    // chip interior: die, bond wires, metal stack, FinFET array
    const inner = new T.Group(); inner.visible = false; sc.add(inner);
    const dc = document.createElement('canvas'); dc.width = dc.height = 2048; const g = dc.getContext('2d');
    g.fillStyle = '#16150f'; g.fillRect(0, 0, 2048, 2048);
    for (let y = 40; y < 2008; y += 22) { let x = 40; while (x < 2008) { const w = 8 + rng() * 46; g.fillStyle = rng() < .5 ? 'rgba(233,151,4,' + (.18 + rng() * .3) + ')' : 'rgba(216,201,163,' + (.08 + rng() * .18) + ')'; g.fillRect(x, y + 3, w - 3, 15); if (rng() < .4) { g.fillStyle = 'rgba(242,240,234,.35)'; g.fillRect(x + w / 2 - 1, y, 2, 22); } x += w; } g.fillStyle = 'rgba(242,240,234,.1)'; g.fillRect(40, y, 1968, 2); }
    [[300, 300, 520, 380], [1220, 260, 520, 520], [260, 1300, 640, 460], [1200, 1260, 560, 520]].forEach(([x, y, w, hh]) => { g.fillStyle = '#100f0c'; g.fillRect(x, y, w, hh); g.strokeStyle = 'rgba(233,151,4,.6)'; g.lineWidth = 3; g.strokeRect(x, y, w, hh); for (let i = 0; i < w; i += 10) for (let j = 0; j < hh; j += 10) { g.fillStyle = 'rgba(233,151,4,' + (rng() * .5) + ')'; g.fillRect(x + i + 2, y + j + 2, 6, 6); } });
    g.strokeStyle = 'rgba(242,240,234,.5)'; g.lineWidth = 4; g.strokeRect(20, 20, 2008, 2008);
    for (let i = 0; i < 30; i++) { const o = 70 + i * 63; [[o, 34], [o, 2014], [34, o], [2014, o]].forEach(([x, y]) => { g.fillStyle = 'rgba(233,151,4,.9)'; g.fillRect(x - 12, y - 12, 24, 24); }); }
    g.fillStyle = 'rgba(242,240,234,.5)'; g.font = '500 36px ' + MONO; g.fillText('TEC-01 DIE  28NM', 80, 1990);
    const dtex = new T.CanvasTexture(dc); dtex.anisotropy = tex.anisotropy;
    const die = new T.Mesh(new T.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2), new T.MeshStandardMaterial({ map: dtex, emissiveMap: dtex, emissive: 0xffffff, emissiveIntensity: .6, roughness: .4, metalness: .3 })); die.position.y = .25; inner.add(die);
    const dieEdge = new T.Mesh(new T.BoxGeometry(4.66, .08, 4.66), new T.MeshStandardMaterial({ color: 0x2a2a2e, metalness: .7, roughness: .25 })); dieEdge.position.y = .205; inner.add(dieEdge);
    const sub = new T.Mesh(new T.BoxGeometry(5.9, .06, 5.9), new T.MeshStandardMaterial({ color: 0x3b2a12, roughness: .7 })); sub.position.y = .14; inner.add(sub);
    const rim = new T.PointLight(0xfff4e0, 0, 7); rim.position.set(-2.5, 1.6, 2.5); inner.add(rim);
    const wp = []; for (let i = 0; i < 30; i++) { const o = -2.3 + (70 + i * 63) / 2048 * 4.6; if (i % 2) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([sx, sz]) => { const a = sx ? new T.Vector3(sx * 2.25, .26, o) : new T.Vector3(o, .26, sz * 2.25), b = sx ? new T.Vector3(sx * 3.05, .2, o * 1.3) : new T.Vector3(o * 1.3, .2, sz * 3.05), m = a.clone().lerp(b, .4); m.y = .62;
        const pts = new T.QuadraticBezierCurve3(a, m, b).getPoints(12); for (let k = 1; k < pts.length; k++) wp.push(pts[k - 1], pts[k]); }); }
    inner.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(wp), new T.LineBasicMaterial({ color: 0xd9a441 })));
    // ---- FinFET array: STI, tapered silicon fins, N/P epitaxial source-drain, spacer + metal gates, W contacts, Cu M1-M3 ----
    const NG = 48, SP = .042, HW = NG * SP / 2, Y0 = .25;
    const tgp = new T.Group(); inner.add(tgp);
    const inst = (geo, mat, cnt, f) => { const im = new T.InstancedMesh(geo, mat, cnt); for (let i = 0; i < cnt; i++) { f(i); im.setMatrixAt(i, m4); } tgp.add(im); return im; };
    const finM = new T.MeshStandardMaterial({ color: 0xa9bbd0, roughness: .28, metalness: .6, emissive: 0x0d1624 });
    const gateM = new T.MeshStandardMaterial({ color: 0xc97d00, emissive: 0xe99704, emissiveIntensity: .12, roughness: .35, metalness: .6 });
    const cu = new T.MeshStandardMaterial({ color: 0xb87333, metalness: .9, roughness: .3, emissive: 0x2a1405 });
    const cuHi = new T.MeshStandardMaterial({ color: 0xd99a55, metalness: .92, roughness: .24, emissive: 0x3a2108 });
    const stiM = new T.MeshStandardMaterial({ color: 0x1b1d23, roughness: .75, metalness: .1 });
    const spacerM = new T.MeshStandardMaterial({ color: 0x2c2f37, roughness: .6, metalness: .2 });
    const epiN = new T.MeshStandardMaterial({ color: 0x5f8fcf, roughness: .32, metalness: .55, emissive: 0x0b1a33 });
    const epiP = new T.MeshStandardMaterial({ color: 0xd9822b, roughness: .32, metalness: .55, emissive: 0x2e1204 });
    const wM = new T.MeshStandardMaterial({ color: 0x9aa1ab, roughness: .3, metalness: .95 });
    const gx = (i) => -HW + (i + .5) * SP, fz = (i) => -HW + (i + .5) * SP;   // gate column / fin row positions
    // shallow-trench-isolation slab the fins stand in
    const stiSlab = new T.Mesh(new T.BoxGeometry(HW * 2.02, .006, HW * 2.02), stiM); stiSlab.position.set(0, Y0 + .003, 0); tgp.add(stiSlab);
    // fins: tapered trapezoid section, extruded along x
    const fs = new T.Shape(); fs.moveTo(-.0055, 0); fs.lineTo(.0055, 0); fs.lineTo(.0034, .02); fs.lineTo(-.0034, .02); fs.closePath();
    const finG = new T.ExtrudeGeometry(fs, { depth: HW * 2, bevelEnabled: false }).rotateY(-Math.PI / 2).translate(HW, 0, 0);
    inst(finG, finM, NG, (i) => m4.makeTranslation(0, Y0 + .005, fz(i)));
    // faceted epitaxial source/drain blocks between gates; N rows blue, P rows copper
    const epiG = new T.OctahedronGeometry(1, 0).scale(.0145, .0105, .0115);
    [[epiN, 0], [epiP, 1]].forEach(([mat, par]) => { const rows = Array.from({ length: NG }, (_, i) => i).filter((i) => i % 2 === par);
      inst(epiG, mat, rows.length * NG, (k) => m4.makeTranslation(gx(k % NG) + SP / 2, Y0 + .016, fz(rows[Math.floor(k / NG)]))); });
    // gates: dark spacer shell, orange metal core, split into cells along z
    const NSEG = 4, GAP = .03, SL = (HW * 2) / NSEG - GAP;
    inst(new T.BoxGeometry(.018, .028, SL), spacerM, NG * NSEG, (k) => m4.makeTranslation(gx(Math.floor(k / NSEG)), Y0 + .017, -HW + (k % NSEG + .5) * (HW * 2 / NSEG)));
    inst(new T.BoxGeometry(.01, .031, SL), gateM, NG * NSEG, (k) => m4.makeTranslation(gx(Math.floor(k / NSEG)), Y0 + .0185, -HW + (k % NSEG + .5) * (HW * 2 / NSEG)));
    // tungsten contacts land on most source/drain blocks
    const contacts = []; for (let c = 0; c < NG; c++) for (let r = 0; r < NG; r++) if (rng() < .7) contacts.push([gx(c) + SP / 2, fz(r)]);
    inst(new T.CylinderGeometry(.003, .0036, .02, 8), wM, contacts.length, (k) => m4.makeTranslation(contacts[k][0], Y0 + .03, contacts[k][1]));
    // copper stack: M1 (along z) -> V1 -> M2 (along x) -> V2 -> M3 (along z, thick). Cut away over the focus window so the transistors show.
    const FX = .4, FZ0 = -.5, FZ1 = .65, EXT = HW * 1.08, unit = new T.BoxGeometry(1, 1, 1), q0 = new T.Quaternion();
    const inFocus = (x, z) => Math.abs(x) < FX && z > FZ0 && z < FZ1;
    const bars = (mat, list) => { const im = new T.InstancedMesh(unit, mat, list.length);
      list.forEach(([x, y, z, sx, sy, sz], k) => { m4.compose(new T.Vector3(x, y, z), q0, new T.Vector3(sx, sy, sz)); im.setMatrixAt(k, m4); }); tgp.add(im); };
    const alongZ = (x, y, w, h) => [[x, y, (-EXT + FZ0) / 2, w, h, FZ0 + EXT], [x, y, (FZ1 + EXT) / 2, w, h, EXT - FZ1]];
    const m1 = []; for (let i = 0; i < NG; i++) m1.push(...alongZ(gx(i) + SP / 2, Y0 + .041, .01, .007));
    bars(cu, m1);
    const v1 = []; for (let n = 0; n < 700 && v1.length < 220; n++) { const p = [gx(Math.floor(rng() * NG)) + SP / 2, fz(Math.floor(rng() * NG))]; if (!inFocus(p[0], p[1])) v1.push(p); }
    inst(new T.CylinderGeometry(.0036, .0036, .03, 8), cu, v1.length, (k) => m4.makeTranslation(v1[k][0], Y0 + .056, v1[k][1]));
    const m2 = []; for (let i = 0; i < 24; i++) { const z = fz(i * 2) + SP / 2;
      if (z > FZ0 && z < FZ1) m2.push([(-EXT - FX) / 2, Y0 + .07, z, EXT - FX, .008, .012], [(EXT + FX) / 2, Y0 + .07, z, EXT - FX, .008, .012]); else m2.push([0, Y0 + .07, z, EXT * 2, .008, .012]); }
    bars(cuHi, m2);
    const v2 = []; for (let n = 0; n < 400 && v2.length < 36; n++) { const p = [-HW + (Math.floor(rng() * 12) + .5) * SP * 4, fz(Math.floor(rng() * 24) * 2) + SP / 2]; if (!inFocus(p[0], p[1])) v2.push(p); }
    inst(new T.CylinderGeometry(.005, .005, .035, 8), cuHi, v2.length, (k) => m4.makeTranslation(v2[k][0], Y0 + .0875, v2[k][1]));
    const m3 = []; for (let i = 0; i < 12; i++) m3.push(...alongZ(-HW + (i + .5) * SP * 4, Y0 + .105, .03, .012));
    bars(cuHi, m3);
    // carriers flowing along the fins; they only run while the transistor is switched on
    const NE = 220, eg = new T.BufferGeometry(), ep = new Float32Array(NE * 3); eg.setAttribute('position', new T.BufferAttribute(ep, 3));
    const el = Array.from({ length: NE }, () => ({ f: Math.floor(rng() * NG), s: rng(), sp: .1 + rng() * .25 }));
    const eMat = new T.PointsMaterial({ color: 0xffd27a, size: .0085, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    inner.add(new T.Points(eg, eMat)); let onL = 0;
        const pm = new T.PMREMGenerator(r), es = new T.Scene(); es.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x0b0a09, side: T.BackSide })));
    [[0, 12, 0, 16, 1, 16, 0xf2f0ea, 2.2], [-12, 4, 0, 1, 8, 20, 0xe99704, 1.6], [12, 6, 4, 1, 6, 10, 0x9fb4ff, 1.1], [0, 4, -12, 18, 5, 1, 0xf2f0ea, .9]].forEach(([x, y, z, w, hh, d, col, k]) => { const m = new T.Mesh(new T.BoxGeometry(w, hh, d), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k) })); m.position.set(x, y, z); es.add(m); });
    const env = pm.fromScene(es, .04).texture; [finM, gateM, cu, cuHi, stiM, spacerM, epiN, epiP, wM, lead, tin, mlcc, endc, top, side].forEach((m) => { m.envMap = env; m.envMapIntensity = .9; m.needsUpdate = true; }); top.envMapIntensity = .3; side.envMapIntensity = .4;
    const dimg = new Image(); dimg.onload = () => { const N = 4096, cc = document.createElement('canvas'); cc.width = cc.height = N; const x = cc.getContext('2d');
      x.imageSmoothingQuality = 'high'; x.filter = 'contrast(1.25) saturate(.8) brightness(.9)'; x.drawImage(dimg, 0, 0, N, N); x.filter = 'none';
      x.globalCompositeOperation = 'overlay'; x.globalAlpha = .55; x.drawImage(dc, 0, 0, N, N); x.globalAlpha = .25; x.drawImage(dc, 0, 0, N / 2, N / 2); x.drawImage(dc, N / 2, 0, N / 2, N / 2); x.drawImage(dc, 0, N / 2, N / 2, N / 2); x.drawImage(dc, N / 2, N / 2, N / 2, N / 2);
      x.globalCompositeOperation = 'source-over'; x.globalAlpha = 1;
      const vg = x.createRadialGradient(N / 2, N / 2, N * .2, N / 2, N / 2, N * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.35)'); x.fillStyle = vg; x.fillRect(0, 0, N, N);
      const bc = document.createElement('canvas'); bc.width = bc.height = 2048; const bx = bc.getContext('2d'); bx.filter = 'grayscale(1) contrast(1.8)'; bx.drawImage(cc, 0, 0, 2048, 2048);
      const rc = document.createElement('canvas'); rc.width = rc.height = 1024; const rx = rc.getContext('2d'); rx.filter = 'grayscale(1) invert(1) contrast(1.4) brightness(.8)'; rx.drawImage(cc, 0, 0, 1024, 1024);
      const mk = (cv, srgb) => { const t = new T.CanvasTexture(cv); t.anisotropy = tex.anisotropy; if (srgb) t.encoding = T.sRGBEncoding; return t; }, im = mk(cc, true);
      Object.assign(die.material, { map: im, emissiveMap: im, emissiveIntensity: .12, bumpMap: mk(bc), bumpScale: .012, roughnessMap: mk(rc), roughness: .55, metalness: .75, envMap: env, envMapIntensity: 1.3 }); die.material.needsUpdate = true; };
    dimg.src = '/site/die.png';
    const glow = new T.PointLight(0xe99704, 0, 3); glow.position.set(0, .7, 0); inner.add(glow);
    const K = [{ pos: [0, 34, 8], tg: [0, 0, 0] }, { pos: [13, 10, 14], tg: [0, 0, 0] }, { pos: [0, 5, 3.2], tg: [0, .4, 0] }, { pos: [.05, 2.9, .9], tg: [0, .25, 0] }, { pos: [.1, .345, .52], tg: [0, .283, -.06] }], KB = [0, .28, .52, .74, 1];
    const ss = (x) => x * x * (3 - 2 * x), lr = (a, b, k) => a + (b - a) * k; let lastT = 0;
    const onResize = () => { r.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }; window.addEventListener('resize', onResize);
    return { dispose: () => { window.removeEventListener('resize', onResize); r.dispose(); r.domElement.remove(); }, update: (p, mx, my, now) => {
      const dt = Math.min(.05, now - lastT); lastT = now;
      let s = 0; while (s < K.length - 2 && p > KB[s + 1]) s++;
      const k = ss(Math.max(0, Math.min(1, (p - KB[s]) / (KB[s + 1] - KB[s])))), A = K[s], B = K[s + 1];
      const cy = lr(A.pos[1], B.pos[1], k), pf = Math.min(1, cy / 10);
      cam.position.set(lr(A.pos[0], B.pos[0], k) + mx * 2.5 * pf, cy - my * 1.2 * pf, lr(A.pos[2], B.pos[2], k));
      cam.lookAt(lr(A.tg[0], B.tg[0], k), lr(A.tg[1], B.tg[1], k), lr(A.tg[2], B.tg[2], k));
      const nr = cy < 2 ? .004 : .1; if (cam.near !== nr) { cam.near = nr; cam.updateProjectionMatrix(); }
      const op = 1 - ss(Math.max(0, Math.min(1, (4.4 - cy) / 1.4))); skin.forEach((m) => { m.opacity = op; m.depthWrite = m === shadow ? false : op > .98; });
      inner.visible = op < .999; rim.intensity = (1 - op) * 2.2; { const sw = Math.max(0, Math.min(1, (p - .5) / .3)); rim.position.set(lr(-3.2, 3.2, sw), 1.2, lr(2.6, -1, sw)); }
      const gr = ss(Math.max(0, Math.min(1, (1.6 - cy) / 1.1))); tgp.scale.set(1, Math.max(.001, gr), 1); tgp.position.y = Y0 * (1 - gr); tgp.visible = gr > .01; glow.intensity = (1 - op) * 1.6; key.intensity = 1.2 + ss(p) * 1.6;
      onL += ((Math.sin(now * 1.2) > 0 ? 1 : 0) - onL) * Math.min(1, dt * 4); gateM.emissiveIntensity = .1 + onL * .75; eMat.opacity = .12 + .88 * onL;   // ON / OFF
      el.forEach((u, i) => { u.s += u.sp * dt * (.15 + onL * .9); if (u.s > 1) u.s = 0; ep[i * 3] = -HW + u.s * HW * 2; ep[i * 3 + 1] = Y0 + .0285; ep[i * 3 + 2] = -HW + (u.f + .5) * SP; });
      eg.attributes.position.needsUpdate = true;
      pul.forEach((u, i) => { u.s += u.sp * dt; if (u.s > 1) u.s = 0;
        const P = paths[u.pi], L = lens[u.pi], d = u.s * L.tot; let j = 1; while (j < L.cl.length - 1 && L.cl[j] < d) j++;
        const f = (d - L.cl[j - 1]) / Math.max(.001, L.cl[j] - L.cl[j - 1]);
        pp[i * 3] = lr(P[j - 1][0], P[j][0], f); pp[i * 3 + 1] = .14; pp[i * 3 + 2] = lr(P[j - 1][1], P[j][1], f); });
      pg.attributes.position.needsUpdate = true; r.render(sc, cam);
    } };
}
