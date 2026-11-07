# Build Windows installers (MSI + NSIS). Usage: npm run pack:win
$ErrorActionPreference = "Stop"

$ScriptDir = $PSScriptRoot
if ([string]::IsNullOrEmpty($ScriptDir)) {
  $ScriptDir = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$Root = Split-Path -Parent $ScriptDir
if ([string]::IsNullOrEmpty($Root)) {
  throw "Cannot resolve project root"
}
Set-Location $Root

function Find-VcVars64 {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path -LiteralPath $vswhere) {
    $vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($vs) {
      $candidate = Join-Path $vs "VC\Auxiliary\Build\vcvars64.bat"
      if (Test-Path -LiteralPath $candidate) { return $candidate }
    }
  }
  $fallback = "F:\softDing\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat"
  if (Test-Path -LiteralPath $fallback) { return $fallback }
  return $null
}

$vcvars = Find-VcVars64
if (-not $vcvars) {
  throw "vcvars64.bat not found. Install VS Build Tools (C++)."
}

Write-Host "MSVC: $vcvars"

Get-Process -Name "hiprint-v2" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$nsisWork = Join-Path $Root "src-tauri\target\release\nsis"
$nsisOut = Join-Path $Root "src-tauri\target\release\bundle\nsis"
if (Test-Path -LiteralPath $nsisWork) {
  Remove-Item -LiteralPath $nsisWork -Recurse -Force -ErrorAction SilentlyContinue
}
if (Test-Path -LiteralPath $nsisOut) {
  Remove-Item -LiteralPath $nsisOut -Recurse -Force -ErrorAction SilentlyContinue
}

$bat = Join-Path $env:TEMP "hprint-pack-win.bat"
@(
  "@echo off"
  "call `"$vcvars`""
  "if errorlevel 1 exit /b 1"
  "cd /d `"$Root`""
  "if errorlevel 1 exit /b 1"
  "npx tauri build --bundles msi,nsis"
  "exit /b %ERRORLEVEL%"
) | Set-Content -LiteralPath $bat -Encoding ASCII

Write-Host "Building MSI + NSIS ..."
cmd.exe /c "`"$bat`""
$code = $LASTEXITCODE
Remove-Item -LiteralPath $bat -Force -ErrorAction SilentlyContinue
if ($code -ne 0) { exit $code }

Write-Host ""
Write-Host "Done. Installers:"
$msiDir = Join-Path $Root "src-tauri\target\release\bundle\msi"
$nsisDir = Join-Path $Root "src-tauri\target\release\bundle\nsis"
Get-ChildItem -LiteralPath $msiDir, $nsisDir -Recurse -File -ErrorAction SilentlyContinue |
  Format-Table FullName, Length, LastWriteTime -AutoSize
