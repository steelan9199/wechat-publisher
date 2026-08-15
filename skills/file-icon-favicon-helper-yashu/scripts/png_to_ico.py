#!/usr/bin/env python3
"""Convert an image (PNG/JPG/...) to a multi-resolution Windows .ico file.

Strategy: render each target resolution with Pillow (LANCZOS), then embed every
frame as a PNG inside the ICO container (PNG-in-ICO, supported on all modern
Windows). This deliberately avoids Pillow's unreliable built-in multi-frame ICO
encoder, which on several Pillow builds only writes a single frame.

Usage:
    python png_to_ico.py <input_image> <output.ico> [size1 size2 ...]
When no sizes are given, defaults to 16 24 32 48 64 128 256.
Requires Pillow (pip install Pillow), e.g. in the managed Python venv.
"""
import io
import struct
import sys

from PIL import Image

DEFAULT_SIZES = [16, 24, 32, 48, 64, 128, 256]


def build_ico(src_path: str, dst_path: str, sizes) -> None:
    img = Image.open(src_path)
    if img.mode != "RGBA":
        img = img.convert("RGBA")

    # Render each resolution as a standalone PNG (RGBA).
    frames = []
    for s in sizes:
        buf = io.BytesIO()
        img.resize((s, s), Image.Resampling.LANCZOS).save(buf, format="PNG")
        frames.append(buf.getvalue())

    # Build the ICO container manually.
    # ICONDIR: reserved(0) u16, type(1=ICO) u16, count u16  -> 6 bytes
    # Each ICONDIRENTRY: 16 bytes -> width, height, colorCount, reserved,
    #   planes u16, bitCount u16, bytesInRes u32, imageOffset u32
    out = io.BytesIO()
    out.write(struct.pack("<HHH", 0, 1, len(frames)))
    data_offset = 6 + 16 * len(frames)
    offset = data_offset
    for s, png in zip(sizes, frames):
        size = len(png)
        # Width/Height fields are 1 byte; 0 means 256.
        w = s if s < 256 else 0
        h = s if s < 256 else 0
        out.write(struct.pack("<BBBBHHII", w, h, 0, 0, 1, 32, size, offset))
        offset += size
    for png in frames:
        out.write(png)

    with open(dst_path, "wb") as f:
        f.write(out.getvalue())


def main() -> None:
    if len(sys.argv) < 3:
        print("Usage: python png_to_ico.py <input_image> <output.ico> [sizes...]")
        sys.exit(2)

    src = sys.argv[1]
    dst = sys.argv[2]
    sizes = [int(s) for s in sys.argv[3:]] if len(sys.argv) > 3 else DEFAULT_SIZES

    build_ico(src, dst, sizes)
    print(f"ICO_WRITTEN {dst}")


if __name__ == "__main__":
    main()
