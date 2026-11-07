# 描述: Windows 开发启动（带 MSVC 环境）
# 用法: npm run tauri:dev:win

$ErrorActionPreference = "Stop"
if (-not $PSScriptRoot) {
  $PSScriptRoot = Split-Path -Parent $MyInvocation.MyCommand.Path
}
$Root = Split-Path -Parent $PSScriptRoot
Set-Location $Root

$vswhere = Join-Path ${env:ProgramFiles(x86)} "Microsoft Visual Studio\Installer\vswhere.exe"
$vcvars = $null
if (Test-Path $vswhere) {
  $vs = & $vswhere -latest -products * -requires Microsoft.VisualStudio.Component.VC.Tools.x86.x64 -property installationPath 2>$null
  if ($vs) {
    $c = Join-Path $vs "VC\Auxiliary\Build\vcvars64.bat"
    if (Test-Path $c) { $vcvars = $c }
  }
}
if (-not $vcvars -and (Test-Path "F:\softDing\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat")) {
  $vcvars = "F:\softDing\VSBuildTools\VC\Auxiliary\Build\vcvars64.bat"
}
if (-not $vcvars) { Write-Error "未找到 vcvars64.bat" }

$cmd = "`"$vcvars`" && cd /d `"$Root`" && npm run tauri:dev"
cmd.exe /c $cmd
