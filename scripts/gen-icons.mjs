/**
 * 描述: 用源图生成 Tauri 全套图标（ico/icns/png）
 * 用法:
 *   npm run icons
 *   npm run icons -- path/to/1024.png
 * 默认源图: src-tauri/app-icon-source.png
 */
import { existsSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { spawn } from 'node:child_process'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const defaultSource = path.join(root, 'src-tauri', 'app-icon-source.png')
const source = path.resolve(root, process.argv[2] || defaultSource)
const tauriCli = path.join(root, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')

if (!existsSync(source)) {
  console.error(`未找到图标源文件: ${source}`)
  console.error('请先放入 1024×1024 PNG，或: npm run icons -- ./your-icon.png')
  process.exit(1)
}
if (!existsSync(tauriCli)) {
  console.error('未找到 @tauri-apps/cli，请先 npm install')
  process.exit(1)
}

console.log(`生成图标: ${source}`)
const child = spawn(process.execPath, [tauriCli, 'icon', source], {
  cwd: root,
  stdio: 'inherit',
})
child.on('exit', (code) => {
  process.exitCode = code ?? 1
  if (code === 0) {
    console.log('完成。输出目录: src-tauri/icons/')
  }
})
