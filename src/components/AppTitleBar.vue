<template>
  <div class="titlebar" :class="{ 'is-dark': isDark }" @dblclick="onToggleMaximize">
    <div class="titlebar-brand" data-tauri-drag-region>
      <span class="brand-mark" data-tauri-drag-region>
        <svg viewBox="0 0 24 24" width="14" height="14" fill="none" stroke="currentColor" stroke-width="2.2">
          <rect x="4" y="3" width="16" height="18" rx="2.5" />
          <path d="M8 8h8M8 12h8M8 16h5" />
        </svg>
      </span>
      <span class="brand-name" data-tauri-drag-region>HPrint Agent</span>
      <span class="brand-view" data-tauri-drag-region>{{ viewLabel }}</span>
    </div>

    <div class="titlebar-drag" data-tauri-drag-region></div>

    <div class="titlebar-actions">
      <button class="win-btn" title="最小化" @click="minimize">
        <svg viewBox="0 0 12 12" width="11" height="11"><path d="M2 6h8" stroke="currentColor" stroke-width="1.4" /></svg>
      </button>
      <button class="win-btn" :title="maximized ? '还原' : '最大化'" @click="onToggleMaximize">
        <svg v-if="!maximized" viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="2.4" y="2.4" width="7.2" height="7.2" rx="1" />
        </svg>
        <svg v-else viewBox="0 0 12 12" width="11" height="11" fill="none" stroke="currentColor" stroke-width="1.4">
          <rect x="2.2" y="4.2" width="5.6" height="5.6" rx="1" />
          <path d="M4.4 4.2V2.4h5.2v5.2H7.8" />
        </svg>
      </button>
      <button class="win-btn close" title="关闭" @click="closeWindow">
        <svg viewBox="0 0 12 12" width="11" height="11"><path d="M3 3l6 6M9 3l-6 6" stroke="currentColor" stroke-width="1.4" /></svg>
      </button>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, onBeforeUnmount, onMounted, ref } from 'vue'

const props = withDefaults(defineProps<{
  view?: 'home' | 'designer'
}>(), {
  view: 'home',
})

const maximized = ref(false)
const isDark = ref(false)
let darkQuery: MediaQueryList | undefined
let unlistenResize: (() => void) | undefined

const viewLabel = computed(() => (props.view === 'home' ? '首页' : '模板设计器'))

/** Tauri 环境判断：浏览器里直接跑（npm run dev 调试）时按钮降级为无操作 */
function isTauri(): boolean {
  return typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window
}

async function currentWindow() {
  const { getCurrentWindow } = await import('@tauri-apps/api/window')
  return getCurrentWindow()
}

async function minimize() {
  if (!isTauri()) return
  try { await (await currentWindow()).minimize() } catch { /* 忽略 */ }
}

async function onToggleMaximize() {
  if (!isTauri()) return
  try {
    const win = await currentWindow()
    await win.toggleMaximize()
    maximized.value = await win.isMaximized()
  } catch { /* 忽略 */ }
}

async function closeWindow() {
  if (!isTauri()) return
  try { await (await currentWindow()).close() } catch { /* 忽略 */ }
}

function syncTheme(event?: MediaQueryListEvent) {
  isDark.value = event ? event.matches : !!darkQuery?.matches
}

onMounted(async () => {
  if (typeof window !== 'undefined' && window.matchMedia) {
    darkQuery = window.matchMedia('(prefers-color-scheme: dark)')
    syncTheme()
    darkQuery.addEventListener('change', syncTheme)
  }

  if (!isTauri()) return
  try {
    const win = await currentWindow()
    maximized.value = await win.isMaximized()
    // 监听窗口尺寸变化以同步最大化按钮状态
    const { listen } = await import('@tauri-apps/api/event')
    unlistenResize = await listen('tauri://resize', async () => {
      try { maximized.value = await win.isMaximized() } catch { /* 忽略 */ }
    })
  } catch { /* 非 Tauri 环境忽略 */ }
})

onBeforeUnmount(() => {
  darkQuery?.removeEventListener('change', syncTheme)
  unlistenResize?.()
})
</script>

<style scoped>
.titlebar {
  --tb-text: #0f172a;
  --tb-soft: rgba(15, 23, 42, 0.55);
  --tb-hover: rgba(15, 23, 42, 0.07);
  height: 38px;
  flex: 0 0 38px;
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 0 4px 0 14px;
  box-sizing: border-box;
  user-select: none;
  color: var(--tb-text);
  background: linear-gradient(180deg, rgba(255, 255, 255, 0.92), rgba(255, 255, 255, 0.72));
  border-bottom: 1px solid rgba(15, 23, 42, 0.07);
  backdrop-filter: blur(14px);
  position: relative;
  z-index: 1000;
}

.titlebar.is-dark {
  --tb-text: #e2e8f0;
  --tb-soft: rgba(226, 232, 240, 0.55);
  --tb-hover: rgba(255, 255, 255, 0.09);
  background: linear-gradient(180deg, rgba(17, 24, 39, 0.94), rgba(17, 24, 39, 0.78));
  border-bottom: 1px solid rgba(148, 163, 184, 0.16);
}

.titlebar-brand {
  display: inline-flex;
  align-items: center;
  gap: 8px;
  min-width: 0;
}

.brand-mark {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  width: 20px;
  height: 20px;
  border-radius: 6px;
  color: #fff;
  background: linear-gradient(135deg, #2563eb, #7c3aed);
  box-shadow: 0 2px 8px rgba(37, 99, 235, 0.32);
}

.brand-name {
  font-size: 12.5px;
  font-weight: 700;
  letter-spacing: 0.01em;
  white-space: nowrap;
}

.brand-view {
  font-size: 11.5px;
  color: var(--tb-soft);
  padding: 1px 7px;
  border-radius: 999px;
  border: 1px solid rgba(148, 163, 184, 0.28);
  white-space: nowrap;
}

.titlebar-drag {
  flex: 1;
  height: 100%;
  min-width: 24px;
}

.titlebar-actions {
  display: inline-flex;
  align-items: center;
  gap: 2px;
}

.win-btn {
  width: 34px;
  height: 26px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  border: none;
  border-radius: 6px;
  background: transparent;
  color: var(--tb-text);
  cursor: pointer;
  transition: background 0.15s ease, color 0.15s ease;
}

.win-btn:hover {
  background: var(--tb-hover);
}

.win-btn.close:hover {
  background: #e5484d;
  color: #fff;
}
</style>
