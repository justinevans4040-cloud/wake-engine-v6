@echo off
setlocal
set "WAKE_V6_ROOT=C:\Users\justi\WORKSPACE\Active_Projects\wake-engine-v6"
set "WAKE_V6_EXE=%LOCALAPPDATA%\Programs\Wake Engine V6\WAKE Engine V6.exe"
cd /d "%WAKE_V6_ROOT%"
if exist "%WAKE_V6_EXE%" (
  start "" "%WAKE_V6_EXE%"
  exit /b 0
)
if exist "%WAKE_V6_ROOT%\release\win-unpacked\WAKE Engine V6.exe" (
  start "" "%WAKE_V6_ROOT%\release\win-unpacked\WAKE Engine V6.exe"
  exit /b 0
)
start "" "%WAKE_V6_ROOT%\node_modules\electron\dist\electron.exe" "%WAKE_V6_ROOT%"
