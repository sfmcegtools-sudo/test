@echo off
REM Windows: double-click or run "run.bat"
cd /d "%~dp0"
python -m pip install --upgrade yt-dlp
python make_reels.py %*
pause
