#!/usr/bin/env python3
"""Generate app icons for the Todo PWA."""

import struct
import zlib

def create_svg_icon(size=512, maskable=False):
    """Create an SVG icon."""
    padding = size * 0.15 if maskable else size * 0.1
    check_size = size - (padding * 2)
    stroke_width = check_size * 0.08

    svg = f'''<svg width="{size}" height="{size}" viewBox="0 0 {size} {size}" xmlns="http://www.w3.org/2000/svg">
  <defs>
    <linearGradient id="bg" x1="0%" y1="0%" x2="100%" y2="100%">
      <stop offset="0%" stop-color="#6750A4"/>
      <stop offset="100%" stop-color="#4F378B"/>
    </linearGradient>
  </defs>
  <rect width="{size}" height="{size}" rx="{size*0.22 if maskable else 0}" fill="url(#bg)"/>
  <circle cx="{size/2}" cy="{size/2}" r="{check_size*0.42}" fill="none" stroke="white" stroke-width="{stroke_width}" stroke-linecap="round"/>
  <path d="M {size/2 - check_size*0.15} {size/2} L {size/2 - check_size*0.02} {size/2 + check_size*0.13} L {size/2 + check_size*0.18} {size/2 - check_size*0.14}" fill="none" stroke="white" stroke-width="{stroke_width}" stroke-linecap="round" stroke-linejoin="round"/>
</svg>'''
    return svg

def svg_to_png_data(png_width, png_height, draw_func):
    """Create a PNG from a draw function that returns RGBA pixels."""
    # Create pixel data
    pixels = []
    for y in range(png_height):
        row = b''
        for x in range(png_width):
            r, g, b, a = draw_func(x, y, png_width, png_height)
            row += struct.pack('BBBB', r, g, b, a)
        pixels.append(b'\x00' + row)  # filter byte + row data

    raw_data = b''.join(pixels)

    def png_chunk(chunk_type, data):
        chunk = chunk_type + data
        crc = zlib.crc32(chunk) & 0xFFFFFFFF
        return struct.pack('>I', len(data)) + chunk + struct.pack('>I', crc)

    # PNG signature
    signature = b'\x89PNG\r\n\x1a\n'

    # IHDR
    ihdr_data = struct.pack('>IIBBBBB', png_width, png_height, 8, 6, 0, 0, 0)  # 8-bit RGBA
    ihdr = png_chunk(b'IHDR', ihdr_data)

    # IDAT
    compressed = zlib.compress(raw_data, 9)
    idat = png_chunk(b'IDAT', compressed)

    # IEND
    iend = png_chunk(b'IEND', b'')

    return signature + ihdr + idat + iend

def draw_icon(x, y, w, h, maskable=False):
    """Draw the todo icon at position x,y on a w x h canvas."""
    cx, cy = w / 2, h / 2

    # Background gradient (simple diagonal)
    t = (x + y) / (w + h)
    r = int(0x67 + (0x4F - 0x67) * t)
    g = int(0x50 + (0x37 - 0x50) * t)
    b = int(0xA4 + (0x8B - 0xA4) * t)
    a = 255

    if maskable:
        # Full bleed background
        pass
    else:
        # Rounded rect background
        radius = w * 0.22
        # Check corners
        dx = abs(x - cx)
        dy = abs(y - cy)
        if x < radius and y < radius:
            if (radius - x)**2 + (radius - y)**2 > radius**2:
                return (0, 0, 0, 0)
        elif x > w - radius and y < radius:
            if (x - (w - radius))**2 + (radius - y)**2 > radius**2:
                return (0, 0, 0, 0)
        elif x < radius and y > h - radius:
            if (radius - x)**2 + (y - (h - radius))**2 > radius**2:
                return (0, 0, 0, 0)
        elif x > w - radius and y > h - radius:
            if (x - (w - radius))**2 + (y - (h - radius))**2 > radius**2:
                return (0, 0, 0, 0)

    # Draw circle (checkmark outline)
    circle_radius = w * 0.3
    stroke_width = w * 0.04
    dist = ((x - cx)**2 + (y - cy)**2) ** 0.5
    circle_diff = abs(dist - circle_radius)

    if circle_diff < stroke_width / 2:
        return (255, 255, 255, 255)

    # Draw checkmark
    # Checkmark points: (p1, p2, p3)
    p1 = (cx - w * 0.12, cy)
    p2 = (cx - w * 0.02, cy + w * 0.10)
    p3 = (cx + w * 0.15, cy - w * 0.11)

    # Distance from point to line segment
    def dist_to_segment(px, py, x1, y1, x2, y2):
        dx = x2 - x1
        dy = y2 - y1
        if dx == 0 and dy == 0:
            return ((px - x1)**2 + (py - y1)**2) ** 0.5
        t = max(0, min(1, ((px - x1) * dx + (py - y1) * dy) / (dx * dx + dy * dy)))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return ((px - proj_x)**2 + (py - proj_y)**2) ** 0.5

    d1 = dist_to_segment(x, y, p1[0], p1[1], p2[0], p2[1])
    d2 = dist_to_segment(x, y, p2[0], p2[1], p3[0], p3[1])

    if d1 < stroke_width / 2 or d2 < stroke_width / 2:
        return (255, 255, 255, 255)

    return (r, g, b, a)

def main():
    import os
    out_dir = os.path.dirname(os.path.abspath(__file__))

    # SVG icon
    svg = create_svg_icon(512, maskable=False)
    with open(os.path.join(out_dir, 'icon.svg'), 'w') as f:
        f.write(svg)
    print('Created icon.svg')

    # PNG icons
    sizes = [192, 512]
    for size in sizes:
        print(f'Generating icon-{size}.png...')
        data = svg_to_png_data(size, size, lambda x, y, w, h: draw_icon(x, y, w, h, False))
        with open(os.path.join(out_dir, f'icon-{size}.png'), 'wb') as f:
            f.write(data)
        print(f'Created icon-{size}.png')

        # Maskable version
        print(f'Generating icon-maskable-{size}.png...')
        data = svg_to_png_data(size, size, lambda x, y, w, h: draw_icon(x, y, w, h, True))
        with open(os.path.join(out_dir, f'icon-maskable-{size}.png'), 'wb') as f:
            f.write(data)
        print(f'Created icon-maskable-{size}.png')

    print('All icons generated!')

if __name__ == '__main__':
    main()
