@echo off
setlocal
set "WAKE_ROOT=C:\Users\justi\WORKSPACE\Active_Projects\wake-engine-v6"
set "WAKE_EXE=%LOCALAPPDATA%\Programs\WAKE Engine Omega\WAKE Engine Omega.exe"
cd /d "%WAKE_ROOT%"
if exist "%WAKE_EXE%" (
  start "" "%WAKE_EXE%"
  exit /b 0
)
if exist "%WAKE_ROOT%\release\win-unpacked\WAKE Engine Omega.exe" (
  start "" "%WAKE_ROOT%\release\win-unpacked\WAKE Engine Omega.exe"
  exit /b 0
)
rem Legacy V6 install path (pre-Omega rename)
if exist "%LOCALAPPDATA%\Programs\Wake Engine V6\WAKE Engine V6.exe" (
  start "" "%LOCALAPPDATA%\Programs\Wake Engine V6\WAKE Engine V6.exe"
  exit /b 0
)
start "" "%WAKE_ROOT%\node_modules\electron\dist\electron.exe" "%WAKE_ROOT%"
