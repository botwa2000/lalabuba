#!/usr/bin/env python3
"""
make-reel-audio.py — synthesise a soundtrack for a series episode and mux it in.

WHY THIS EXISTS
  Claude cannot download or generate licensed music, and the episodes were built
  silent. But the renderer knows exactly when every beat happens, so the sound
  can be generated to match — which is better than laying a stock track over the
  top and hoping the cuts line up.

  Everything here is synthesised from scratch: no samples, no licensing, fully
  owned. Safe for YouTube (no Content ID risk).

  For TikTok / Reels you may still prefer a trending sound added in-app — that
  carries an algorithmic benefit this cannot. This track is the right choice for
  YouTube Shorts, and a usable fallback everywhere.

USAGE
  python3 scripts/make-reel-audio.py --episode 2
"""

import argparse, math, os, subprocess, wave
import numpy as np

SR = 48000
ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
SERIES = os.path.join(ROOT, "docs", "social-content", "videos", "series")

# ------------------------------------------------------------------ voices

def _env(n, attack, decay):
    """Percussive envelope: near-instant attack, exponential decay."""
    t = np.arange(n) / SR
    a = np.clip(t / max(attack, 1e-6), 0, 1)
    return a * np.exp(-t * decay)

def tone(freq, dur, gain=0.25, decay=6.0, attack=0.004, harmonics=(1.0, 0.35, 0.12)):
    """Marimba-ish: fundamental plus two quiet partials. Warmer than a bare sine."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    w = np.zeros(n)
    for i, amp in enumerate(harmonics):
        w += amp * np.sin(2 * np.pi * freq * (i + 1) * t)
    return (w / sum(harmonics)) * _env(n, attack, decay) * gain

def blip(freq, dur=0.16, gain=0.13):
    """Short tick for typing."""
    return tone(freq, dur, gain=gain, decay=26.0, harmonics=(1.0, 0.2))

def pop(dur=0.26, gain=0.30):
    """Rising chirp — used when artwork appears."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    f = 380 + 1500 * (t / dur) ** 1.6
    w = np.sin(2 * np.pi * np.cumsum(f) / SR)
    return w * _env(n, 0.002, 13.0) * gain

def chime(root, dur=1.6, gain=0.22):
    """Root + fifth + octave, long decay. The reveal / resolution sound."""
    return (tone(root, dur, gain, 2.6) +
            tone(root * 1.5, dur, gain * 0.55, 2.8) +
            tone(root * 2.0, dur, gain * 0.35, 3.2))

def pad(freqs, dur, gain=0.05):
    """Soft sustained bed. Detuned pairs so it does not sound like a test tone."""
    n = int(dur * SR)
    t = np.arange(n) / SR
    w = np.zeros(n)
    for f in freqs:
        w += np.sin(2 * np.pi * f * t) + np.sin(2 * np.pi * f * 1.004 * t)
    w /= (2 * len(freqs))
    fade = np.minimum(np.clip(t / 0.9, 0, 1), np.clip((dur - t) / 0.9, 0, 1))
    return w * fade * gain


# The Lalabuba sonic logo — rising major triad, warm attack, identical every
# episode. This is the single highest-value audio decision: recognition compounds
# across the series in a way that a different jingle each time never can.
LOGO = [(523.25, 0.00), (659.25, 0.11), (783.99, 0.22)]

def sonic_logo(gain=0.30):
    out = np.zeros(int(1.9 * SR))
    for f, off in LOGO:
        w = tone(f, 1.7, gain=gain, decay=2.4, attack=0.012)
        i = int(off * SR)
        out[i:i + len(w)] += w[: len(out) - i]
    return out

# ------------------------------------------------------------------ mixing

class Track:
    def __init__(self, dur):
        self.buf = np.zeros(int(dur * SR) + SR)
        self.dur = dur
    def add(self, at, wave_):
        i = int(at * SR)
        j = min(i + len(wave_), len(self.buf))
        if i < len(self.buf):
            self.buf[i:j] += wave_[: j - i]
    def write(self, path):
        b = self.buf[: int(self.dur * SR)]
        peak = np.max(np.abs(b))
        if peak > 0:
            b = b / peak * 0.89              # headroom, no clipping
        # gentle 12ms de-click at both ends
        k = int(0.012 * SR)
        b[:k] *= np.linspace(0, 1, k)
        b[-k:] *= np.linspace(1, 0, k)
        pcm = (b * 32767).astype(np.int16)
        with wave.open(path, "w") as f:
            f.setnchannels(1); f.setsampwidth(2); f.setframerate(SR)
            f.writeframes(pcm.tobytes())

# C major pentatonic — no semitone clashes, so any two notes sound fine together.
PENT = [261.63, 293.66, 329.63, 392.00, 440.00, 523.25, 587.33, 659.25]

def melody_bed(tr, start, end, step=0.5, gain=0.055):
    """Wandering pentatonic pattern. Deterministic: same episode, same melody."""
    rng = np.random.default_rng(7)
    idx, t = 0, start
    while t < end:
        idx = int(np.clip(idx + rng.integers(-2, 3), 0, len(PENT) - 1))
        tr.add(t, tone(PENT[idx], min(0.62, end - t), gain=gain, decay=7.0))
        t += step

# ------------------------------------------------------------------ episodes

def score_ep2(tr):
    """Episode 2 — montage. Beat times come from make-reel.py's config."""
    hook = 2.2
    per = [2.2, 1.9, 1.6, 1.4, 1.25, 1.15]
    prompts = ["dragon", "mermaid", "butterfly", "robot", "castle", "octopus"]

    tr.add(0.0, pad([130.81, 196.00, 261.63], 3.0, gain=0.07))
    for i, ch in enumerate("Type ANY word."):            # hook types on
        if ch != " ":
            tr.add(0.60 + i * 0.045, blip(1100 + (i % 4) * 110, gain=0.07))

    t = hook
    melody_bed(tr, hook, hook + sum(per), step=0.5)
    for i, (p, d) in enumerate(zip(prompts, per)):
        for k, ch in enumerate(p):                        # typing ticks
            if ch != " ":
                tr.add(t + k * (d * 0.30 / len(p)), blip(980 + (k % 5) * 90, gain=0.055))
        tr.add(t + d * 0.34, pop(gain=0.38 + i * 0.035))   # artwork lands, rising each time
        tr.add(t + d * 0.34, tone(PENT[min(i + 2, 7)], 0.9, gain=0.12, decay=4.0))
        t += d

    tr.add(t, chime(523.25, 1.6, gain=0.20))              # closer
    tr.add(t, pad([130.81, 196.00, 261.63], 2.0, gain=0.06))
    tr.add(t + 2.0, pad([174.61, 261.63, 349.23], 3.4, gain=0.055))
    tr.add(t + 2.15, sonic_logo())                        # outro / CTA — brand mark

def score_ep1(tr, dur):
    """Episode 1 — single prompt, then a long colouring section."""
    tr.add(0.0, pad([130.81, 196.00, 261.63], 3.2, gain=0.07))
    for i, ch in enumerate("Can it draw a triceratops?"):
        if ch != " ":
            tr.add(0.80 + i * 0.042, blip(1050 + (i % 4) * 120, gain=0.06))
    for k, ch in enumerate("a triceratops"):              # typing beat
        if ch != " ":
            tr.add(3.1 + k * 0.062, blip(980 + (k % 5) * 90, gain=0.06))
    tr.add(4.55, pop(gain=0.30))                          # Draw! pressed
    melody_bed(tr, 5.0, dur - 3.4, step=0.55)             # the colouring section
    tr.add(dur - 3.4, chime(523.25, 1.6, gain=0.20))
    tr.add(dur - 3.3, pad([174.61, 261.63, 349.23], 3.2, gain=0.05))
    tr.add(dur - 2.0, sonic_logo())                       # brand mark


def score_explain(tr, dur, hook_text, cap_times):
    """Episodes that explain a mechanic over real footage. The bed runs under
    the demo; a soft tick marks each caption change so the eye is pulled to the
    new instruction; the sonic logo closes."""
    tr.add(0.0, pad([130.81, 196.00, 261.63], 3.2, gain=0.07))
    for i, ch in enumerate(hook_text):
        if ch != " ":
            tr.add(0.70 + i * 0.040, blip(1050 + (i % 4) * 120, gain=0.06))
    melody_bed(tr, 2.4, dur - 3.4, step=0.62)
    for i, t in enumerate(cap_times):
        tr.add(t, pop(gain=0.26))
        tr.add(t, tone(PENT[min(i + 2, 7)], 0.8, gain=0.10, decay=4.5))
    tr.add(dur - 3.4, chime(523.25, 1.5, gain=0.18))
    tr.add(dur - 3.3, pad([174.61, 261.63, 349.23], 3.2, gain=0.05))
    tr.add(dur - 2.0, sonic_logo())

SCORES = {1: score_ep1, 2: score_ep2}

def build(ep):
    vid = os.path.join(SERIES, f"ep{ep:02d}.mp4")
    if not os.path.exists(vid):
        raise SystemExit(f"no such episode: {vid}")
    dur = float(subprocess.run(["ffprobe", "-v", "error", "-show_entries", "format=duration",
                                "-of", "csv=p=0", vid], capture_output=True, text=True).stdout)
    tr = Track(dur)
    if ep == 1:
        SCORES[1](tr, dur)
    elif ep == 2:
        SCORES[2](tr)
    elif ep == 3:
        score_explain(tr, dur, "Every picture comes numbered.", [2.4, 6.6, 13.8])
    elif ep == 4:
        score_explain(tr, dur, "Or ignore the numbers entirely.", [2.4, 9.6])
    else:
        raise SystemExit(f"no score for episode {ep}")
    wav = f"/tmp/ep{ep:02d}.wav"
    tr.write(wav)

    out = os.path.join(SERIES, f"ep{ep:02d}_sound.mp4")
    subprocess.run(["ffmpeg", "-v", "error", "-y", "-i", vid, "-i", wav,
                    "-c:v", "copy", "-c:a", "aac", "-b:a", "192k",
                    "-shortest", "-movflags", "+faststart", out], check=True)
    print(f"  {out}  ({dur:.1f}s)")
    return out

if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--episode", type=int, default=2)
    build(ap.parse_args().episode)
