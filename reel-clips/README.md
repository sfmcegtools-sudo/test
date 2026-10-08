# Reel clips

Five 9:16 reels cut from https://www.youtube.com/watch?v=Sm8pQocz_v0:

| file | moment |
|---|---|
| `01-ai-knows-you.mp4` | AI knows you better than your family |
| `02-five-years-experience.mp4` | Only you will have 5 years of AI experience |
| `03-health-reports.mp4` | Companies will ask for your health reports |
| `04-humans-think-like-ai.mp4` | The real crisis: humans thinking like AI |
| `05-desire-vs-deserve.mp4` | Desire vs deserve |

- **Size:** 1080x1920 with a black background.
- **Picture:** the 16:9 video is scaled to 120% (1296x728) and center-cropped to 1080 wide. It stays a band in the middle and is not stretched to fill the frame.
- **Captions:** at the bottom of the video picture, 4-5 words at a time, PP Neue Montreal Bold at size 40, in romanised Hinglish.

## Make the reels on your computer

1. Install **Python 3.9+** and **ffmpeg**, and make sure `ffmpeg` runs from a terminal. On macOS use `brew install ffmpeg`. On Windows use `winget install ffmpeg`.
2. Copy `PPNeueMontreal-Bold.otf` into `reel-clips/fonts/`. The font is licensed from Pangram Pangram, so it isn't included here.
3. Run the script:
   - On Windows, double-click `run.bat`.
   - On macOS or Linux, run `./run.sh`.

The script downloads the video and its YouTube captions and finds the exact cut points from the captions. It then renders the five reels into `reel-clips/out/`.

Options:
- `--only 03-health-reports` renders just one reel.
- `--video file.mp4` uses a video you already have.

The cut points come from the phrases in `moments.json`, and so does the caption text. If YouTube has no captions for the video, the script falls back to `faster-whisper`, which needs `pip install faster-whisper`.
