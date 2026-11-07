#!/usr/bin/env bash
# 描述: 在 Mac 上生成 HPrint Agent（.app / dmg）
# 用法: 在仓库 hiprint-v2 目录执行  bash ./scripts/build-macos.sh
# 前置: 安装 Xcode Command Line Tools、Rust stable、Node.js；本机 Chrome 或 Edge 用于截图出纸

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

if ! command -v rustc >/dev/null; then
  echo "未找到 Rust，请先: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi
if ! command -v npm >/dev/null; then
  echo "未找到 npm，请先安装 Node.js"
  exit 1
fi

npm install
# Mac 安装包：DMG（拖拽安装），不要单独分发未签名的裸 .app 也行，但交付以 dmg 为准
npx tauri build --bundles dmg

echo ""
echo "构建完成。安装包位置:"
echo "  DMG: $ROOT/src-tauri/target/release/bundle/dmg/"
ls -la "$ROOT/src-tauri/target/release/bundle/dmg" 2>/dev/null || true
