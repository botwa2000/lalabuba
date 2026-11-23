"""Build the Christmas printable pack PDFs (growth plan L9): one A4 PDF per language.

    python scripts/make-printable-pack.py [--img-dir DIR] [--only en,de]

Pictures and strings come from lib/printables.js (+ picture labels from lib/gallery.js).
Picture files are read from --img-dir (a copy of data/images/g) or fetched from
https://lalabuba.com/img/g/<file>. Writes public/printables/<slug>.pdf and a small cover
preview public/printables/<slug>.png (used by the banner and as og:image).

Fonts: Nunito (OFL, flutter_app/google_fonts) for Latin/Cyrillic; Chinese and Devanagari
fall back to the fonts built into MuPDF (Droid Sans Fallback, Noto). Only the used glyphs
are embedded (subset).
"""
import argparse
import io
import json
import os
import subprocess
import sys
import urllib.request

import fitz  # PyMuPDF
from PIL import Image

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = os.path.join(ROOT, "public", "printables")
FONTS = os.path.join(ROOT, "flutter_app", "google_fonts")
PURPLE = "#7c4dff"
W, H = fitz.paper_size("a4")  # 595 x 842 pt
M = 40  # page margin

NODE = r"""
const p = require('./lib/printables');
const g = require('./lib/gallery');
const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
const out = {};
for (const l of p.LANGS) out[l] = {
  s: p.strings(l), app: p.pdfAppUrl(l), pdf: p.pdfPath(l),
  pics: p.CHRISTMAS_PICTURES.map((x) => ({ file: x.file, label: cap(l === 'en' ? x.subject : g.subjectLabel(l, x.subject)) })),
};
process.stdout.write(JSON.stringify(out));
"""

CSS = f"""
@font-face {{ font-family: nunito; src: url(Nunito-Regular.ttf); }}
@font-face {{ font-family: nunito; src: url(Nunito-ExtraBold.ttf); font-weight: bold; }}
* {{ font-family: nunito, sans-serif; margin: 0; padding: 0; }}
.title {{ font-size: 30px; font-weight: bold; color: {PURPLE}; text-align: center; }}
.sub {{ font-size: 14px; color: #444; text-align: center; }}
.small {{ font-size: 9px; color: #777; text-align: center; }}
.name {{ font-size: 15px; color: #222; }}
.cap {{ font-size: 10px; color: #888; text-align: right; }}
.foot {{ font-size: 10px; color: #666; text-align: center; }}
"""


def load_image(name, img_dir):
    if img_dir and os.path.exists(os.path.join(img_dir, name)):
        data = open(os.path.join(img_dir, name), "rb").read()
    else:
        req = urllib.request.Request(f"https://lalabuba.com/img/g/{name}", headers={"User-Agent": "lalabuba-pack-builder"})
        data = urllib.request.urlopen(req, timeout=60).read()
    # Line art: 16 grey levels keep the anti-aliased edges and make the file ~4× smaller.
    im = Image.open(io.BytesIO(data)).convert("L").quantize(16, dither=Image.Dither.NONE)
    buf = io.BytesIO()
    im.save(buf, "PNG", optimize=True)
    return buf.getvalue()


def box(page, rect, html, arch):
    page.insert_htmlbox(rect, html, css=CSS, archive=arch)


def esc(s):
    return s.replace("&", "&amp;").replace("<", "&lt;").replace(">", "&gt;")


def build(lang, d, images, arch):
    s = d["s"]
    doc = fitz.open()
    xrefs = {}

    # ── Cover: title, thumbnails of every page, licence + link ──
    cover = doc.new_page(width=W, height=H)
    box(cover, fitz.Rect(M, 42, W - M, 90), f'<p class="title">{esc(s["name"])}</p>', arch)
    box(cover, fitz.Rect(M, 92, W - M, 120), f'<p class="sub">{esc(s["pdfSub"])}</p>', arch)
    cols, top, bottom = 4, 140, 740
    rows = -(-len(d["pics"]) // cols)
    cw, ch = (W - 2 * M) / cols, (bottom - top) / rows
    t = min(cw, ch) - 12
    for i, p in enumerate(d["pics"]):
        r, c = divmod(i, cols)
        in_row = min(cols, len(d["pics"]) - r * cols)  # a short last row is centred
        x = M + (cols - in_row) * cw / 2 + c * cw + (cw - t) / 2
        y = top + r * ch + (ch - t) / 2
        rect = fitz.Rect(x, y, x + t, y + t)
        xrefs[p["file"]] = cover.insert_image(rect, stream=images[p["file"]])
        cover.draw_rect(rect, color=(0.85, 0.82, 0.95), width=0.8)
    box(cover, fitz.Rect(M, 760, W - M, 778), f'<p class="small">{esc(s["pdfLicense"])}</p>', arch)
    box(cover, fitz.Rect(M, 780, W - M, 800), f'<p class="foot">{esc(s["pdfFooter"])}</p>', arch)
    cover.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(M, 778, W - M, 802), "uri": d["app"]})

    # ── One picture per page: name line, caption, picture, footer link ──
    side = W - 2 * M
    for p in d["pics"]:
        page = doc.new_page(width=W, height=H)
        box(page, fitz.Rect(M, 38, M + 280, 60), f'<p class="name">{esc(s["pdfName"])} ____________________</p>', arch)
        box(page, fitz.Rect(M + 270, 44, W - M, 60), f'<p class="cap">{esc(p["label"])}</p>', arch)
        y = 70 + (790 - 70 - side) / 2  # centred between the name line and the footer
        page.insert_image(fitz.Rect(M, y, M + side, y + side), xref=xrefs[p["file"]])
        box(page, fitz.Rect(M, 800, W - M, 818), f'<p class="foot">{esc(s["pdfFooter"])}</p>', arch)
        page.insert_link({"kind": fitz.LINK_URI, "from": fitz.Rect(M, 798, W - M, 820), "uri": d["app"]})

    doc.set_metadata({
        "title": s["h1"], "author": "Lalabuba", "subject": s["desc"],
        "keywords": s["name"], "creator": "lalabuba.com", "producer": "lalabuba.com",
    })
    try:
        doc.set_language({"zh": "zh-Hans"}.get(lang, lang))
    except Exception:
        pass
    doc.subset_fonts()
    slug = os.path.basename(d["pdf"])[:-4]
    pdf_file = os.path.join(OUT, slug + ".pdf")
    doc.save(pdf_file, garbage=4, deflate=True, deflate_images=True, deflate_fonts=True)
    # Cover preview for the banner / og:image (240 px wide ≈ 2× the banner thumb).
    pix = doc[0].get_pixmap(matrix=fitz.Matrix(240 / W, 240 / W))
    Image.frombytes("RGB", (pix.width, pix.height), pix.samples).save(os.path.join(OUT, slug + ".png"), optimize=True)
    return pdf_file, len(doc)


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument("--img-dir")
    ap.add_argument("--only")
    a = ap.parse_args()
    data = json.loads(subprocess.check_output(["node", "-e", NODE], cwd=ROOT))
    os.makedirs(OUT, exist_ok=True)
    arch = fitz.Archive(FONTS)
    files = {p["file"] for d in data.values() for p in d["pics"]}
    images = {f: load_image(f, a.img_dir) for f in sorted(files)}
    langs = a.only.split(",") if a.only else list(data)
    for lang in langs:
        f, n = build(lang, data[lang], images, arch)
        print(f"{lang}: {os.path.relpath(f, ROOT)}  {n} pages  {os.path.getsize(f) // 1024} KB")


if __name__ == "__main__":
    sys.exit(main())
