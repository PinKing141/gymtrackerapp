#!/usr/bin/env python3
"""Generate Orion Gym PWA icons as PNGs using only the Python stdlib.

Design: brand-dark tile with a subtle vertical depth gradient, a bold
accent-blue "Orion" ring, and three constellation belt stars. All artwork
sits inside the central ~66% safe zone so the same art is safe for maskable
icons (which get cropped to a circle/rounded shape by the platform).
"""
import math
import os
import struct
import zlib

OUT_DIR = os.path.join(os.path.dirname(os.path.dirname(os.path.abspath(__file__))),
                       "public", "icons")

# Fallback: allow explicit output dir via env for running inside the repo.
OUT_DIR = os.environ.get("ICON_OUT_DIR", OUT_DIR)

SS = 4  # supersample factor for anti-aliasing

BG_TOP = (0x12, 0x1A, 0x2B)   # subtle blue-tinted top
BG_BOTTOM = (0x0A, 0x0A, 0x0F)  # brand background
ACCENT = (0x4E, 0xA1, 0xFF)
ACCENT_HI = (0x9C, 0xCB, 0xFF)
STAR = (0xF3, 0xF2, 0xEF)


def lerp(a, b, t):
    return a + (b - a) * t


def mix(c1, c2, t):
    return (lerp(c1[0], c2[0], t), lerp(c1[1], c2[1], t), lerp(c1[2], c2[2], t))


def render(size):
    n = size * SS
    cx = cy = n / 2.0

    # Ring geometry (fraction of full size)
    r_ring = 0.30 * n
    stroke = 0.072 * n
    r_out = r_ring + stroke / 2.0
    r_in = r_ring - stroke / 2.0

    # Belt stars along a diagonal through center
    belt_angle = math.radians(-32)
    dx, dy = math.cos(belt_angle), math.sin(belt_angle)
    star_gap = 0.135 * n
    star_r = 0.028 * n
    belt = [(-1, 1.0), (0, 1.15), (1, 1.0)]  # (offset index, size mult)

    px = bytearray(n * n * 3)
    for y in range(n):
        t = y / (n - 1)
        bg = mix(BG_TOP, BG_BOTTOM, t ** 0.85)
        row = y * n * 3
        for x in range(n):
            r, g, b = bg
            ddx = x - cx
            ddy = y - cy
            dist = math.sqrt(ddx * ddx + ddy * ddy)

            # Ring: anti-aliased annulus, with vertical highlight gradient
            edge = SS  # ~1px feather in supersampled space
            a_out = max(0.0, min(1.0, (r_out - dist) / edge))
            a_in = max(0.0, min(1.0, (dist - r_in) / edge))
            ring_a = a_out * a_in
            if ring_a > 0:
                ring_col = mix(ACCENT_HI, ACCENT, min(1.0, max(0.0, (y - (cy - r_out)) / (2 * r_out))))
                r = lerp(r, ring_col[0], ring_a)
                g = lerp(g, ring_col[1], ring_a)
                b = lerp(b, ring_col[2], ring_a)

            # Belt stars
            for idx, mult in belt:
                sxp = cx + dx * star_gap * idx
                syp = cy + dy * star_gap * idx
                sr = star_r * mult
                sd = math.sqrt((x - sxp) ** 2 + (y - syp) ** 2)
                sa = max(0.0, min(1.0, (sr - sd) / edge))
                if sa > 0:
                    r = lerp(r, STAR[0], sa)
                    g = lerp(g, STAR[1], sa)
                    b = lerp(b, STAR[2], sa)

            i = row + x * 3
            px[i] = int(r + 0.5)
            px[i + 1] = int(g + 0.5)
            px[i + 2] = int(b + 0.5)

    # Downsample (box filter) from n -> size
    out = bytearray(size * size * 3)
    for oy in range(size):
        for ox in range(size):
            r = g = b = 0
            for sy in range(SS):
                yy = oy * SS + sy
                base = (yy * n + ox * SS) * 3
                for sx in range(SS):
                    j = base + sx * 3
                    r += px[j]
                    g += px[j + 1]
                    b += px[j + 2]
            cnt = SS * SS
            o = (oy * size + ox) * 3
            out[o] = r // cnt
            out[o + 1] = g // cnt
            out[o + 2] = b // cnt
    return bytes(out)


def write_png(path, size, rgb):
    def chunk(tag, data):
        c = struct.pack(">I", len(data)) + tag + data
        return c + struct.pack(">I", zlib.crc32(tag + data) & 0xffffffff)

    raw = bytearray()
    stride = size * 3
    for y in range(size):
        raw.append(0)  # filter type 0
        raw.extend(rgb[y * stride:(y + 1) * stride])
    comp = zlib.compress(bytes(raw), 9)
    ihdr = struct.pack(">IIBBBBB", size, size, 8, 2, 0, 0, 0)  # 8-bit RGB
    with open(path, "wb") as f:
        f.write(b"\x89PNG\r\n\x1a\n")
        f.write(chunk(b"IHDR", ihdr))
        f.write(chunk(b"IDAT", comp))
        f.write(chunk(b"IEND", b""))


def main():
    os.makedirs(OUT_DIR, exist_ok=True)
    targets = [
        ("icon-192.png", 192),
        ("icon-512.png", 512),
        ("icon-maskable-192.png", 192),
        ("icon-maskable-512.png", 512),
        ("apple-touch-icon.png", 180),
        ("favicon-32.png", 32),
    ]
    cache = {}
    for name, size in targets:
        if size not in cache:
            cache[size] = render(size)
        write_png(os.path.join(OUT_DIR, name), size, cache[size])
        print("wrote", name, size)


if __name__ == "__main__":
    main()
