# Generates public/site/die-hd.webp: python3 scripts/die_gen.py public/site/die-hd.webp
"""Procedural SoC die shot, 4096 px, in the style of the reference (pastel wash, white structures)."""
import sys, random
import numpy as np
from PIL import Image, ImageDraw, ImageFilter

N = 4096
OUT = sys.argv[1]
R = random.Random(7)
m = np.full((N, N), 62, np.uint8)          # structure brightness map

def box(x0, y0, x1, y1, v):
    m[max(0, y0):max(0, y1), max(0, x0):max(0, x1)] = v

def frame(x0, y0, x1, y1, v, t):
    box(x0, y0, x1, y0 + t, v); box(x0, y1 - t, x1, y1, v); box(x0, y0, x0 + t, y1, v); box(x1 - t, y0, x1, y1, v)

def sram(x0, y0, x1, y1):
    h, w = y1 - y0, x1 - x0
    if h < 8 or w < 8: return
    yy, xx = np.mgrid[0:h, 0:w]
    cell = (((xx % 6) < 4) & ((yy % 5) < 3)).astype(np.uint8)
    blk = np.where(cell, 205, 120).astype(np.uint8)
    blk[(xx % 48) < 3] = 235          # bit-line straps
    blk[(yy % 64) < 4] = 150          # word-line drivers
    m[y0:y1, x0:x1] = blk
    # periphery strip
    box(x0, y1 - 14, x1, y1, 175)

def logic(x0, y0, x1, y1):
    rh = R.choice([10, 12, 14])
    y = y0
    while y + rh <= y1:
        x = x0
        while x < x1:
            w = R.randint(3, 22)
            box(x, y + 1, min(x + w, x1), y + rh - 1, R.randint(120, 225))
            x += w + 1
        box(x0, y, x1, y + 1, 90)     # power rail
        y += rh

def macro(x0, y0, x1, y1):
    box(x0, y0, x1, y1, R.randint(200, 240))
    frame(x0 + 6, y0 + 6, x1 - 6, y1 - 6, 120, 3)
    for _ in range(R.randint(2, 6)):
        w, h = R.randint(10, max(11, (x1 - x0) // 2)), R.randint(10, max(11, (y1 - y0) // 2))
        ax, ay = R.randint(x0 + 10, max(x0 + 11, x1 - w - 10)), R.randint(y0 + 10, max(y0 + 11, y1 - h - 10))
        box(ax, ay, ax + w, ay + h, R.randint(140, 255))

def sparse(x0, y0, x1, y1):
    box(x0, y0, x1, y1, 78)
    for _ in range((x1 - x0) * (y1 - y0) // 900):
        x, y = R.randint(x0, x1 - 4), R.randint(y0, y1 - 4)
        box(x, y, x + 3, y + 3, 190)

def leaf(x0, y0, x1, y1):
    f = R.choices([sram, logic, macro, sparse], [4, 5, 1.2, .8])[0]
    f(x0 + 4, y0 + 4, x1 - 4, y1 - 4)
    frame(x0, y0, x1, y1, 38, 4)
    frame(x0 + 4, y0 + 4, x1 - 4, y1 - 4, 225, 2)

def split(x0, y0, x1, y1, d):
    w, h = x1 - x0, y1 - y0
    if d == 0 or (w < 220 and h < 220) or (d < 3 and R.random() < .25):
        return leaf(x0, y0, x1, y1)
    if w > h * R.uniform(.8, 1.25):
        c = x0 + int(w * R.uniform(.3, .7)); split(x0, y0, c, y1, d - 1); split(c, y0, x1, y1, d - 1)
    else:
        c = y0 + int(h * R.uniform(.3, .7)); split(x0, y0, x1, c, d - 1); split(x0, c, x1, y1, d - 1)

# --- seal ring + bond pads
frame(20, 20, N - 20, N - 20, 240, 14); frame(44, 44, N - 44, N - 44, 150, 4)
for i in range(46):
    o = 140 + i * 83
    for (x, y) in [(o, 70), (o, N - 130), (70, o), (N - 130, o)]:
        box(x, y, x + 60, y + 60, 245); frame(x, y, x + 60, y + 60, 120, 5)
# --- I/O columns left/right
for xs in (220, N - 470):
    y = 220
    while y < N - 260:
        h = R.randint(50, 120); box(xs, y, xs + 250, y + h - 6, R.randint(150, 230)); logic(xs + 10, y + 8, xs + 240, y + h - 14); y += h
# --- top logic region
split(500, 220, N - 500, 1420, 7)
# --- middle band of repeated tiles
R2 = random.Random(3); state = R.getstate()
tw = (N - 1000) // 14
for i in range(14):
    R.seed(11); x0 = 500 + i * tw
    box(x0 + 6, 1460, x0 + tw - 6, 1780, 70); macro(x0 + 14, 1470, x0 + tw - 14, 1560); sram(x0 + 14, 1570, x0 + tw - 14, 1770); frame(x0 + 6, 1460, x0 + tw - 6, 1780, 230, 3)
R.setstate(state)
# --- bottom: one core quadrant, mirrored into a 2x2 cluster around a spine
qx0, qy0, qw, qh = 500, 1840, (N - 1000) // 2 - 40, (N - 300 - 1840) // 2 - 30
sub = np.full((qh, qw), 62, np.uint8)
full = m
m = sub
split(0, 0, qw, qh, 8)
m = full
cx, cy = qx0 + qw + 40, qy0 + qh + 30
for fx, fy, X, Y in [(False, False, qx0, qy0), (True, False, cx + 40, qy0), (False, True, qx0, cy + 30), (True, True, cx + 40, cy + 30)]:
    q = sub[:, ::-1] if fx else sub
    q = q[::-1, :] if fy else q
    m[Y:Y + qh, X:X + qw] = q
box(cx - 30, qy0, cx + 30, cy + 30 + qh, 240); box(qx0, cy - 22, cx + 40 + qw, cy + 22, 240)   # spine
for k in range(0, qh * 2, 40): box(cx - 22, qy0 + k, cx + 22, qy0 + k + 4, 120)

# --- colourise: four-corner pastel wash like the reference (lavender TL, blue TR, pink BL, peach BR)
c = np.array([[168, 132, 255], [110, 186, 255], [255, 120, 206], [255, 186, 100]], np.float32) / 255
u = np.linspace(0, 1, N, dtype=np.float32)[None, :, None]; v = np.linspace(0, 1, N, dtype=np.float32)[:, None, None]
wash = c[0] * (1 - u) * (1 - v) + c[1] * u * (1 - v) + c[2] * (1 - u) * v + c[3] * u * v
s = m.astype(np.float32)[..., None] / 255
img = wash * (0.42 + 0.78 * s) + (s ** 2) * 0.3   # bright structures go towards white          # bright structures go towards white
img += np.random.default_rng(1).normal(0, .012, img.shape[:2])[..., None].astype(np.float32)
img = (np.clip(img, 0, 1) * 255).astype(np.uint8)
im = Image.fromarray(img, "RGB").filter(ImageFilter.UnsharpMask(1.2, 60, 2))
im.save(OUT, "WEBP", quality=78, method=5)
print(im.size)
