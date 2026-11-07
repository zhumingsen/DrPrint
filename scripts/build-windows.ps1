# 描述: 在 Windows 上生成 HPrint Agent 发布版（exe + 安装包）
# 用法: 在仓库 hiprint-v2 目录执行  powershell -ExecutionPolicy Bypass -File .\scripts\build-windows.ps1

$ErrorActionPreference = "Stop"
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$vswhere = "${env:ProgramFiles(x86)}\Microsoft Visual Studio\Installer\vswhere.exe"
$vcvars = $null
if (Test-Path $vswhere) {
  $vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath
  if ($vs) {
    $candidate = Join-Path $vs "VC\Auxiliary\Build\vcvars64.bat"
    if (Test-Path $candidate) { $vcvars = $candidate }
  }
}
if (-not $vcvars -and (Test-Path "F:\softDing\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat")) {
  $vcvars = "F:\softDing\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat"
}
if (-not $vcvars) {
  Write-Error "未找到 vcvars64.bat，请先安装 Visual Studio Build Tools (C++)"
}

Write-Host "使用 MSVC: $vcvars"
# 只要安装包：MSI + NSIS（setup.exe）
$nsisWork = Join-Path $Root "src-tauri\target\release\nsis"
$nsisOut = Join-Path $Root "src-tauri\target\release\bundle\nsis"
if (Test-Path $nsisWork) { Remove-Item $nsisWork -Recurse -Force -ErrorAction SilentlyContinue }
if (Test-Path $nsisOut) { Remove-Item $nsisOut -Recurse -Force -ErrorAction SilentlyContinue }

Write-Host "开始打包安装包 (msi + nsis) ..."
$cmd = "`"$vcvars`" && cd /d `"$Root`" && npx tauri build --bundles msi,nsis"
cmd.exe /c $cmd
if ($LASTEXITCODE -ne 0) { exit $LASTEXITCODE }

Write-Host ""
Write-Host "构建完成。安装包位置:"
Write-Host "  MSI:  $Root\src-tauri\target\release\bundle\msi\"
Write-Host "  NSIS: $Root\src-tauri\target\release\bundle\nsis\"
Get-ChildItem "$Root\src-tauri\target\release\bundle\msi","$Root\src-tauri\target\release\bundle\nsis" -Recurse -File -ErrorAction SilentlyContinue |
  Format-Table FullName, Length, LastWriteTime -AutoSize
