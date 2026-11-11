@echo off
rem Double-click to run the demo on this laptop (see run_demo.ps1).
powershell -NoProfile -ExecutionPolicy Bypass -File "%~dp0run_demo.ps1" %*
pause
