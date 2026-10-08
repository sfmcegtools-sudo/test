#!/usr/bin/env python3
"""Cut 9:16 reels from a 16:9 talk video.

Layout (1080x1920 canvas, black background):
  - the 16:9 source is scaled to 120% of the "fit width" size
    (1080x608 -> 1296x729) and center-cropped to 1080 wide, so the two
    speakers fill the width; it is NOT stretched to fill the 9:16 frame.
  - captions sit at the bottom of that video band, 4-5 words at a time,
    PP Neue Montreal Bold, size 40.

Usage:
  python3 make_reels.py locate  --video src.mp4 --moments moments.json
  python3 make_reels.py render  --video src.mp4 --moments moments.json \
        --fonts-dir fonts --out out
"""
import argparse
import json
import math
import re
import subprocess
import sys
import tempfile
from pathlib import Path

W, H = 1080, 1920
ZOOM = 1.20
VID_W = round(W * ZOOM / 2) * 2                 # 1296
VID_H = round(W * 9 / 16 * ZOOM / 2) * 2        # 729 -> 728 (even)
VID_Y = (H - VID_H) // 2                        # top of the video band
FONT_NAME = "PP Neue Montreal"
FONT_SIZE = 40
CAPTION_GAP = 28                                # px above the band's bottom edge
WORDS_MIN, WORDS_MAX = 4, 5


def run(cmd, **kw):
    return subprocess.run(cmd, check=True, text=True, capture_output=True, **kw)


# ---------------------------------------------------------------- timing

def whisper_words(wav, model_name):
    """Word timestamps from faster-whisper, or None if unavailable."""
    try:
        from faster_whisper import WhisperModel
        model = WhisperModel(model_name, device="cpu", compute_type="int8")
    except Exception as e:  # model download blocked, package missing, ...
        print(f"  whisper unavailable ({e.__class__.__name__}); "
              "falling back to voice-activity timing", file=sys.stderr)
        return None
    segs, _ = model.transcribe(str(wav), language="hi", word_timestamps=True,
                               vad_filter=True)
    words = [(w.start, w.end) for s in segs for w in (s.words or [])]
    return words or None


def voiced_intervals(wav, dur):
    """Speech intervals = complement of ffmpeg silencedetect output."""
    out = subprocess.run(
        ["ffmpeg", "-hide_banner", "-i", str(wav), "-af",
         "silencedetect=noise=-32dB:d=0.25", "-f", "null", "-"],
        text=True, capture_output=True).stderr
    starts = [float(x) for x in re.findall(r"silence_start: ([\d.]+)", out)]
    ends = [float(x) for x in re.findall(r"silence_end: ([\d.]+)", out)]
    spans, t = [], 0.0
    for s, e in zip(starts, ends + [dur] * (len(starts) - len(ends))):
        if s > t:
            spans.append((t, s))
        t = e
    if t < dur:
        spans.append((t, dur))
    return [(a, b) for a, b in spans if b - a > 0.05] or [(0.0, dur)]


def timeline_from_spans(spans):
    """Map a 0..1 'progress through the speech' fraction to a clip time."""
    total = sum(b - a for a, b in spans)

    def at(frac):
        left = frac * total
        for a, b in spans:
            if left <= b - a:
                return a + left
            left -= b - a
        return spans[-1][1]
    return at


def word_times(words, wav, dur, model_name):
    """Start time of every script word, spread by character weight."""
    ww = whisper_words(wav, model_name) if model_name else None
    spans = ww if ww else voiced_intervals(wav, dur)
    at = timeline_from_spans(spans)
    weights = [len(w) + 1 for w in words]
    total = sum(weights)
    times, acc = [], 0
    for wt in weights:
        times.append(at(acc / total))
        acc += wt
    return times, at(1.0)


# ---------------------------------------------------------------- captions

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


def ass_time(t):
    cs = max(0, round(t * 100))
    return f"{cs // 360000}:{cs // 6000 % 60:02d}:{cs // 100 % 60:02d}.{cs % 100:02d}"


def write_ass(path, words, times, speech_end):
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
        f"Style: Cap,{FONT_NAME},{FONT_SIZE},&H00FFFFFF,&H00FFFFFF,"
        f"&H00000000,&H80000000,-1,0,0,0,100,100,0,0,1,3,1,2,60,60,{margin_v},1",
        "", "[Events]",
        "Format: Layer, Start, End, Style, Name, MarginL, MarginR, MarginV, "
        "Effect, Text",
    ]
    groups = chunk(words)
    for gi, g in enumerate(groups):
        start = times[g[0]]
        end = times[groups[gi + 1][0]] if gi + 1 < len(groups) else speech_end + 0.4
        text = " ".join(words[i] for i in g)
        lines.append(f"Dialogue: 0,{ass_time(start)},{ass_time(end)},Cap,,0,0,0,,{text}")
    Path(path).write_text("\n".join(lines) + "\n", encoding="utf-8")
    return len(groups)


# ---------------------------------------------------------------- commands

def extract_wav(video, start, dur, wav):
    run(["ffmpeg", "-y", "-hide_banner", "-ss", str(start), "-t", str(dur),
         "-i", str(video), "-vn", "-ac", "1", "-ar", "16000", str(wav)])


def cmd_locate(a):
    """Print timestamped speech around each moment's approx_start."""
    from faster_whisper import WhisperModel
    model = WhisperModel(a.whisper_model, device="cpu", compute_type="int8")
    for m in json.loads(Path(a.moments).read_text())["moments"]:
        s0 = max(0, m["approx_start"] - a.window)
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / "w.wav"
            extract_wav(a.video, s0, 2 * a.window + 90, wav)
            segs, _ = model.transcribe(str(wav), language="hi", vad_filter=True)
            print(f"\n=== {m['id']}  ({m['anchor_start']} ... {m['anchor_end']})")
            for s in segs:
                print(f"  {s0 + s.start:8.1f} - {s0 + s.end:8.1f}  {s.text.strip()}")


def cmd_render(a):
    fonts_dir = Path(a.fonts_dir).resolve()
    if not any(fonts_dir.glob("*Montreal*")):
        print(f"WARNING: no PP Neue Montreal file in {fonts_dir}; libass will "
              "substitute another font", file=sys.stderr)
    out = Path(a.out)
    out.mkdir(parents=True, exist_ok=True)
    fps = run(["ffprobe", "-v", "error", "-select_streams", "v:0", "-show_entries",
               "stream=r_frame_rate", "-of", "csv=p=0", str(a.video)]).stdout.strip()
    for m in json.loads(Path(a.moments).read_text())["moments"]:
        if a.only and m["id"] not in a.only:
            continue
        if m.get("start") is None or m.get("end") is None:
            print(f"skip {m['id']}: start/end not set", file=sys.stderr)
            continue
        dur = m["end"] - m["start"]
        words = m["script"].split()
        with tempfile.TemporaryDirectory() as td:
            wav = Path(td) / "a.wav"
            extract_wav(a.video, m["start"], dur, wav)
            times, speech_end = word_times(words, wav, dur, a.whisper_model)
            ass = out / f"{m['id']}.ass"
            n = write_ass(ass, words, times, min(speech_end, dur - 0.4))
        vf = (f"[0:v]scale={VID_W}:{VID_H}:flags=lanczos,crop={W}:{VID_H},setsar=1[v];"
              f"color=black:s={W}x{H}:r={fps}[bg];"
              f"[bg][v]overlay=0:{VID_Y}:shortest=1,"
              f"ass={ass}:fontsdir={fonts_dir}[out]")
        dst = out / f"{m['id']}.mp4"
        run(["ffmpeg", "-y", "-hide_banner", "-ss", str(m["start"]), "-t", str(dur),
             "-i", str(a.video), "-filter_complex", vf, "-map", "[out]", "-map", "0:a?",
             "-c:v", "libx264", "-preset", "medium", "-crf", "18", "-pix_fmt", "yuv420p",
             "-c:a", "aac", "-b:a", "192k", "-movflags", "+faststart", str(dst)])
        print(f"{dst}  {dur:.1f}s  {n} caption chunks")


def main():
    p = argparse.ArgumentParser()
    sub = p.add_subparsers(dest="cmd", required=True)
    for name in ("locate", "render"):
        s = sub.add_parser(name)
        s.add_argument("--video", required=True)
        s.add_argument("--moments", default=str(Path(__file__).with_name("moments.json")))
        s.add_argument("--whisper-model", default="small")
    sub.choices["locate"].add_argument("--window", type=int, default=150)
    r = sub.choices["render"]
    r.add_argument("--fonts-dir", default=str(Path(__file__).with_name("fonts")))
    r.add_argument("--out", default="out")
    r.add_argument("--only", nargs="*")
    a = p.parse_args()
    {"locate": cmd_locate, "render": cmd_render}[a.cmd](a)


if __name__ == "__main__":
    main()
