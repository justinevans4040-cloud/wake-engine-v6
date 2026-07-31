@echo off
setlocal
set "WAKE_V6_ROOT=C:\Users\justi\Documents\repos\wake-engine"
set "WAKE_V6_EXE=%WAKE_V6_ROOT%\release\win-unpacked\WAKE Engine V6.exe"
cd /d "%WAKE_V6_ROOT%"
if exist "%WAKE_V6_EXE%" (
  start "" "%WAKE_V6_EXE%"
  exit /b 0
)
start "" "%WAKE_V6_ROOT%\node_modules\electron\dist\electron.exe" "%WAKE_V6_ROOT%"
