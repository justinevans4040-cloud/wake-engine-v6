$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$icon = Join-Path $root "build\icon.ico"
$packagedSource = Join-Path $root "release\win-unpacked"
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\Wake Engine V6"
$target = Join-Path $installRoot "WAKE Engine V6.exe"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "WAKE Engine V6.lnk"
$publicDesktopShortcut = Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "WAKE Engine V6.lnk"
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\WAKE Engine"
$startMenuShortcut = Join-Path $startMenuDir "WAKE Engine V6.lnk"

New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $packagedSource "WAKE Engine V6.exe"))) {
  & npm run package:win
  if ($LASTEXITCODE -ne 0) { throw "Wake packaged build failed." }
}

$resolvedInstallParent = [IO.Path]::GetFullPath((Split-Path -Parent $installRoot))
$resolvedLocalPrograms = [IO.Path]::GetFullPath((Join-Path $env:LOCALAPPDATA "Programs"))
if (-not $resolvedInstallParent.StartsWith($resolvedLocalPrograms, [StringComparison]::OrdinalIgnoreCase)) {
  throw "Refusing to install outside the current user's local Programs directory."
}
if (Test-Path -LiteralPath $installRoot) { Remove-Item -LiteralPath $installRoot -Recurse -Force }
New-Item -ItemType Directory -Force -Path $installRoot | Out-Null
Copy-Item -Path (Join-Path $packagedSource "*") -Destination $installRoot -Recurse -Force
if (-not (Test-Path -LiteralPath $target)) { throw "Packaged Wake executable was not installed." }
$arguments = ""
$workingDirectory = $installRoot

$shortcutPaths = @($desktopShortcut, $startMenuShortcut)
$publicDesktop = Split-Path $publicDesktopShortcut -Parent
if (Test-Path -LiteralPath $publicDesktop) {
  $shortcutPaths += $publicDesktopShortcut
}

$shell = New-Object -ComObject WScript.Shell
$installedShortcuts = @()
foreach ($shortcutPath in $shortcutPaths) {
  try {
    $shortcut = $shell.CreateShortcut($shortcutPath)
    $shortcut.TargetPath = $target
    $shortcut.Arguments = $arguments
    $shortcut.WorkingDirectory = $workingDirectory
    $shortcut.Description = "Launch WAKE Engine V6 desktop app"
    if (Test-Path -LiteralPath $icon) {
      $shortcut.IconLocation = $icon
    } else {
      $shortcut.IconLocation = "$target,0"
    }
    $shortcut.Save()
    $installedShortcuts += $shortcutPath
  } catch [System.UnauthorizedAccessException] {
    if ($shortcutPath -ne $publicDesktopShortcut) {
      throw
    }
    Write-Warning "Skipped the optional public desktop shortcut because this user cannot write to it."
  }
}

Write-Host "WAKE Engine V6 shortcuts installed:"
foreach ($shortcutPath in $installedShortcuts) {
  Write-Host "  $shortcutPath"
}

try {
  $startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "WAKE Engine V6 Background.lnk"
  $shortcut = $shell.CreateShortcut($startupShortcut)
  $shortcut.TargetPath = $target
  $shortcut.Arguments = "--background"
  $shortcut.WorkingDirectory = $workingDirectory
  $shortcut.Description = "Launch WAKE Engine V6 Background Scheduler"
  if (Test-Path -LiteralPath $icon) {
    $shortcut.IconLocation = $icon
  } else {
    $shortcut.IconLocation = "$target,0"
  }
  $shortcut.Save()
  Write-Host "  $startupShortcut (Background mode)"
} catch {
  Write-Warning "Failed to install startup shortcut."
}
