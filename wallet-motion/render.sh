#!/usr/bin/env bash
# Full pipeline: Playwright subframe dump → FFmpeg 4-subframe motion blur → H.264.
#   ./render.sh                         # full 8.0 s (480 frames × 4 subframes)
#   START=255 END=284 NAME=test OUT=.tmp ./render.sh   # quick 0.5 s partial render into .tmp/
#   SKIP_DUMP=1 ./render.sh             # re-encode existing out/frames only
set -euo pipefail
cd "$(dirname "$0")"

START=${START:-0}
END=${END:-479}
SUB=4
NAME=${NAME:-wallet-motion}
OUT=${OUT:-out}                 # e.g. OUT=.tmp for scratch test renders
FRAMES=${FRAMES:-$OUT/frames}
mkdir -p "$OUT"

if [[ -z "${SKIP_DUMP:-}" ]]; then
  rm -rf "$FRAMES"
  node render.js --start "$START" --end "$END" --sub "$SUB" --out "$FRAMES"
fi

EXPECTED=$(( END - START + 1 ))

# tmix averages the current subframe with the 3 before it, so the output frame that equals the
# mean of subframes 4f..4f+3 is tmix's output at n = 4f+3  →  select n mod 4 == 3.
# (verified: with not(mod(n,4)) frame f would mix subframes 4f-3..4f, i.e. 3/4 of a frame late.)
VF="tmix=frames=4:weights='1 1 1 1',select='eq(mod(n\,4)\,3)',setpts=N/60/TB"
COLOR="-colorspace bt709 -color_primaries bt709 -color_trc bt709 -color_range tv"

ffmpeg -hide_banner -loglevel warning -y \
  -framerate 240 -start_number $(( START * SUB )) -i "$FRAMES/sub_%05d.png" \
  -vf "$VF,scale=out_color_matrix=bt709:out_range=tv,format=yuv420p" \
  -r 60 -c:v libx264 -pix_fmt yuv420p -crf 16 -preset slow $COLOR \
  -movflags +faststart "$OUT/$NAME.mp4"

ffmpeg -hide_banner -loglevel warning -y -i "$OUT/$NAME.mp4" \
  -vf "scale=540:960:flags=lanczos" \
  -c:v libx264 -pix_fmt yuv420p -crf 28 -preset slow $COLOR \
  -movflags +faststart "$OUT/$NAME-preview.mp4"

N=$(ffprobe -v error -select_streams v:0 -count_frames -show_entries stream=nb_read_frames -of csv=p=0 "$OUT/$NAME.mp4")
INFO=$(ffprobe -v error -select_streams v:0 -show_entries stream=width,height,r_frame_rate -show_entries format=duration -of csv=p=0 "$OUT/$NAME.mp4" | tr '\n' ' ')
echo "$OUT/$NAME.mp4: $N frames (expected $EXPECTED) — $INFO"
if [[ "$N" != "$EXPECTED" ]]; then echo "frame count mismatch" >&2; exit 1; fi
echo "$OUT/$NAME-preview.mp4 written"
