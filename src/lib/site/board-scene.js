// 3D PCB → chip → die → transistor fly-through, ported verbatim from design/index.html (three r128).
// `p` is hero scroll progress 0..1, (mx, my) the pointer offset, `now` seconds since mount.
import * as T from "three";

// WebGL drawn by the CPU (no usable GPU, or blocklisted drivers): treat as low power.
function softwareGL() {
  try { const gl = document.createElement('canvas').getContext('webgl'), ext = gl && gl.getExtension('WEBGL_debug_renderer_info');
    return !gl || (!!ext && /swiftshader|llvmpipe|software|basic render/i.test(gl.getParameter(ext.UNMASKED_RENDERER_WEBGL))); } catch { return true; }
}

export function initBoard(box, fonts) {
  const MONO = fonts.mono, DISPLAY = fonts.display;
    const phone = matchMedia("(max-width: 600px)").matches;
    // Low-power tier: phones, small machines, Save-Data, or software WebGL. Halves every texture, skips the costly
    // material effects and the finest copper layer, and renders at 30 fps.
    const lowPower = phone || (navigator.hardwareConcurrency || 8) <= 4 || (navigator.deviceMemory || 8) <= 4 || !!navigator.connection?.saveData || softwareGL();
    const W = () => box.clientWidth, H = () => box.clientHeight;
    const r = new T.WebGLRenderer({ antialias: !lowPower, alpha: true, powerPreference: "high-performance" }); let pr = Math.min(lowPower ? 1 : 2, devicePixelRatio); r.setPixelRatio(pr); r.setSize(W(), H()); r.setClearColor(0x000000, 0);
    r.domElement.style.cssText = 'position:absolute;inset:0;width:100%;height:100%'; box.appendChild(r.domElement);
    const sc = new T.Scene(); sc.fog = new T.Fog(0x0e0d0b, 26, 75);
    const cam = new T.PerspectiveCamera(45, W() / H(), .1, 200);
    sc.add(new T.HemisphereLight(0xf2f0ea, 0x14130f, .7));
    const key = new T.PointLight(0xe99704, 1.2, 40); key.position.set(0, 8, 0); sc.add(key);
    const dl = new T.DirectionalLight(0xffffff, .7); dl.position.set(-6, 12, 8); sc.add(dl);
    let seed = 11; const rng = () => { seed = (seed * 16807) % 2147483647; return seed / 2147483647; };
    const SC = 4096 / 60, X = (x) => (x + 30) * SC, Z = (z) => (z + 17) * SC;
    const BW = lowPower ? 2048 : 4096, cv = document.createElement('canvas'); cv.width = BW; cv.height = Math.round(2322 * BW / 4096); const c = cv.getContext('2d'); c.scale(BW / 4096, BW / 4096);
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
    // solder pads under every lead foot, joined to the bus traces that start at r = 3.3
    [[1, 0], [0, 1], [-1, 0], [0, -1]].forEach(([ox, oz]) => { for (let i = -7; i <= 7; i++) { const ax = ox * 3.5 - oz * i * .4, az = oz * 3.5 + ox * i * .4, w = ox ? .8 : .22, h = ox ? .22 : .8;
      c.fillStyle = 'rgba(' + OR + ',.95)'; c.fillRect(X(ax - w / 2), Z(az - h / 2), w * SC, h * SC); c.fillStyle = 'rgba(' + PA + ',.35)'; c.fillRect(X(ax - w / 2 + (ox ? .08 : 0)), Z(az - h / 2 + (oz ? .08 : 0)), (ox ? w - .16 : w) * SC, (oz ? h - .16 : h) * SC); } });
    c.strokeStyle = 'rgba(' + PA + ',.4)'; c.lineWidth = 3; c.strokeRect(X(-4.3), Z(-4.3), 8.6 * SC, 8.6 * SC); txt('TEC-01  REV A  LICET', 0, 5.2, 30, .45); txt('INSPIRING THE NEXT', 0, -4.8, 24, .35);
    const tex = new T.CanvasTexture(cv); tex.anisotropy = Math.min(lowPower ? 2 : 16, r.capabilities.getMaxAnisotropy()); tex.encoding = T.sRGBEncoding;
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
    const px = (x) => 150 + (x - 24) / 983 * 724, pz = (y) => 340 + (y - 225.5) / 315.5 * 180;   // pulse stays inside the wordmark band (y 340-520)
    t.strokeStyle = '#e99704'; t.lineWidth = 12; t.lineJoin = t.lineCap = 'round'; t.beginPath();
    [[36, 365.5], [176, 365], [240.5, 541], [262.5, 225.5], [323.5, 451.5], [362, 313.5], [421, 480], [460.5, 361.5], [652, 361]].forEach(([x, y], k) => k ? t.lineTo(px(x), pz(y)) : t.moveTo(px(x), pz(y))); t.stroke();
    t.fillStyle = ink; t.textAlign = 'left'; t.font = '500 34px ' + MONO;
    t.fillText('TEC-01', 110, 220); t.fillText('REV A', 110, 262);
    t.textAlign = 'center'; t.font = '500 30px ' + MONO; t.fillText('I N S P I R I N G   T H E   N E X T', 512, 650);
    t.fillStyle = 'rgba(233,230,220,.62)'; t.font = '500 26px ' + MONO; t.fillText('DESIGNED IN-HOUSE', 512, 710);
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
    const die = new T.Mesh(new T.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2), (lowPower ? new T.MeshStandardMaterial({ map: dtex, emissiveMap: dtex, emissive: 0xffffff, emissiveIntensity: .6, roughness: .4, metalness: .3 }) : new T.MeshPhysicalMaterial({ map: dtex, emissiveMap: dtex, emissive: 0xffffff, emissiveIntensity: .6, roughness: .4, metalness: .3, clearcoat: 1, clearcoatRoughness: .06 }))); die.position.y = .25; inner.add(die);
    const dieEdge = new T.Mesh(new T.BoxGeometry(4.66, .14, 4.66), new T.MeshStandardMaterial({ color: 0x1d1d22, metalness: .85, roughness: .18 })); dieEdge.position.y = .175; inner.add(dieEdge);
    // seal ring + bond pads: what makes a real die read as a die at a glance
    const padM = new T.MeshStandardMaterial({ color: 0xc9ccd2, metalness: 1, roughness: .32 }), ringM = new T.MeshStandardMaterial({ color: 0x8d8f96, metalness: 1, roughness: .25 });
    [[0, 2.27, 4.56, .03], [0, -2.27, 4.56, .03], [2.27, 0, .03, 4.56], [-2.27, 0, .03, 4.56]].forEach(([x, z, w, d]) => { const m = new T.Mesh(new T.BoxGeometry(w, .012, d), ringM); m.position.set(x, .256, z); inner.add(m); });
    { const pads = []; for (let i = 0; i < 30; i++) { const o = -2.3 + (70 + i * 63) / 2048 * 4.6; pads.push([o, 2.2], [o, -2.2], [2.2, o], [-2.2, o]); }
      const pim = new T.InstancedMesh(new T.BoxGeometry(.075, .014, .075), padM, pads.length); pads.forEach(([x, z], k) => pim.setMatrixAt(k, new T.Matrix4().makeTranslation(x, .257, z))); inner.add(pim); }
    const sub = new T.Mesh(new T.BoxGeometry(5.9, .06, 5.9), new T.MeshStandardMaterial({ color: 0x3b2a12, roughness: .7 })); sub.position.y = .14; inner.add(sub);
    const rim = new T.PointLight(0xfff4e0, 0, 7); rim.position.set(-2.5, 1.6, 2.5); inner.add(rim);
    const wp = []; for (let i = 0; i < 30; i++) { const o = -2.3 + (70 + i * 63) / 2048 * 4.6; if (i % 2) continue;
      [[1, 0], [-1, 0], [0, 1], [0, -1]].forEach(([sx, sz]) => { const a = sx ? new T.Vector3(sx * 2.25, .26, o) : new T.Vector3(o, .26, sz * 2.25), b = sx ? new T.Vector3(sx * 3.05, .2, o * 1.3) : new T.Vector3(o * 1.3, .2, sz * 3.05), m = a.clone().lerp(b, .4); m.y = .62;
        const pts = new T.QuadraticBezierCurve3(a, m, b).getPoints(12); for (let k = 1; k < pts.length; k++) wp.push(pts[k - 1], pts[k]); }); }
    inner.add(new T.LineSegments(new T.BufferGeometry().setFromPoints(wp), new T.LineBasicMaterial({ color: 0xd9a441 })));
    // ---- FinFET array, laid out like a real standard-cell row: fins in 3-fin devices, fin cuts every 8 gates,
    // merged faceted source/drain epi, trench contacts, gates cut per N/P pair. The camera lands on one "hero"
    // device in the middle, which is labelled and switches ON/OFF; the copper stack only rises behind it.
    const SP = .042, NG = 48, HW = NG * SP / 2, Y0 = .25;              // gate pitch / count / half width
    const FP = .014, FPG = 3, GPZ = .084, NGZ = Math.floor(HW * 2 / GPZ); // fin pitch, fins per device, device pitch
    const SEG = 8, SEG0 = 4;                                            // gates per fin segment, segment offset
    const tgp = new T.Group(); inner.add(tgp); const q1 = new T.Quaternion();
    const inst = (geo, mat, cnt, f) => { const im = new T.InstancedMesh(geo, mat, cnt); for (let i = 0; i < cnt; i++) { f(i); im.setMatrixAt(i, m4); } tgp.add(im); return im; };
    const finM = new T.MeshStandardMaterial({ color: 0xaeb9c6, roughness: .32, metalness: .55, emissive: 0x0b111a });
    const gateM = new T.MeshStandardMaterial({ color: 0xffffff, roughness: .55, metalness: .6 });
    const heroGateM = new T.MeshStandardMaterial({ color: 0x4a2c08, emissive: 0xff9a1a, emissiveIntensity: .05, roughness: .4, metalness: .5 });
    const cu = new T.MeshStandardMaterial({ color: 0xb87333, metalness: .9, roughness: .3, emissive: 0x2a1405 });
    const cuHi = new T.MeshStandardMaterial({ color: 0xd99a55, metalness: .92, roughness: .24, emissive: 0x3a2108 });
    const stiM = new T.MeshStandardMaterial({ color: 0x15171c, roughness: .8, metalness: .1 });
    const spacerM = new T.MeshStandardMaterial({ color: 0x2a2d34, roughness: .6, metalness: .2 });
    const epiN = new T.MeshStandardMaterial({ color: 0x6f8fb8, roughness: .35, metalness: .5, emissive: 0x2a64c8, emissiveIntensity: .04 });
    const epiP = new T.MeshStandardMaterial({ color: 0xb98a5e, roughness: .35, metalness: .5, emissive: 0xd9822b, emissiveIntensity: .04 });
    const heroEpi = new T.MeshStandardMaterial({ color: 0x8fb0dd, roughness: .3, metalness: .5, emissive: 0x3b7be0, emissiveIntensity: .1 });
    const wM = new T.MeshStandardMaterial({ color: 0xc4cad2, roughness: .25, metalness: .95 });
    const gx = (i) => -HW + (i + .5) * SP, dz = (j) => -HW + (j + .5) * GPZ, fz = (j, f) => dz(j) + (f - (FPG - 1) / 2) * FP;
    const segOf = (i) => Math.floor((i + SEG0) / SEG);
    const HG = NG / 2, HJ = Math.round((-.07 + HW) / GPZ - .5);         // hero gate / device, under the camera's final target
    const HX = gx(HG), HZ = dz(HJ);
    const stiSlab = new T.Mesh(new T.BoxGeometry(HW * 2.02, .006, HW * 2.02), stiM); stiSlab.position.y = Y0 + .003; tgp.add(stiSlab);
    // fins: tapered section, one mesh per fin segment (cut between segments)
    const fs = new T.Shape(); fs.moveTo(-.0034, 0); fs.lineTo(.0034, 0); fs.lineTo(.0022, .02); fs.quadraticCurveTo(0, .0215, -.0022, .02); fs.closePath();
    const finG = new T.ExtrudeGeometry(fs, { depth: 1, bevelEnabled: false, curveSegments: 3 }).rotateY(Math.PI / 2).translate(-.5, 0, 0);
    const segs = []; for (let a = 0; a * SEG - SEG0 < NG; a++) { const i0 = Math.max(0, a * SEG - SEG0), i1 = Math.min(NG - 1, a * SEG - SEG0 + SEG - 1); segs.push([gx(i0) - SP / 2 + .007, gx(i1) + SP / 2 - .007]); }
    const fins = []; for (let j = 0; j < NGZ; j++) for (let f = 0; f < FPG; f++) for (const [x0, x1] of segs) fins.push([x0, x1, fz(j, f)]);
    const sc1 = new T.Vector3();
    inst(finG, finM, fins.length, (k) => { const [x0, x1, z] = fins[k]; m4.compose(sc1.set((x0 + x1) / 2, Y0 + .005, z), q1, new T.Vector3(x1 - x0, 1, 1)); });
    // merged source/drain epi: flattened hexagon across the device's 3 fins, between neighbouring gates of a segment
    const hx = new T.Shape(); [[-.019, 0], [-.021, .007], [-.012, .016], [.012, .016], [.021, .007], [.019, 0]].forEach(([z, y], k) => k ? hx.lineTo(z, y) : hx.moveTo(z, y)); hx.closePath();
    const epiG = new T.ExtrudeGeometry(hx, { depth: .02, bevelEnabled: false }).translate(0, 0, -.01).rotateY(Math.PI / 2);
    const sd = []; for (let c = 0; c < NG - 1; c++) if (segOf(c) === segOf(c + 1)) for (let j = 0; j < NGZ; j++) sd.push([gx(c) + SP / 2, j]);
    const isHeroSD = ([x, j]) => j === HJ && Math.abs(Math.abs(x - HX) - SP / 2) < 1e-6;
    [[epiN, 0], [epiP, 1]].forEach(([mat, par]) => { const list = sd.filter((d) => d[1] % 2 === par && !isHeroSD(d));
      inst(epiG, mat, list.length, (k) => m4.makeTranslation(list[k][0], Y0 + .008, dz(list[k][1]))); });
    const heroSD = sd.filter(isHeroSD); inst(epiG, heroEpi, heroSD.length, (k) => m4.makeTranslation(heroSD[k][0], Y0 + .008, dz(heroSD[k][1])));
    // trench contacts: a tungsten bar along each epi block
    inst(new T.BoxGeometry(.006, .006, .03), wM, sd.length, (k) => m4.makeTranslation(sd[k][0], Y0 + .026, dz(sd[k][1])));
    // gates: low spacer walls with the metal gate rising out of them, cut per N/P device pair
    const GL = GPZ * 2 - .022, gcz = (p) => -HW + (p + .5) * GPZ * 2, NPAIR = Math.floor(NGZ / 2);
    inst(new T.BoxGeometry(.016, .022, GL), spacerM, NG * NPAIR, (k) => m4.makeTranslation(gx(Math.floor(k / NPAIR)), Y0 + .014, gcz(k % NPAIR)));
    const gateIM = inst(new T.BoxGeometry(.0095, .032, GL - .004), gateM, NG * NPAIR, (k) => m4.makeTranslation(gx(Math.floor(k / NPAIR)), Y0 + .019, gcz(k % NPAIR)));
    const HERO = HG * NPAIR + Math.floor(HJ / 2);
    m4.makeScale(0, 0, 0); gateIM.setMatrixAt(HERO, m4);
    const heroGate = new T.Mesh(new T.BoxGeometry(.0095, .032, GL - .004), heroGateM); heroGate.position.set(HX, Y0 + .019, gcz(Math.floor(HJ / 2))); tgp.add(heroGate);
    const dummy = (i) => segOf(i) !== segOf(i - 1) || segOf(i) !== segOf(i + 1);   // gates over a fin cut do nothing
    const gcol = new T.Color(); for (let k = 0; k < NG * NPAIR; k++) gateIM.setColorAt(k, gcol.setRGB(.5, .28, 0));
    // copper stack: only behind the hero device, so it reads as a skyline instead of a lid
    const ZB = -.5, EXT = HW * 1.04, unit = new T.BoxGeometry(1, 1, 1);
    const bars = (mat, list) => { const im = new T.InstancedMesh(unit, mat, list.length);
      list.forEach(([x, y, z, sx, sy, sz], k) => { m4.compose(new T.Vector3(x, y, z), q1, new T.Vector3(sx, sy, sz)); im.setMatrixAt(k, m4); }); tgp.add(im); };
        const m1 = []; for (let z = -HW + .007; z < ZB; z += FP * 2) m1.push([0, Y0 + .045, z, EXT * 2, .007, .007]); bars(cu, m1);
    const v1 = []; for (let i = 0; i < NG; i += 2) for (let z = -HW + .007; z < ZB; z += FP * 6) v1.push([gx(i) + SP / 2, z]);
    inst(new T.CylinderGeometry(.0032, .0032, .018, 8), cu, v1.length, (k) => m4.makeTranslation(v1[k][0], Y0 + .057, v1[k][1]));
    const m2 = []; for (let i = 0; i < NG; i++) m2.push([gx(i) + SP / 2, Y0 + .07, (-EXT + ZB) / 2, .011, .008, ZB + EXT]); bars(cuHi, m2);
    const v2 = []; for (let i = 0; i < NG; i += 4) for (let z = -HW + .03; z < ZB; z += .12) v2.push([gx(i) + SP / 2, z]);
    inst(new T.CylinderGeometry(.005, .005, .03, 8), cuHi, v2.length, (k) => m4.makeTranslation(v2[k][0], Y0 + .089, v2[k][1]));
    const m3 = []; for (let z = -HW + .03; z < ZB - .02; z += .12) m3.push([0, Y0 + .108, z, EXT * 2, .014, .034]); bars(cuHi, m3);
    // carriers: dense through the hero device's fins (source -> under the gate -> drain), sparse elsewhere
    const NE = 260, eg = new T.BufferGeometry(), ep = new Float32Array(NE * 3); eg.setAttribute('position', new T.BufferAttribute(ep, 3));
    const el = Array.from({ length: NE }, (_, i) => i < 90
      ? { x0: HX - SP * .75, x1: HX + SP * .75, z: fz(HJ, i % FPG), s: rng(), sp: .5 + rng() * .4 }
      : (() => { const fi = fins[Math.floor(rng() * fins.length)]; return { x0: fi[0], x1: fi[1], z: fi[2], s: rng(), sp: .08 + rng() * .12 }; })());
    const eMat = new T.PointsMaterial({ color: 0xffd27a, size: .0075, transparent: true, blending: T.AdditiveBlending, depthWrite: false });
    inner.add(new T.Points(eg, eMat)); let onL = 0;
    const chan = new T.PointLight(0xffb347, 0, .12); chan.position.set(HX, Y0 + .05, HZ); inner.add(chan);
    // labels: SOURCE / GATE / DRAIN with leader lines; GATE shows its state
    const tag = (s, col) => { const cv = document.createElement('canvas'); cv.width = 512; cv.height = 96; const x = cv.getContext('2d');
      x.font = '600 50px ' + MONO; const w = x.measureText(s).width + 56;
      x.fillStyle = 'rgba(14,13,11,.82)'; x.strokeStyle = col; x.lineWidth = 3; x.beginPath(); x.roundRect(256 - w / 2, 10, w, 76, 38); x.fill(); x.stroke();
      x.textAlign = 'center'; x.textBaseline = 'middle'; x.fillStyle = col; x.fillText(s, 256, 50);
      const t = new T.CanvasTexture(cv); t.encoding = T.sRGBEncoding; return t; };
    const labels = new T.Group(); inner.add(labels); const lblMats = [];
    const label = (tex, x, y, z) => { const m = new T.SpriteMaterial({ map: tex, transparent: true, depthTest: false, opacity: 0 }); lblMats.push(m);
      const sp = new T.Sprite(m); sp.scale.set(.05, .0094, 1); sp.position.set(x, y, z); sp.renderOrder = 10; labels.add(sp); return sp; };
    const LY = Y0 + .085, gateOn = tag('GATE · ON', '#e99704'), gateOff = tag('GATE · OFF', '#8a877e');
    label(tag('SOURCE', '#c9d6ea'), HX - SP / 2 - .02, LY - .012, HZ); label(tag('DRAIN', '#c9d6ea'), HX + SP / 2 + .02, LY - .012, HZ);
    const gateLbl = label(gateOff, HX, LY + .008, HZ);
    const leadM = new T.LineBasicMaterial({ color: 0xf2f0ea, transparent: true, opacity: 0, depthTest: false }); lblMats.push(leadM);
    const lp = [[HX - SP / 2 - .02, LY - .017, HX - SP / 2, Y0 + .03], [HX + SP / 2 + .02, LY - .017, HX + SP / 2, Y0 + .03], [HX, LY + .003, HX, Y0 + .04]]
      .flatMap(([ax, ay, bx, by]) => [new T.Vector3(ax, ay, HZ), new T.Vector3(bx, by, HZ)]);
    const leads = new T.LineSegments(new T.BufferGeometry().setFromPoints(lp), leadM); leads.renderOrder = 10; labels.add(leads);
        const pm = new T.PMREMGenerator(r), es = new T.Scene(); es.add(new T.Mesh(new T.BoxGeometry(30, 30, 30), new T.MeshBasicMaterial({ color: 0x0b0a09, side: T.BackSide })));
    [[0, 12, 0, 16, 1, 16, 0xf2f0ea, 2.2], [-12, 4, 0, 1, 8, 20, 0xe99704, 1.6], [12, 6, 4, 1, 6, 10, 0x9fb4ff, 1.1], [0, 4, -12, 18, 5, 1, 0xf2f0ea, .9]].forEach(([x, y, z, w, hh, d, col, k]) => { const m = new T.Mesh(new T.BoxGeometry(w, hh, d), new T.MeshBasicMaterial({ color: new T.Color(col).multiplyScalar(k) })); m.position.set(x, y, z); es.add(m); });
    const env = pm.fromScene(es, .04).texture; [finM, gateM, heroGateM, cu, cuHi, stiM, spacerM, epiN, epiP, heroEpi, wM, lead, tin, mlcc, endc, top, side].forEach((m) => { m.envMap = env; m.envMapIntensity = .9; m.needsUpdate = true; }); top.envMapIntensity = .3; side.envMapIntensity = .4; gateM.envMapIntensity = .25;
    // Interconnect stack over the whole die, like the real BEOL: the top layer is the die shot itself lifted off the
    // silicon, then copper lines get finer and denser layer by layer, alternating direction, each following the die's
    // own layout (lines only where the die shot has circuitry). The camera falls through it; each layer dissolves as it passes.
    const stack = [], DH = 2.25, STACK = [[1.6, 0], [1.3, .12], [1.04, .085], [.82, .06], [.62, .042]];
    const layerMat = () => new T.MeshStandardMaterial({ color: 0xffffff, metalness: .55, roughness: .3, transparent: true, opacity: 0, envMap: env, envMapIntensity: .7 });
    const buildStack = (lum, col, im, alpha) => {
      const m = new T.Matrix4(), q = new T.Quaternion();
      STACK.forEach(([y, pitch], li) => {
        if (lowPower && li === STACK.length - 1) return;
        const g = new T.Group(); g.visible = false; inner.add(g);
        if (!pitch) {   // top metal: the die shot's own structures, as a raised copper-tinted sheet with a darker underside
          const mat = new T.MeshStandardMaterial({ map: im, color: 0xffffff, alphaMap: alpha, alphaTest: .5, metalness: .7, roughness: .3, emissive: 0xffffff, emissiveMap: im, emissiveIntensity: .25, transparent: true, opacity: 0, side: T.DoubleSide, envMap: env, envMapIntensity: .8 });
          const geo = new T.PlaneGeometry(4.6, 4.6).rotateX(-Math.PI / 2), top = new T.Mesh(geo, mat), under = new T.Mesh(geo, mat.clone()); under.material.color.set(0x55506a); under.material.emissiveIntensity = .05; under.position.y = -.025;
          g.add(top, under); stack.push({ g, mats: [mat, under.material], y }); return;
        }
        const mat = layerMat(), alongX = li % 2 === 0, n = Math.floor(DH * 2 / pitch), seg = pitch * 4, lines = [];
        for (let i = 0; i < n; i++) { const o = -DH + (i + .5) * pitch; let run = null;
          for (let a = -DH; a < DH; a += seg) { const on = lum(alongX ? a + seg / 2 : o, alongX ? o : a + seg / 2) > .55 && rng() > .08;
            if (on) run = run ? [run[0], a + seg] : [a, a + seg];
            if ((!on || a + seg >= DH) && run) { const c = (run[0] + run[1]) / 2, len = run[1] - run[0] - pitch * .3; lines.push(alongX ? [c, o, len, pitch * .42] : [o, c, pitch * .42, len]); run = null; } } }
        const im2 = new T.InstancedMesh(unit, mat, lines.length);
        lines.forEach(([x, z, sx, sz], k) => { im2.setMatrixAt(k, m.compose(new T.Vector3(x, 0, z), q, new T.Vector3(sx, pitch * .32, sz))); im2.setColorAt(k, col(x, z)); });
        const vias = []; for (let k = 0; k < n * 6 && vias.length < n * 3; k++) { const x = (rng() * 2 - 1) * DH, z = (rng() * 2 - 1) * DH; if (lum(x, z) > .6) vias.push([x, z]); }
        const vh = li === STACK.length - 1 ? y - Y0 : .16, vim = new T.InstancedMesh(new T.CylinderGeometry(pitch * .12, pitch * .12, 1, 6), mat, vias.length);
        vias.forEach(([x, z], k) => { vim.setMatrixAt(k, m.compose(new T.Vector3(x, -vh / 2, z), q, new T.Vector3(1, vh, 1))); vim.setColorAt(k, col(x, z)); });
        g.add(im2, vim); stack.push({ g, mats: [mat], y });
      });
    };
    const dimg = new Image(); dimg.onload = () => { const N = lowPower ? 2048 : 4096, cc = document.createElement('canvas'); cc.width = cc.height = N; const x = cc.getContext('2d');
      // keep the die shot crisp: no muddying overlays, just a touch of contrast and a light edge falloff
      x.imageSmoothingQuality = 'high'; x.filter = 'none'; x.drawImage(dimg, 0, 0, N, N); x.filter = 'none';
      const vg = x.createRadialGradient(N / 2, N / 2, N * .35, N / 2, N / 2, N * .75); vg.addColorStop(0, 'rgba(0,0,0,0)'); vg.addColorStop(1, 'rgba(0,0,0,.18)'); x.fillStyle = vg; x.fillRect(0, 0, N, N);
      const bc = document.createElement('canvas'); bc.width = bc.height = 2048; const bx = bc.getContext('2d'); bx.filter = 'grayscale(1) contrast(1.8)'; bx.drawImage(cc, 0, 0, 2048, 2048);
      const rc = document.createElement('canvas'); rc.width = rc.height = 1024; const rx = rc.getContext('2d'); rx.filter = 'grayscale(1) invert(1) contrast(1.4) brightness(.8)'; rx.drawImage(cc, 0, 0, 1024, 1024);
      const mk = (cv, srgb) => { const t = new T.CanvasTexture(cv); t.anisotropy = r.capabilities.getMaxAnisotropy(); if (srgb) t.encoding = T.sRGBEncoding; return t; }, im = mk(cc, true);
      Object.assign(die.material, { map: im, emissiveMap: im, emissiveIntensity: .38, roughness: .35, metalness: .45, envMap: env, envMapIntensity: 1 }, lowPower ? {} : { bumpMap: mk(bc), bumpScale: .003, roughnessMap: mk(rc), clearcoat: .6 }); die.material.needsUpdate = true;
      // luminance grid of the die shot: drives where the copper lines run, and the top layer's cut-out
      const LG = 256, lc = document.createElement('canvas'); lc.width = lc.height = LG; const lx = lc.getContext('2d'); lx.filter = 'grayscale(1) contrast(1.6)'; lx.drawImage(dimg, 0, 0, LG, LG);
      const ld = lx.getImageData(0, 0, LG, LG).data, lum = (wx, wz) => { const px = Math.min(LG - 1, Math.max(0, Math.floor((wx + 2.3) / 4.6 * LG))), pz = Math.min(LG - 1, Math.max(0, Math.floor((wz + 2.3) / 4.6 * LG))); return ld[(pz * LG + px) * 4] / 255; };
      const kc = document.createElement('canvas'); kc.width = kc.height = LG; const kx = kc.getContext('2d'); kx.filter = 'saturate(1.25)'; kx.drawImage(dimg, 0, 0, LG, LG);
      const kd = kx.getImageData(0, 0, LG, LG).data, col = (wx, wz) => { const px = Math.min(LG - 1, Math.max(0, Math.floor((wx + 2.3) / 4.6 * LG))), pz = Math.min(LG - 1, Math.max(0, Math.floor((wz + 2.3) / 4.6 * LG))), o = (pz * LG + px) * 4;
        return new T.Color().setRGB(kd[o] / 255, kd[o + 1] / 255, kd[o + 2] / 255).convertSRGBToLinear(); };
      // cut-out for the top sheet: threshold at low res, then scale up without smoothing so edges stay square like real metal
      const sc0 = document.createElement('canvas'); sc0.width = sc0.height = 1024; const s0 = sc0.getContext('2d'); s0.filter = 'grayscale(1) contrast(2.2)'; s0.drawImage(dimg, 0, 0, 1024, 1024);
      const ac = document.createElement('canvas'); ac.width = ac.height = N / 2; const ax = ac.getContext('2d'); ax.imageSmoothingEnabled = false; ax.drawImage(sc0, 0, 0, N / 2, N / 2);
      const at = mk(ac); at.magFilter = T.NearestFilter; buildStack(lum, col, im, at); };
    dimg.src = lowPower ? '/site/die-md.webp' : '/site/die-hd.webp';   // generated by scripts/die_gen.py
    // the block of the die the camera dives into: an amber target frame
    const RS = .95;
    const secM = new T.LineBasicMaterial({ color: 0xe99704, transparent: true, opacity: 0, depthTest: false });
    const secF = new T.LineLoop(new T.BufferGeometry().setFromPoints([[-1, -1], [1, -1], [1, 1], [-1, 1]].map(([a, b]) => new T.Vector3(a, 0, b))), secM);
    secF.renderOrder = 9; secF.scale.set(RS, 1, RS); secF.position.set(HX, .262, HZ); inner.add(secF);
    const glow = new T.PointLight(0xe99704, 0, 3); glow.position.set(0, .7, 0); inner.add(glow);
    const K = [{ pos: [0, 34, 8], tg: [0, 0, 0] }, { pos: [13, 10, 14], tg: [0, 0, 0] }, { pos: [0, 5, 3.2], tg: [0, .4, 0] }, { pos: [.05, 2.9, .9], tg: [0, .25, 0] },
      // dive: straight down through the interconnect stack above the target block, then level out on the hero gate
      { pos: [HX + .08, 1.35, HZ + .3], tg: [HX - .02, .3, HZ - .05] }, { pos: [HX - .02, .43, HZ + .25], tg: [HX - .045, .265, HZ - .02] }], KB = [0, .28, .52, .72, .86, 1];
    // One centripetal spline through the keyframes: the camera keeps moving through each one instead of stopping dead.
    const camC = new T.CatmullRomCurve3(K.map((q) => new T.Vector3(...q.pos)), false, 'centripetal'), tgC = new T.CatmullRomCurve3(K.map((q) => new T.Vector3(...q.tg)), false, 'centripetal');
    const cp = new T.Vector3(), ct = new T.Vector3();
    const ss = (x) => x * x * (3 - 2 * x), lr = (a, b, k) => a + (b - a) * k; let lastT = 0, lastDraw = -1, slow = 0, frames = 0;
    const onResize = () => { r.setSize(W(), H()); cam.aspect = W() / H(); cam.updateProjectionMatrix(); }; window.addEventListener('resize', onResize);
    return { dispose: () => { window.removeEventListener('resize', onResize); r.dispose(); r.domElement.remove(); }, update: (p, mx, my, now) => {
      if (lowPower && now - lastDraw < 1 / 30) return;   // 30 fps is plenty for a scroll-driven scene on weak machines
      // Adaptive resolution: if frames keep running slow (> 40 ms, or > 60 ms at the 30 fps cap), drop the pixel ratio a notch (down to 0.6), once per second at most.
      if (lastDraw >= 0) { frames++; if (now - lastDraw > (lowPower ? .06 : .04)) slow++;
        if (frames >= 30) { if (slow > 18 && pr > .6) { pr = Math.max(.6, pr - .25); r.setPixelRatio(pr); r.setSize(W(), H()); } frames = slow = 0; } }
      lastDraw = now;
      const dt = Math.min(.05, now - lastT); lastT = now;
      let s = 0; while (s < K.length - 2 && p > KB[s + 1]) s++;
      let t = Math.max(0, Math.min(1, (p - KB[s]) / (KB[s + 1] - KB[s])));
      if (s === 0) t = t * t; else if (s === K.length - 2) t = 1 - (1 - t) * (1 - t);   // ease out of the board, settle on the gate
      const u = (s + t) / (K.length - 1); camC.getPoint(u, cp); tgC.getPoint(u, ct);
      const cy = cp.y, pf = Math.min(1, cy / 10);
      cam.position.set(cp.x + mx * 2.5 * pf, cy - my * 1.2 * pf, cp.z);
      cam.lookAt(ct);
      const nr = cy < 2 ? .004 : .1; if (cam.near !== nr) { cam.near = nr; cam.updateProjectionMatrix(); }
      const op = 1 - ss(Math.max(0, Math.min(1, (4.4 - cy) / 1.4))); skin.forEach((m) => { m.opacity = op; m.depthWrite = m === shadow ? false : op > .98; });
      inner.visible = op < .999; rim.intensity = (1 - op) * 2.2; { const sw = Math.max(0, Math.min(1, (p - .5) / .3)); rim.position.set(lr(-3.2, 3.2, sw), 1.2, lr(2.6, -1, sw)); }
      const gr = ss(Math.max(0, Math.min(1, (2.1 - cy) / 1.5)));   // the fins rise out of the die as the camera dives
      tgp.scale.set(1, Math.max(.001, gr), 1); tgp.position.y = Y0 * (1 - gr); tgp.visible = gr > .01;
      // target frame shows while the die fills the view, then the metal layers build up out of the block (bottom first),
      // and each one dissolves just before the camera reaches it
      const build = ss(Math.max(0, Math.min(1, (3.3 - cy) / 1.1)));
      secM.opacity = ss(Math.max(0, Math.min(1, (4.8 - cy) / 1.2))) * (1 - build) * (1 - op * .6); secF.visible = secM.opacity > .01;
      stack.forEach((L, i) => { const b = ss(Math.max(0, Math.min(1, build * 1.6 - (4 - i) * .15)));
        const pass = i ? ss(Math.max(0, Math.min(1, (cy - L.y - .04) / .3))) : ss(Math.max(0, Math.min(1, (cy - L.y - .4) / .45)));   // the die-shot sheet goes before it gets close enough to look soft
        const o = b * pass; L.mats.forEach((mt) => { mt.opacity = o; mt.depthWrite = o > .95; }); L.g.visible = o > .01; L.g.position.y = lr(Y0, L.y, b); });
      glow.intensity = (1 - op) * 1.6 * (1 - build);   // the stack sits right under this light: dim it while the copper is up key.intensity = 1.2 + ss(p) * 1.6;
      onL += ((Math.sin(now * 1.2) > 0 ? 1 : 0) - onL) * Math.min(1, dt * 5);
      const wave = (col) => .5 + .5 * Math.sin(now * 3 - col * .45);   // a soft clock edge sweeping across the other gates
      for (let k = 0; k < NG * NPAIR; k++) { const i = Math.floor(k / NPAIR);
        const v = dummy(i) ? .12 : .18 + .14 * wave(i) * onL; gateIM.setColorAt(k, gcol.setRGB(.95 * v, .52 * v, .02 * v)); }
      gateIM.instanceColor.needsUpdate = true;
      heroEpi.emissiveIntensity = .1 + .9 * onL; heroGateM.emissiveIntensity = .05 + 1.3 * onL; epiN.emissiveIntensity = epiP.emissiveIntensity = .04 + .12 * onL; eMat.opacity = .1 + .9 * onL; chan.intensity = onL * .9 * gr;
      el.forEach((u, i) => { u.s += u.sp * dt * (i < 90 ? .05 + onL : .2 + onL * .6); if (u.s > 1) u.s -= 1;
        ep[i * 3] = lr(u.x0, u.x1, u.s); ep[i * 3 + 1] = Y0 + .0275; ep[i * 3 + 2] = u.z; });
      eg.attributes.position.needsUpdate = true;
      { const lo = ss(Math.max(0, Math.min(1, (p - .88) / .1))) * gr; lblMats.forEach((m) => { m.opacity = m === leadM ? lo * .6 : lo; }); labels.visible = lo > .01;
        const want = onL > .5 ? gateOn : gateOff; if (gateLbl.material.map !== want) { gateLbl.material.map = want; gateLbl.material.needsUpdate = true; } }
      pg.attributes.position.needsUpdate = true; r.render(sc, cam);
    } };
}
