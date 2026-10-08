# Reel clips

Five vertical reels (1080x1920) cut from https://www.youtube.com/watch?v=Sm8pQocz_v0.

- The 16:9 picture is scaled to 120% of fit-width (1296x728) and center-cropped to 1080 wide. It stays a band in the middle of a black frame and is not stretched to fill 9:16.
- Captions sit at the bottom of that band, 4-5 words at a time, in PP Neue Montreal Bold at size 40.
- The moments and their caption text are in `moments.json`. They were picked from the vidIQ transcript.

## Run

```sh
pip install yt-dlp faster-whisper
yt-dlp -f "bv*[height<=1080]+ba/b" --merge-output-format mp4 -o src.mp4 "https://www.youtube.com/watch?v=Sm8pQocz_v0"
# put PPNeueMontreal-Bold.otf in fonts/ (licensed from Pangram Pangram, so it is not committed)
python3 make_reels.py locate --video src.mp4   # timestamped speech around each moment
# write the exact start/end seconds into moments.json, then:
python3 make_reels.py render --video src.mp4 --out out
```

Caption timing uses faster-whisper word timestamps when the model can be downloaded. Otherwise the captions are spread across the detected speech.
