$ErrorActionPreference = "Stop"

$root = Split-Path -Parent $PSScriptRoot
$icon = Join-Path $root "build\icon.ico"
$packagedSource = Join-Path $root "release\win-unpacked"
$installRoot = Join-Path $env:LOCALAPPDATA "Programs\WAKE Engine Omega"
$target = Join-Path $installRoot "WAKE Engine Omega.exe"
$desktopShortcut = Join-Path ([Environment]::GetFolderPath("Desktop")) "WAKE Engine Omega.lnk"
$publicDesktopShortcut = Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "WAKE Engine Omega.lnk"
$startMenuDir = Join-Path $env:APPDATA "Microsoft\Windows\Start Menu\Programs\WAKE Engine"
$startMenuShortcut = Join-Path $startMenuDir "WAKE Engine Omega.lnk"

# Remove legacy V6 shortcuts so the Desktop is not double-branded.
$legacyShortcuts = @(
  (Join-Path ([Environment]::GetFolderPath("Desktop")) "WAKE Engine V6.lnk"),
  (Join-Path ([Environment]::GetFolderPath("CommonDesktopDirectory")) "WAKE Engine V6.lnk"),
  (Join-Path $startMenuDir "WAKE Engine V6.lnk"),
  (Join-Path ([Environment]::GetFolderPath("Startup")) "WAKE Engine V6 Background.lnk")
)
foreach ($legacy in $legacyShortcuts) {
  if (Test-Path -LiteralPath $legacy) {
    try { Remove-Item -LiteralPath $legacy -Force } catch { Write-Warning "Could not remove legacy shortcut: $legacy" }
  }
}
$legacyInstall = Join-Path $env:LOCALAPPDATA "Programs\Wake Engine V6"
if (Test-Path -LiteralPath $legacyInstall) {
  try { Remove-Item -LiteralPath $legacyInstall -Recurse -Force } catch { Write-Warning "Could not remove legacy install folder." }
}

New-Item -ItemType Directory -Force -Path $startMenuDir | Out-Null
if (-not (Test-Path -LiteralPath (Join-Path $packagedSource "WAKE Engine Omega.exe"))) {
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
    $shortcut.Description = "Launch WAKE Engine Omega desktop app"
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

Write-Host "WAKE Engine Omega shortcuts installed:"
foreach ($shortcutPath in $installedShortcuts) {
  Write-Host "  $shortcutPath"
}

try {
  $startupShortcut = Join-Path ([Environment]::GetFolderPath("Startup")) "WAKE Engine Omega Background.lnk"
  $shortcut = $shell.CreateShortcut($startupShortcut)
  $shortcut.TargetPath = $target
  $shortcut.Arguments = "--background"
  $shortcut.WorkingDirectory = $workingDirectory
  $shortcut.Description = "Launch WAKE Engine Omega Background Scheduler"
  if (Test-Path -LiteralPath $icon) {
    $shortcut.IconLocation = $icon
  } else {
    $shortcut.IconLocation = "$target,0"
  }
  $shortcut.Save()
  Write-Host "  $startupShortcut (Background mode)"
} catch {
  Write-Warning "Could not create startup shortcut: $($_.Exception.Message)"
}
