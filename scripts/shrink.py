import sys
from PIL import Image
# Usage: python shrink.py in.png [out.png] [maxdim]
inp = sys.argv[1]
out = sys.argv[2] if len(sys.argv) > 2 else inp.replace('.png', '-sm.png')
maxdim = int(sys.argv[3]) if len(sys.argv) > 3 else 900
im = Image.open(inp)
w, h = im.size
scale = min(1.0, maxdim / max(w, h))
if scale < 1.0:
    im = im.resize((round(w * scale), round(h * scale)), Image.LANCZOS)
im.save(out)
print(f"{inp} {w}x{h} -> {out} {im.size[0]}x{im.size[1]}")
