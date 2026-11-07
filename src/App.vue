<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'
import AppTitleBar from './components/AppTitleBar.vue'
import PrintHistoryDialog from './components/PrintHistoryDialog.vue'
import PrinterSettingsDialog from './components/PrinterSettingsDialog.vue'
import HPrintDesigner from './designer/HPrintDesigner.vue'
import { createAgentClient } from './client/agentClient'
import { SCHEMA_VERSION, type HPrintHistoryEntry, type HPrintPrinter, type HPrintTemplate } from './core/types'

type ViewMode = 'home' | 'designer'

const view = ref<ViewMode>('home')
const agentUrl = ref('http://127.0.0.1:17878')
const online = ref(false)
const version = ref('1.0.0')
const printers = ref<HPrintPrinter[]>([])
const recentHistory = ref<HPrintHistoryEntry[]>([])
const historyCount = ref(0)
const error = ref('')
const isDark = ref(false)
const showHistory = ref(false)
const showPrinters = ref(false)

const template = ref<HPrintTemplate>(createBlankTemplate())

let timer: number | undefined

const statusText = computed(() => {
  if (!online.value) return 'Agent 未连接'
  return `Agent 已连接 · ${printers.value.length} 台打印机`
})

const paperLabel = computed(() => {
  const paper = template.value.paper
  return `A4 ${paper.width}×${paper.height}mm`
})

const componentCount = computed(() => template.value.components?.length || 0)

function createBlankTemplate(): HPrintTemplate {
  return {
    schemaVersion: SCHEMA_VERSION,
    name: '未命名模板',
    paper: { width: 210, height: 297, unit: 'mm', orientation: 'portrait' },
    components: [],
  }
}

function getClient() {
  return createAgentClient({ agentUrl: agentUrl.value })
}

async function resolveAgentUrl() {
  try {
    const port = await invoke<number>('get_agent_port')
    if (port && port > 0) {
      agentUrl.value = `http://127.0.0.1:${port}`
    }
  } catch {
    // 浏览器调试时走默认端口
  }
}

async function refresh() {
  error.value = ''
  await resolveAgentUrl()
  const client = getClient()
  try {
    const health = await client.health()
    online.value = !!health.ok
    if (health.version) {
      version.value = String(health.version).replace(/-reconstructed$/i, '') || '1.0.0'
    }
  } catch (cause) {
    online.value = false
    printers.value = []
    recentHistory.value = []
    historyCount.value = 0
    error.value = cause instanceof Error ? cause.message : '无法连接本地 Agent'
    return
  }

  try {
    printers.value = await client.listPrinters()
  } catch {
    printers.value = []
  }

  try {
    const result = await client.getPrintHistory(20)
    const items = result.history || []
    historyCount.value = result.count ?? items.length
    recentHistory.value = items.slice(0, 4)
  } catch {
    recentHistory.value = []
    historyCount.value = 0
  }
}

function openDesigner() {
  view.value = 'designer'
}

function backHome() {
  view.value = 'home'
  refresh()
}

function openHistory() {
  showHistory.value = true
}

function openPrinters() {
  showPrinters.value = true
}

function toggleTheme() {
  isDark.value = !isDark.value
  document.documentElement.classList.toggle('theme-dark', isDark.value)
}

function formatTime(value?: string) {
  if (!value) return '--'
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return value
  const mm = String(date.getMonth() + 1).padStart(2, '0')
  const dd = String(date.getDate()).padStart(2, '0')
  const hh = String(date.getHours()).padStart(2, '0')
  const mi = String(date.getMinutes()).padStart(2, '0')
  return `${mm}-${dd} ${hh}:${mi}`
}

onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 5000)
})

onUnmounted(() => {
  if (timer) window.clearInterval(timer)
})
</script>

<template>
  <div class="app-root" :class="{ 'is-dark': isDark, 'is-designer': view === 'designer' }">
    <AppTitleBar :view="view" />

    <main v-if="view === 'home'" class="home">
      <section class="hero">
        <div class="hero-grid" aria-hidden="true"></div>
        <div class="hero-inner">
          <span class="status-pill" :class="{ online }">
            <i></i>{{ statusText }}
          </span>
          <h1>HPrint Agent</h1>
          <p class="subtitle">模板设计 · 静默打印 · 多协议输出，一体化打印基础设施</p>
          <div class="hero-actions">
            <button class="btn primary" type="button" @click="openDesigner">
              <svg viewBox="0 0 24 24" width="16" height="16" fill="none" stroke="currentColor" stroke-width="2">
                <rect x="3" y="3" width="7" height="7" rx="1.5" />
                <rect x="14" y="3" width="7" height="7" rx="1.5" />
                <rect x="3" y="14" width="7" height="7" rx="1.5" />
                <rect x="14" y="14" width="7" height="7" rx="1.5" />
              </svg>
              进入设计器
            </button>
            <button class="btn ghost" type="button" @click="openHistory">查看打印历史</button>
          </div>
          <p v-if="error" class="hero-error">{{ error }}</p>
        </div>
      </section>

      <section class="feature-grid">
        <button class="feature-card" type="button" @click="openDesigner">
          <span class="feature-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <rect x="3" y="3" width="7" height="7" rx="1.5" />
              <rect x="14" y="3" width="7" height="7" rx="1.5" />
              <rect x="3" y="14" width="7" height="7" rx="1.5" />
              <rect x="14" y="14" width="7" height="7" rx="1.5" />
            </svg>
          </span>
          <strong>模板设计器</strong>
          <span class="feature-metric">{{ componentCount }} 个组件 · {{ paperLabel }}</span>
          <span class="feature-desc">拖拽排版、跨页续排、表格合并与条件样式</span>
        </button>

        <button class="feature-card" type="button" @click="openHistory">
          <span class="feature-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <circle cx="12" cy="12" r="8" />
              <path d="M12 8v4l2.5 2.5" />
            </svg>
          </span>
          <strong>打印历史</strong>
          <span class="feature-metric"><b>{{ historyCount }}</b> 条记录</span>
          <span class="feature-desc">记录每次打印任务，可查看详情并一键重打</span>
        </button>

        <button class="feature-card" type="button" @click="openPrinters">
          <span class="feature-icon">
            <svg viewBox="0 0 24 24" width="20" height="20" fill="none" stroke="currentColor" stroke-width="1.8">
              <path d="M7 8V4h10v4" />
              <rect x="4" y="8" width="16" height="9" rx="2" />
              <path d="M7 17h10v3H7z" />
              <circle cx="17" cy="12" r="1" fill="currentColor" />
            </svg>
          </span>
          <strong>打印机管理</strong>
          <span class="feature-metric"><b>{{ printers.length }}</b> 台可用</span>
          <span class="feature-desc">配置标签 / 小票 / 文档三类打印链路与校准</span>
        </button>
      </section>

      <section class="recent">
        <div class="recent-head">
          <h2>最近打印</h2>
          <button class="link" type="button" @click="openHistory">全部</button>
        </div>
        <div v-if="!recentHistory.length" class="recent-empty">暂无打印记录</div>
        <div v-else class="recent-list">
          <button
            v-for="item in recentHistory"
            :key="item.id"
            class="recent-row"
            type="button"
            @click="openHistory"
          >
            <i :class="item.status === 'printed' ? 'ok' : 'fail'"></i>
            <span class="recent-name">{{ item.templateName || item.documentName || '未命名文档' }}</span>
            <span class="recent-printer">{{ item.printerName || '未知打印机' }}</span>
            <span class="recent-time">{{ formatTime(item.createdAt) }}</span>
          </button>
        </div>
      </section>
    </main>

    <main v-else class="designer-shell">
      <div class="designer-bar">
        <button class="btn ghost compact" type="button" @click="backHome">← 返回首页</button>
        <span class="designer-title">{{ template.name || '未命名模板' }}</span>
      </div>
      <HPrintDesigner v-model="template" class="designer-body" />
    </main>

    <footer v-if="view === 'home'" class="statusbar">
      <span class="status-left" :class="{ online }"><i></i>{{ statusText }}</span>
      <div class="status-right">
        <button class="theme-btn" type="button" @click="toggleTheme">
          {{ isDark ? '深色模式' : '浅色模式' }}
        </button>
        <span class="version">v{{ version }}</span>
      </div>
    </footer>

    <PrintHistoryDialog v-model="showHistory" :agent-url="agentUrl" />
    <PrinterSettingsDialog v-model="showPrinters" :agent-url="agentUrl" />
  </div>
</template>

<style>
:root {
  color: #0f172a;
  background: #eef3fb;
  font-family: "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif;
  font-synthesis: none;
  text-rendering: optimizeLegibility;
  -webkit-font-smoothing: antialiased;
}

* { box-sizing: border-box; }
html, body, #app {
  margin: 0;
  height: 100%;
  min-width: 860px;
}
button {
  font: inherit;
  cursor: pointer;
}
button:disabled {
  cursor: not-allowed;
  opacity: 0.55;
}

.app-root {
  --bg: linear-gradient(165deg, #e8eefc 0%, #edf1f8 42%, #e9e7f6 100%);
  --panel: rgba(255, 255, 255, 0.88);
  --text: #0f172a;
  --muted: #64748b;
  --line: rgba(15, 23, 42, 0.08);
  --accent: #4f46e5;
  --accent-2: #6366f1;
  height: 100%;
  display: flex;
  flex-direction: column;
  color: var(--text);
  background: var(--bg);
  overflow: hidden;
}

.app-root.is-dark {
  --bg: linear-gradient(165deg, #0b1220 0%, #111827 50%, #1e1b4b 100%);
  --panel: rgba(17, 24, 39, 0.88);
  --text: #e2e8f0;
  --muted: #94a3b8;
  --line: rgba(148, 163, 184, 0.16);
}

.home {
  flex: 1;
  min-height: 0;
  overflow: auto;
  padding: 8px 28px 18px;
}

.hero {
  position: relative;
  border-radius: 22px;
  padding: 42px 24px 34px;
  overflow: hidden;
  text-align: center;
}

.hero-grid {
  position: absolute;
  inset: 0;
  background-image:
    linear-gradient(rgba(99, 102, 241, 0.08) 1px, transparent 1px),
    linear-gradient(90deg, rgba(99, 102, 241, 0.08) 1px, transparent 1px);
  background-size: 28px 28px;
  mask-image: radial-gradient(ellipse at center, #000 35%, transparent 78%);
  pointer-events: none;
}

.hero-inner {
  position: relative;
  z-index: 1;
}

.status-pill {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  padding: 7px 14px;
  border-radius: 999px;
  background: rgba(255, 255, 255, 0.82);
  border: 1px solid var(--line);
  color: var(--muted);
  font-size: 12.5px;
  box-shadow: 0 6px 18px rgba(15, 23, 42, 0.05);
}
.status-pill i,
.statusbar .status-left i,
.recent-row i {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: #94a3b8;
  display: inline-block;
}
.status-pill.online i,
.statusbar .status-left.online i,
.recent-row i.ok { background: #22c55e; }
.recent-row i.fail { background: #ef4444; }

.hero h1 {
  margin: 18px 0 10px;
  font-size: 42px;
  letter-spacing: -0.03em;
  color: #1e1b4b;
}
.is-dark .hero h1 { color: #eef2ff; }

.subtitle {
  margin: 0 auto;
  max-width: 560px;
  color: var(--muted);
  font-size: 14.5px;
  line-height: 1.6;
}

.hero-actions {
  margin-top: 22px;
  display: flex;
  justify-content: center;
  gap: 12px;
}

.hero-error {
  margin: 14px auto 0;
  max-width: 520px;
  color: #b91c1c;
  font-size: 12.5px;
}

.btn {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  border-radius: 12px;
  border: 1px solid transparent;
  padding: 11px 18px;
  font-size: 14px;
  font-weight: 600;
  transition: transform 0.15s ease, box-shadow 0.15s ease, background 0.15s ease;
}
.btn.primary {
  color: #fff;
  background: linear-gradient(135deg, var(--accent), var(--accent-2));
  box-shadow: 0 10px 24px rgba(79, 70, 229, 0.28);
}
.btn.primary:hover { transform: translateY(-1px); }
.btn.ghost {
  color: var(--text);
  background: rgba(255, 255, 255, 0.78);
  border-color: var(--line);
}
.is-dark .btn.ghost { background: rgba(30, 41, 59, 0.8); }
.btn.compact { padding: 7px 12px; font-size: 12.5px; border-radius: 9px; }

.feature-grid {
  display: grid;
  grid-template-columns: repeat(3, minmax(0, 1fr));
  gap: 16px;
  margin-top: 8px;
}

.feature-card {
  text-align: left;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--panel);
  padding: 18px 18px 16px;
  box-shadow: 0 10px 28px rgba(15, 23, 42, 0.04);
  display: flex;
  flex-direction: column;
  gap: 8px;
  color: inherit;
}
.feature-card:hover {
  border-color: rgba(79, 70, 229, 0.28);
  box-shadow: 0 14px 30px rgba(79, 70, 229, 0.08);
}
.feature-icon {
  width: 40px;
  height: 40px;
  border-radius: 12px;
  display: grid;
  place-items: center;
  color: #4f46e5;
  background: rgba(99, 102, 241, 0.12);
}
.feature-card strong {
  font-size: 16px;
}
.feature-metric {
  color: var(--muted);
  font-size: 13px;
}
.feature-metric b {
  color: var(--text);
  font-size: 20px;
  font-weight: 700;
  margin-right: 4px;
}
.feature-desc {
  color: var(--muted);
  font-size: 12.5px;
  line-height: 1.55;
}

.recent {
  margin-top: 22px;
  border: 1px solid var(--line);
  border-radius: 18px;
  background: var(--panel);
  padding: 16px 18px 12px;
}
.recent-head {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.recent-head h2 {
  margin: 0;
  font-size: 15px;
}
.link {
  border: none;
  background: transparent;
  color: var(--accent);
  font-size: 12.5px;
  padding: 0;
}
.recent-empty {
  padding: 22px 8px;
  text-align: center;
  color: var(--muted);
  font-size: 13px;
}
.recent-list {
  display: flex;
  flex-direction: column;
  gap: 8px;
}
.recent-row {
  width: 100%;
  display: grid;
  grid-template-columns: 16px minmax(0, 1.2fr) minmax(0, 1fr) auto;
  gap: 12px;
  align-items: center;
  border: 1px solid var(--line);
  border-radius: 12px;
  background: rgba(255, 255, 255, 0.65);
  padding: 11px 14px;
  color: inherit;
  text-align: left;
}
.is-dark .recent-row { background: rgba(15, 23, 42, 0.55); }
.recent-name {
  font-size: 13.5px;
  font-weight: 600;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-printer,
.recent-time {
  color: var(--muted);
  font-size: 12.5px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.recent-time { text-align: right; }

.statusbar {
  flex: 0 0 34px;
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0 16px;
  border-top: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.72);
  color: var(--muted);
  font-size: 12px;
}
.is-dark .statusbar { background: rgba(15, 23, 42, 0.78); }
.status-left {
  display: inline-flex;
  align-items: center;
  gap: 8px;
}
.status-right {
  display: inline-flex;
  align-items: center;
  gap: 12px;
}
.theme-btn {
  border: none;
  background: transparent;
  color: var(--muted);
  padding: 0;
  font-size: 12px;
}
.version { opacity: 0.85; }

.designer-shell {
  flex: 1;
  min-height: 0;
  display: flex;
  flex-direction: column;
  background: #f8fafc;
}
.is-dark .designer-shell { background: #0f172a; }
.designer-bar {
  flex: 0 0 auto;
  display: flex;
  align-items: center;
  gap: 12px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--line);
  background: rgba(255, 255, 255, 0.8);
}
.is-dark .designer-bar { background: rgba(15, 23, 42, 0.8); }
.designer-title {
  font-size: 13px;
  color: var(--muted);
}
.designer-body {
  flex: 1;
  min-height: 0;
}

@media (max-width: 1080px) {
  .feature-grid { grid-template-columns: 1fr; }
  .hero h1 { font-size: 34px; }
}
</style>
