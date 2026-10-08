#!/usr/bin/env sh
# macOS / Linux: ./run.sh
cd "$(dirname "$0")"
python3 -m pip install --upgrade yt-dlp && python3 make_reels.py "$@"
