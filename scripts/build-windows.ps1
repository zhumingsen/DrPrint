# 描述: Windows 打安装包（MSI + NSIS setup.exe）
# 用法:
#   npm run pack:win
#   powershell -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1

$ErrorActionPreference = "Stop"
if (-not $PSScriptRoot) {
  $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$Root = Split-Path -Parent $PSScriptRoot
if (-not $Root) { Write-Error "无法定位项目根目录" }
Set-Location $Root

function Find-VcVars64 {
  $vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
  if (Test-Path $vswhere) {
    $vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
    if ($vs) {
      $candidate = Join-Path $vs "VC\Auxiliary\Build\vcvars64.bat"
      if (Test-Path $candidate) { return $candidate }
    }
  }
  $fallback = "F:\softDing\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat"
  if (Test-Path $fallback) { return $fallback }
  return $null
}

$vcvars = Find-VcVars64
if (-not $vcvars) {
  Write-Error "未找到 vcvars64.bat，请安装 Visual Studio Build Tools (C++)"
}

Write-Host "使用 MSVC: $vcvars"

# 避免 exe 被占用导致 clean/link 失败
Get-Process -Name "hiprint-v2" -ErrorAction SilentlyContinue | Stop-Process -Force -ErrorAction SilentlyContinue
Start-Sleep -Seconds 1

$nsisWork = Join-Path $Root "src-tauri\target\release\nsis"
$nsisOut = Join-Path $Root "src-tauri\target\release\bundle\nsis"
if ($nsisWork -and (Test-Path $nsisWork)) {
  Remove-Item $nsisWork -Recurse -Force -ErrorAction SilentlyContinue
}
if ($nsisOut -and (Test-Path $nsisOut)) {
  Remove-Item $nsisOut -Recurse -Force -ErrorAction SilentlyContinue
}

Write-Host "开始打包: MSI + NSIS ..."
$cmd = "`"$vcvars`" && cd /d `"$Root`" && npx tauri build --bundles msi,nsis"
cmd.exe /c $cmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "完成。安装包:"
$msi = Join-Path $Root "src-tauri\target\release\bundle\msi"
$nsis = Join-Path $Root "src-tauri\target\release\bundle\nsis"
Get-ChildItem $msi, $nsis -Recurse -File -ErrorAction SilentlyContinue |
  Format-Table FullName, Length, LastWriteTime -AutoSize
