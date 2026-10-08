#!/usr/bin/env python3
"""Cut five 9:16 reels from a 16:9 talk video, with captions.

One command does everything:
  python make_reels.py

  1. downloads the video and its Hindi captions with yt-dlp (skipped if
     --video / --subs are given),
  2. finds each moment's exact start/end by matching the anchor phrases in
     moments.json against the caption words,
  3. renders out/<id>.mp4.

Layout (1080x1920, black background):
  - the 16:9 picture is scaled to 120% of the fit-width size
    (1080x608 -> 1296x728) and center-cropped to 1080 wide; it stays a band
    in the middle and is NOT stretched to fill the 9:16 frame.
  - captions sit at the bottom of that band, 4-5 words at a time,
    PP Neue Montreal Bold, size 40.

Needs: Python 3.9+, ffmpeg (with libass) on PATH, `pip install yt-dlp`.
Put PPNeueMontreal-Bold.otf in ./fonts (or install it system-wide).
"""
import argparse
import difflib
import json
import math
import os
import re
import shutil
import subprocess
import sys
from pathlib import Path

HERE = Path(__file__).resolve().parent
W, H = 1080, 1920
ZOOM = 1.20
VID_W = round(W * ZOOM / 2) * 2                 # 1296
VID_H = round(W * 9 / 16 * ZOOM / 2) * 2        # 729 -> 728 (even)
VID_Y = (H - VID_H) // 2                        # top of the video band
FONT_FAMILY = "PP Neue Montreal"
FONT_SIZE = 40
CAPTION_GAP = 28                                # px above the band's bottom edge
WORDS_MIN, WORDS_MAX = 4, 5
PAD_BEFORE, PAD_AFTER = 0.25, 0.6               # seconds around the anchors


def run(cmd, **kw):
    print("  $ " + " ".join(str(c) for c in cmd[:6]) + (" ..." if len(cmd) > 6 else ""))
    subprocess.run(cmd, check=True, **kw)


# ------------------------------------------------------------ download

def download(url, workdir):
    workdir.mkdir(parents=True, exist_ok=True)
    video = workdir / "source.mp4"
    if not video.exists():
        run([sys.executable, "-m", "yt_dlp", "-f", "bv*[height<=1080]+ba/b",
             "--merge-output-format", "mp4", "-o", str(video), url])
    subs = sorted(workdir.glob("source*.json3"))
    if not subs:
        subprocess.run([sys.executable, "-m", "yt_dlp", "--skip-download",
                        "--write-subs", "--write-auto-subs", "--sub-langs", "hi.*,hi",
                        "--sub-format", "json3", "-o", str(workdir / "source"), url])
        subs = sorted(workdir.glob("source*.json3"))
    return video, (subs[0] if subs else None)


# ------------------------------------------------------------ source words

def words_from_json3(path):
    """[(word, start, end)] from a YouTube json3 caption file."""
    data = json.loads(Path(path).read_text(encoding="utf-8"))
    out = []
    for ev in data.get("events", []):
        if "segs" not in ev or ev.get("aAppend"):
            continue
        t0 = ev.get("tStartMs", 0)
        for seg in ev["segs"]:
            for w in seg.get("utf8", "").split():
                out.append([w, (t0 + seg.get("tOffsetMs", 0)) / 1000, None])
    out.sort(key=lambda x: x[1])
    for i, w in enumerate(out):
        nxt = out[i + 1][1] if i + 1 < len(out) else w[1] + 0.5
        w[2] = min(nxt, w[1] + 1.5)
    return [tuple(w) for w in out]


def words_from_whisper(video, model_name):
    from faster_whisper import WhisperModel
    print(f"  transcribing with faster-whisper '{model_name}' (slow on CPU)...")
    model = WhisperModel(model_name, device="cpu", compute_type="int8")
    segs, _ = model.transcribe(str(video), language="hi", word_timestamps=True,
                               vad_filter=True)
    return [(w.word.strip(), w.start, w.end) for s in segs for w in (s.words or [])]


# ------------------------------------------------------------ anchor matching

def norm(s):
    s = s.replace("़", "").replace("ँ", "ं")      # nukta, chandrabindu
    s = re.sub(r"[^\wऀ-ॿ]+", " ", s)
    return re.sub(r"\s+", " ", s).strip().lower()


def find_phrase(words, phrase, t_min, t_max):
    """Index range of the window that best matches `phrase` within [t_min, t_max]."""
    target = norm(phrase)
    n = len(target.split())
    keys = [norm(w[0]) for w in words]
    best, best_i = 0.0, None
    for i, w in enumerate(words):
        if w[1] < t_min or w[1] > t_max:
            continue
        cand = " ".join(keys[i:i + n])
        r = difflib.SequenceMatcher(None, cand, target).ratio()
        if r > best:
            best, best_i = r, i
    return best_i, n, best


def locate(words, m, search_after):
    i, n, r1 = find_phrase(words, m["anchor_start"], search_after, 1e9)
    if i is None or r1 < 0.6:
        raise SystemExit(f"{m['id']}: start phrase not found (best match {r1:.2f})")
    start = words[i][1]
    j, k, r2 = find_phrase(words, m["anchor_end"], start, start + 240)
    if j is None or r2 < 0.6:
        raise SystemExit(f"{m['id']}: end phrase not found (best match {r2:.2f})")
    last = min(j + k - 1, len(words) - 1)
    print(f"  {m['id']}: {start:.1f}s -> {words[last][2]:.1f}s  "
          f"(match {r1:.2f}/{r2:.2f})")
    return i, last


# ------------------------------------------------------------ captions

def chunk(words):
    """Split into 4-5 word groups, never crossing a sentence end."""
    groups, sent = [], []
    for i, w in enumerate(words):
        sent.append(i)
        if re.search(r"[.?!]$", w) or i == len(words) - 1:
            k = max(1, math.ceil(len(sent) / WORDS_MAX))
            if len(sent) / k < WORDS_MIN and k > 1:
                k -= 1
            size, extra = divmod(len(sent), k)
            pos = 0
            for g in range(k):
                n = size + (1 if g < extra else 0)
                groups.append(sent[pos:pos + n])
                pos += n
            sent = []
    return groups


def caption_times(script_words, src_words, offset):
    """Spread the romanised words over the timed source words, in order."""
    n = len(src_words)

    def at(frac):
        x = frac * n
        j = min(int(x), n - 1)
        s, e = src_words[j][1], src_words[j][2]
        return s + (e - s) * (x - j) - offset

    m = len(script_words)
    return [at(i / m) for i in range(m)], src_words[-1][2] - offset


def ass_time(t):
    cs = max(0, round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def write_ass(path, words, times, speech_end, family):
    margin_v = H - (VID_Y + VID_H) + CAPTION_GAP
    lines = [
        "[Script Info]", "ScriptType: v4.00+",
        f"PlayResX: {W}", f"PlayResY: {H}", "WrapStyle: 2",
        "ScaledBorderAndShadow: yes", "",
        "[V4+ Styles]",
        "Format: Name, Fontname, Fontsize, PrimaryColour, SecondaryColour, "
        "OutlineColour, BackColour, Bold, Italic, Underline, StrikeOut, "
        "ScaleX, ScaleY, Spacing, Angle, BorderStyle, Outline, Shadow, "
        "Alignment, MarginL, MarginR, MarginV, Encoding",
        f"Style: Cap,{family},{FONT_SIZE},&H00FFFFFF,&H00FFFFFF,"
        f"&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,60,60,{margin_v},1",
        "", "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text",
    ]
    groups = chunk(words)
    for gi, g in enumerate(groups):
        start = times[g[0]]
        end = times[groups[gi + 1][0]] if gi + 1 < len(groups) else speech_end + 0.3
        text = " ".join(words[i] for i in g)
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Cap,,0,0,0,,{text}")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(groups)


# ------------------------------------------------------------ render

def font_family(fonts_dir):
    files = [p for p in fonts_dir.glob("*") if "montreal" in p.name.lower()]
    if not files:
        print(f"WARNING: no PP Neue Montreal file in {fonts_dir}. Using an installed "
              "copy if there is one, otherwise ffmpeg substitutes another font.")
        return FONT_FAMILY
    if shutil.which("fc-scan"):
        out = subprocess.run(["fc-scan", "--format", "%{family[0]}", str(files[0])],
                             capture_output=True, text=True).stdout.strip()
        if out:
            return out
    return FONT_FAMILY


def render(video, start, dur, ass, fonts_dir, dst):
    # Run from the output folder with relative paths: avoids ffmpeg filter
    # escaping problems with Windows drive letters.
    out_dir = dst.parent
    fonts_rel = os.path.relpath(fonts_dir, out_dir).replace("\\", "/")
    vf = (f"[0:v]scale={VID_W}:{VID_H}:flags=lanczos,crop={W}:{VID_H},setsar=1[v];"
          f"color=black:s={W}x{H}:r=30[bg];"
          f"[bg][v]overlay=0:{VID_Y}:shortest=1,"
          f"ass={ass.name}:fontsdir={fonts_rel},fps=30[out]")
    run(["ffmpeg", "-y", "-hide_banner", "-loglevel", "error",
         "-ss", f"{start:.3f}", "-t", f"{dur:.3f}", "-i", str(Path(video).resolve()),
         "-filter_complex", vf, "-map", "[out]", "-map", "0:a?",
         "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
         "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", dst.name],
        cwd=out_dir)


def main():
    p = argparse.ArgumentParser(description=__doc__.split("\n")[0])
    p.add_argument("--moments", default=str(HERE / "moments.json"))
    p.add_argument("--video", help="local source video (skips the download)")
    p.add_argument("--subs", help="YouTube json3 caption file for --video")
    p.add_argument("--whisper-model", default="small",
                   help="used only when no captions are available")
    p.add_argument("--fonts-dir", default=str(HERE / "fonts"))
    p.add_argument("--out", default=str(HERE / "out"))
    p.add_argument("--only", nargs="*", help="moment ids to render")
    a = p.parse_args()

    if not shutil.which("ffmpeg"):
        raise SystemExit("ffmpeg not found on PATH (https://ffmpeg.org/download.html)")
    cfg = json.loads(Path(a.moments).read_text(encoding="utf-8"))
    out_dir = Path(a.out).resolve()
    out_dir.mkdir(parents=True, exist_ok=True)
    fonts_dir = Path(a.fonts_dir).resolve()
    fonts_dir.mkdir(parents=True, exist_ok=True)
    family = font_family(fonts_dir)

    print("1/3 source")
    if a.video:
        video, subs = Path(a.video), (Path(a.subs) if a.subs else None)
    else:
        video, subs = download(cfg["source"], out_dir / "_source")
    if subs:
        print(f"  captions: {subs.name}")
        words = words_from_json3(subs)
    else:
        print("  no YouTube captions found, falling back to whisper")
        words = words_from_whisper(video, a.whisper_model)

    print("2/3 locating moments")
    plan = []
    for m in cfg["moments"]:
        if a.only and m["id"] not in a.only:
            continue
        i, j = locate(words, m, cfg.get("search_after", 0))
        plan.append((m, i, j))

    print("3/3 rendering")
    for m, i, j in plan:
        start = max(0.0, words[i][1] - PAD_BEFORE)
        end = words[j][2] + PAD_AFTER
        script = m["script"].split()
        times, speech_end = caption_times(script, words[i:j + 1], start)
        ass = out_dir / f"{m['id']}.ass"
        n = write_ass(ass, script, times, speech_end, family)
        dst = out_dir / f"{m['id']}.mp4"
        render(video, start, end - start, ass, fonts_dir, dst)
        print(f"  -> {dst}  ({end - start:.1f}s, {n} captions)")
    print(f"\nDone. Reels are in {out_dir}")


if __name__ == "__main__":
    main()
