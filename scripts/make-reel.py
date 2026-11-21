#!/usr/bin/env python3
"""
make-reel.py — build a Lalabuba series episode for TikTok / Shorts / Reels.

WHY THIS EXISTS
  The three original videos are single-take screen recordings with continuity
  faults (01 types "cat doing yoga", the loading header says "dragon flying over
  mountains", and it reveals a monkey — three subjects in one clip). This builds
  episodes from controlled synthetic beats plus *consistent* slices of real
  footage, so the prompt, the line art and the colouring always match.

ARCHITECTURE
  Synthetic beats (hook / typing / nugget) are rendered frame-by-frame with PIL.
  Real app footage is sliced with ffmpeg. Everything is normalised to
  1080x1920 @ 30fps and concatenated. Deterministic: same inputs, same output.

  Silent by design — see VIDEO-SERIES-STRATEGY.md §8. Beats sit on a fixed grid
  so a music track drops in without re-editing.

USAGE
  python3 scripts/make-reel.py --episode 1
"""

import argparse, math, os, shutil, subprocess, sys
from PIL import Image, ImageDraw, ImageFont

W, H, FPS = 1080, 1920, 30

# Brand palette, taken from the app icon and pins — do not invent new colours.
CREAM  = (253, 248, 236)
INK    = (43, 30, 66)
PURPLE = (124, 58, 237)
YELLOW = (255, 205, 60)
GREEN  = (34, 139, 68)

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
VID  = os.path.join(ROOT, "docs", "social-content", "videos")
ICON = os.path.join(ROOT, "app-store-assets", "app-icon-1024.png")
OUT  = os.path.join(ROOT, "docs", "social-content", "videos", "series")
TMP  = "/tmp/reelbuild"

FONT_DIR = "/usr/share/fonts/truetype/google-fonts"
def font(name, size):
    for cand in (f"{FONT_DIR}/{name}.ttf", f"/usr/share/fonts/truetype/lato/{name}.ttf"):
        if os.path.exists(cand):
            return ImageFont.truetype(cand, size)
    return ImageFont.load_default()

def F_BOLD(s):  return font("Poppins-Bold", s)
def F_MED(s):   return font("Poppins-Medium", s)
def F_REG(s):   return font("Poppins-Regular", s)

# ---------------------------------------------------------------- easing
def ease_out(t):   return 1 - (1 - t) ** 3
def ease_in_out(t): return 4*t*t*t if t < 0.5 else 1 - ((-2*t + 2) ** 3) / 2
def clamp01(x):    return max(0.0, min(1.0, x))

# ---------------------------------------------------------------- mascot
def load_star():
    """The winking star from the app icon, cropped free of its white band and
    cream border, with the white knocked out to alpha."""
    im = Image.open(ICON).convert("RGBA")
    im = im.crop((60, 240, 1010, 780))          # the artwork band only
    px = im.load()
    for y in range(im.height):
        for x in range(im.width):
            r, g, b, a = px[x, y]
            if r > 243 and g > 243 and b > 236:  # white/cream -> transparent
                px[x, y] = (r, g, b, 0)
    return im

def paste_star(canvas, star, cy, scale, alpha=1.0):
    w = int(star.width * scale)
    h = int(star.height * scale)
    s = star.resize((w, h), Image.LANCZOS)
    if alpha < 1.0:
        a = s.split()[3].point(lambda v: int(v * alpha))
        s.putalpha(a)
    canvas.alpha_composite(s, (W // 2 - w // 2, int(cy - h / 2)))

# ---------------------------------------------------------------- text
def wrap(draw, text, fnt, maxw):
    words, lines, cur = text.split(), [], ""
    for wd in words:
        trial = (cur + " " + wd).strip()
        if draw.textlength(trial, font=fnt) <= maxw:
            cur = trial
        else:
            if cur: lines.append(cur)
            cur = wd
    if cur: lines.append(cur)
    return lines

def centered(draw, lines, fnt, top, fill, lh=1.22):
    y = top
    for ln in lines:
        w = draw.textlength(ln, font=fnt)
        draw.text((W / 2 - w / 2, y), ln, font=fnt, fill=fill)
        y += fnt.size * lh
    return y

def rounded(draw, box, r, fill):
    draw.rounded_rectangle(box, radius=r, fill=fill)

# ================================================================ BEATS

def beat_hook(n, star, question):
    """Star drops in, question types on. The scroll-stopper."""
    frames = []
    fq = F_BOLD(78)
    for i in range(n):
        t = i / (n - 1)
        c = Image.new("RGBA", (W, H), CREAM + (255,))
        d = ImageDraw.Draw(c)

        # star settles with a slight overshoot
        dropt = clamp01(t / 0.42)
        e = ease_out(dropt)
        cy = 560 + (1 - e) * -160
        bob = math.sin(t * math.pi * 2.2) * 10 * dropt
        paste_star(c, star, cy + bob, 0.82, alpha=min(1.0, dropt * 1.6))

        # question types on, character by character, after the star lands
        typt = clamp01((t - 0.26) / 0.40)
        lines = wrap(d, question, fq, W - 190)
        full = "\n".join(lines)
        shown = int(len(full) * ease_out(typt))
        partial = full[:shown].split("\n")
        centered(d, partial, fq, 1000, INK)

        # caret
        if typt < 1.0 and (i // 4) % 2 == 0 and partial:
            lw = d.textlength(partial[-1], font=fq)
            ly = 1000 + (len(partial) - 1) * fq.size * 1.22
            d.rectangle([W/2 + lw/2 + 8, ly + 8, W/2 + lw/2 + 15, ly + fq.size], fill=PURPLE)

        frames.append(c.convert("RGB"))
    return frames

def beat_typing(n, prompt):
    """A clean mock of the app's input row — controlled, so the text always
    matches the artwork that follows. This is the continuity fix."""
    frames = []
    fi, fb = F_MED(52), F_BOLD(54)
    for i in range(n):
        t = i / (n - 1)
        c = Image.new("RGBA", (W, H), (245, 243, 255, 255))
        d = ImageDraw.Draw(c)

        centered(d, ["What should we draw today?"], F_BOLD(60), 620, INK)

        rounded(d, [90, 900, W - 90, 1040], 34, (255, 255, 255, 255))
        shown = prompt[: int(len(prompt) * clamp01(t / 0.48))]
        d.text((140, 938), shown, font=fi, fill=INK)
        if (i // 4) % 2 == 0 and clamp01(t / 0.62) < 1.0:
            cw = d.textlength(shown, font=fi)
            d.rectangle([140 + cw + 6, 938, 140 + cw + 12, 938 + fi.size], fill=PURPLE)

        # Draw! button wakes up once there is text
        live = len(shown) > 0
        press = 1.0 - 0.05 * math.sin(clamp01((t - 0.70) / 0.3) * math.pi) if t > 0.70 else 1.0
        bw, bh = int(560 * press), int(132 * press)
        bx, by = W // 2 - bw // 2, 1150
        rounded(d, [bx, by, bx + bw, by + bh], 40,
                PURPLE + (255,) if live else (206, 200, 224, 255))
        lbl = "Draw!"
        lw = d.textlength(lbl, font=fb)
        d.text((W / 2 - lw / 2, by + bh / 2 - fb.size * 0.62), lbl, font=fb, fill=(255, 255, 255))

        frames.append(c.convert("RGB"))
    return frames

def beat_outro(n, star, nugget, source):
    """The knowledge nugget — the reason to follow rather than just watch."""
    frames = []
    fn, fs, fc = F_BOLD(64), F_REG(38), F_BOLD(46)
    for i in range(n):
        t = i / (n - 1)
        c = Image.new("RGBA", (W, H), CREAM + (255,))
        d = ImageDraw.Draw(c)
        paste_star(c, star, 400, 0.58, alpha=clamp01(t / 0.18))

        rise = ease_out(clamp01((t - 0.06) / 0.40))
        lines = wrap(d, nugget, fn, W - 180)
        y = centered(d, lines, fn, 760 + (1 - rise) * 60, INK)

        if t > 0.42:
            a = clamp01((t - 0.42) / 0.25)
            sl = wrap(d, source, fs, W - 220)
            centered(d, sl, fs, y + 28, tuple(int(INK[k] + (CREAM[k] - INK[k]) * (1 - a) * 0.75) for k in range(3)))

        if t > 0.58:
            bw, bh = 620, 124
            bx, by = W // 2 - bw // 2, 1140
            rounded(d, [bx, by, bx + bw, by + bh], 40, GREEN + (255,))
            lbl = "Free at lalabuba.com"
            lw = d.textlength(lbl, font=fc)
            d.text((W / 2 - lw / 2, by + bh / 2 - fc.size * 0.62), lbl, font=fc, fill=(255, 255, 255))

        frames.append(c.convert("RGB"))
    return frames


def beat_montage(pairs, star, per):
    """The point of the whole product: ANY word becomes a picture.
    Each pair is (prompt, hero-image path). Cuts accelerate — the rhythm is
    what sells 'anything', not any single picture."""
    import os
    frames = []
    fp, fl = F_BOLD(64), F_MED(40)
    HERO = os.path.join(ROOT, "docs", "social-content", "videos", "series", "heroes")
    for idx, (prompt, hero) in enumerate(pairs):
        n = int(per[idx] * FPS)
        art = Image.open(os.path.join(HERO, hero)).convert("RGB")
        art = art.resize((980, int(980 * art.height / art.width)), Image.LANCZOS)
        for i in range(n):
            t = i / (n - 1)
            c = Image.new("RGBA", (W, H), CREAM + (255,))
            d = ImageDraw.Draw(c)

            # the typed word, always first
            shown = prompt[: int(len(prompt) * clamp01(t / 0.30))]
            d.text((W / 2 - d.textlength('"' + prompt + '"', font=fp) / 2, 400),
                   '"' + shown + '"', font=fp, fill=INK)

            # art snaps in with a small overshoot once the word is down
            ap = clamp01((t - 0.34) / 0.34)
            if ap > 0:
                sc = 0.82 + 0.18 * ease_out(ap)
                sc = sc * (1 + 0.03 * math.sin(ease_out(ap) * math.pi))
                aw, ah = int(art.width * sc), int(art.height * sc)
                a2 = art.resize((aw, ah), Image.LANCZOS)
                lay = Image.new("RGBA", (W, H), (0, 0, 0, 0))
                lay.paste(a2, (W // 2 - aw // 2, 620 + (art.height - ah) // 2))
                lay.putalpha(lay.split()[3].point(lambda v: int(v * min(1.0, ap * 2))))
                c.alpha_composite(lay)

            # running counter — makes it a series, not a slideshow
            lbl = f"{idx + 1} of {len(pairs)}"
            d.text((W / 2 - d.textlength(lbl, font=fl) / 2, 1690), lbl, font=fl,
                   fill=(150, 142, 170))
            frames.append(c.convert("RGB"))
    return frames


# ================================================================ assembly

def write_frames(frames, tag):
    dirp = os.path.join(TMP, tag)
    os.makedirs(dirp, exist_ok=True)
    for i, f in enumerate(frames):
        f.save(os.path.join(dirp, f"{i:05d}.png"))
    seg = os.path.join(TMP, f"{tag}.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-framerate", str(FPS),
                    "-i", os.path.join(dirp, "%05d.png"),
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", seg], check=True)
    return seg

def slice_clip(src, start, dur, tag, speed=1.0):
    """Cut real footage, normalise to 1080x1920@30 and optionally speed-ramp."""
    seg = os.path.join(TMP, f"{tag}.mp4")
    vf = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}"
    if speed != 1.0:
        vf = f"setpts={1/speed:.4f}*PTS," + vf
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(dur),
                    "-i", src, "-vf", vf, "-an",
                    "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", seg], check=True)
    return seg


def caption_png(text, path, accent=None):
    """A caption bar rendered in the series' own type, laid over real footage.
    Using PIL rather than ffmpeg drawtext keeps the font identical to every
    other beat — mixing renderers is how a series starts looking assembled."""
    accent = accent or PURPLE
    c = Image.new("RGBA", (W, H), (0, 0, 0, 0))
    d = ImageDraw.Draw(c)
    f = F_BOLD(58)
    lines = wrap(d, text, f, W - 220)
    bh = int(len(lines) * f.size * 1.22) + 76
    top = 168
    d.rounded_rectangle([70, top, W - 70, top + bh], radius=36, fill=accent + (238,))
    y = top + 38
    for ln in lines:
        lw = d.textlength(ln, font=f)
        d.text((W / 2 - lw / 2, y), ln, font=f, fill=(255, 255, 255))
        y += f.size * 1.22
    c.save(path)
    return path


def clip(src, start, dur, tag, caption=None, speed=1.0, accent=None):
    """Slice real footage, normalise, and optionally burn a caption over it."""
    seg = os.path.join(TMP, f"{tag}.mp4")
    vf = f"scale={W}:{H}:force_original_aspect_ratio=increase,crop={W}:{H},fps={FPS}"
    if speed != 1.0:
        vf = f"setpts={1/speed:.4f}*PTS," + vf
    cmd = ["ffmpeg", "-v", "error", "-y", "-ss", str(start), "-t", str(dur), "-i", src]
    if caption:
        png = caption_png(caption, os.path.join(TMP, f"{tag}_cap.png"), accent)
        cmd += ["-i", png, "-filter_complex", f"[0:v]{vf}[v];[v][1:v]overlay=0:0[out]",
                "-map", "[out]"]
    else:
        cmd += ["-vf", vf]
    cmd += ["-an", "-c:v", "libx264", "-pix_fmt", "yuv420p", "-crf", "17", seg]
    subprocess.run(cmd, check=True)
    return seg


def concat(segs, out):
    lst = os.path.join(TMP, "list.txt")
    with open(lst, "w") as f:
        for s in segs:
            f.write(f"file '{s}'\n")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-f", "concat", "-safe", "0",
                    "-i", lst, "-c:v", "libx264", "-pix_fmt", "yuv420p",
                    "-crf", "18", "-movflags", "+faststart", out], check=True)

EPISODES = {
    3: dict(
        kind     = "explain",
        question = "Every picture comes numbered.",
        clips    = [("cbn_01_numbers_visible.mp4", 1.0, 4.2, "Every area has a number", 1.0),
                    ("cbn_02_tap_to_fill.mp4",    0.4, 7.2, "Pick the colour. Tap the number.", 1.0),
                    ("cbn_03_complete.mp4",       0.2, 4.0, "Until the picture is finished", 1.3)],
        nugget   = "Colour-by-number was invented in 1950.",
        source   = "Critics hated it. Children never did.",
    ),
    4: dict(
        kind     = "explain",
        question = "Or ignore the numbers entirely.",
        clips    = [("free_01_paint_mode.mp4",   0.3, 7.2, "Switch to free painting", 1.0),
                    ("free_02_wrong_colours.mp4", 0.2, 6.0, "A purple dinosaur is a valid dinosaur", 1.0)],
        nugget   = "Colouring outside the lines isn't sloppiness.",
        source   = "Fine motor control arrives after the urge to create does.",
    ),
    2: dict(
        kind     = "montage",
        question = "Type ANY word.",
        # Captions are the EXACT prompt strings recorded in subjects.json — the
        # video must never claim a prompt the app wasn't actually given.
        # High-search-volume nouns, not absurd phrases: this cut is for YouTube,
        # where the title and subject do the discovery work (see strategy §4b).
        pairs    = [("dragon", "dragon.png"), ("mermaid", "mermaid.png"),
                    ("butterfly", "butterfly.png"), ("robot", "robot.png"),
                    ("castle", "castle.png"), ("octopus", "octopus.png")],
        per      = [2.2, 1.9, 1.6, 1.4, 1.25, 1.15],
        closer   = "Whatever they say. It draws it.",
        nugget   = "Children draw what they know, not what they see.",
        source   = "Which is why every drawing is different.",
    ),
    1: dict(
        question = "Can it draw a triceratops?",
        prompt   = "a triceratops",
        nugget   = "Kids draw the sky as a strip at the top until about age 7.",
        source   = "They draw what they know, not what they see.",
        # video 02 is the only self-consistent clip: white line art -> full colour
        art_src  = "02_satisfying_coloring.mp4", art_start = 0.0, art_dur = 20.0, art_speed = 2.6,
    ),
}

def build(ep):
    cfg = EPISODES[ep]
    shutil.rmtree(TMP, ignore_errors=True); os.makedirs(TMP, exist_ok=True)
    os.makedirs(OUT, exist_ok=True)
    star = load_star()

    if cfg.get("kind") == "explain":
        SRC = os.path.join(VID, "source")
        print("  hook…"); segs = [write_frames(beat_hook(int(2.4 * FPS), star, cfg["question"]), "hook")]
        for i, (f, st, dur, cap, sp) in enumerate(cfg["clips"]):
            print(f"  clip {i+1}…")
            segs.append(clip(os.path.join(SRC, f), st, dur, f"c{i}", caption=cap, speed=sp))
        print("  outro…"); segs.append(write_frames(
            beat_outro(int(3.2 * FPS), star, cfg["nugget"], cfg["source"]), "outro"))
        out = os.path.join(OUT, f"ep{ep:02d}.mp4")
        concat(segs, out)
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
        print(f"\n  {out}\n  {dur}s\n")
        return out

    if cfg.get("kind") == "montage":
        print("  hook…");    s1 = write_frames(beat_hook(int(2.2 * FPS), star, cfg["question"]), "hook")
        print("  montage…"); s2 = write_frames(beat_montage(cfg["pairs"], star, cfg["per"]), "mont")
        print("  closer…");  s3 = write_frames(beat_outro(int(2.0 * FPS), star, cfg["closer"], ""), "closer")
        print("  outro…");   s4 = write_frames(beat_outro(int(3.2 * FPS), star, cfg["nugget"], cfg["source"]), "outro")
        out = os.path.join(OUT, f"ep{ep:02d}.mp4")
        concat([s1, s2, s3, s4], out)
        dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                              "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
        print(f"\n  {out}\n  {dur}s\n")
        return out

    print("  hook…");   s1 = write_frames(beat_hook(int(3.0 * FPS), star, cfg["question"]), "hook")
    print("  typing…"); s2 = write_frames(beat_typing(int(2.0 * FPS), cfg["prompt"]), "typing")
    print("  reveal + colour…")
    s3 = slice_clip(os.path.join(VID, cfg["art_src"]), cfg["art_start"], cfg["art_dur"],
                    "art", speed=cfg["art_speed"])
    print("  outro…");  s4 = write_frames(beat_outro(int(3.4 * FPS), star, cfg["nugget"], cfg["source"]), "outro")

    out = os.path.join(OUT, f"ep{ep:02d}.mp4")
    concat([s1, s2, s3, s4], out)
    dur = subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                          "-of", "csv=p=0", out], capture_output=True, text=True).stdout.strip()
    print(f"\n  {out}\n  {dur}s\n")
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--episode", type=int, default=1)
    build(ap.parse_args().episode)
