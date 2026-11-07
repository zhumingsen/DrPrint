import { existsSync } from 'node:fs'
import { homedir } from 'node:os'
import path from 'node:path'
import { spawn } from 'node:child_process'
import { fileURLToPath } from 'node:url'

const projectRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const cargoHome = process.env.CARGO_HOME || path.join(homedir(), '.cargo')
const cargoBin = path.join(cargoHome, 'bin')
const cargoExecutable = path.join(
  cargoBin,
  process.platform === 'win32' ? 'cargo.exe' : 'cargo',
)
const tauriCli = path.join(projectRoot, 'node_modules', '@tauri-apps', 'cli', 'tauri.js')

if (!existsSync(cargoExecutable)) {
  console.error(`未找到 Rust Cargo：${cargoExecutable}`)
  console.error('请先安装 Rustup 和 stable 工具链，或设置 CARGO_HOME 指向现有 Rust 安装目录。')
  process.exit(1)
}

if (!existsSync(tauriCli)) {
  console.error(`未找到本地 Tauri CLI：${tauriCli}`)
  console.error('请先在项目目录执行 npm install。')
  process.exit(1)
}

const pathKey = Object.keys(process.env).find((key) => key.toLowerCase() === 'path') || 'PATH'
const env = {
  ...process.env,
  [pathKey]: [cargoBin, process.env[pathKey]].filter(Boolean).join(path.delimiter),
}

const child = spawn(process.execPath, [tauriCli, ...process.argv.slice(2)], {
  cwd: projectRoot,
  env,
  stdio: 'inherit',
})

child.on('error', (error) => {
  console.error(`启动 Tauri CLI 失败：${error.message}`)
  process.exitCode = 1
})

child.on('exit', (code, signal) => {
  process.exitCode = code ?? (signal ? 1 : 0)
})
