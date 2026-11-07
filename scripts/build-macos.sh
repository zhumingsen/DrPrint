#!/usr/bin/env bash
# 描述: 在 Mac 上打 DMG 安装包
# 用法:
#   npm run pack:mac                 # 本机默认架构
#   npm run pack:mac:arm             # Apple Silicon
#   npm run pack:mac:intel           # Intel
#   npm run pack:mac:universal       # 通用 Fat Binary
#   bash ./scripts/build-macos.sh [aarch64-apple-darwin|x86_64-apple-darwin|universal-apple-darwin]
#
# 前置: Xcode CLT、Rust、Node；建议安装 Chrome/Edge 供截图出纸

set -euo pipefail
ROOT="$(cd "$(dirname "$0")/.." && pwd)"
cd "$ROOT"

TARGET="${1:-}"

if ! command -v rustc >/dev/null; then
  echo "未找到 Rust，请先: curl --proto '=https' --tlsv1.2 -sSf https://sh.rustup.rs | sh"
  exit 1
fi
if ! command -v npm >/dev/null; then
  echo "未找到 npm，请先安装 Node.js"
  exit 1
fi

npm install

ARGS=(build --bundles dmg)
if [[ -n "$TARGET" ]]; then
  echo "目标架构: $TARGET"
  rustup target add "$TARGET" || true
  ARGS+=(--target "$TARGET")
else
  echo "目标架构: 本机默认"
fi

echo "开始打包 DMG ..."
npx tauri "${ARGS[@]}"

echo ""
echo "完成。安装包目录:"
echo "  $ROOT/src-tauri/target/release/bundle/dmg/"
if [[ -n "$TARGET" ]]; then
  echo "  或: $ROOT/src-tauri/target/$TARGET/release/bundle/dmg/"
  ls -la "$ROOT/src-tauri/target/$TARGET/release/bundle/dmg" 2>/dev/null || true
fi
ls -la "$ROOT/src-tauri/target/release/bundle/dmg" 2>/dev/null || true
