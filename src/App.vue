<script setup lang="ts">
import { computed, onMounted, onUnmounted, ref } from 'vue'
import { invoke } from '@tauri-apps/api/core'

type Printer = { name: string; isDefault: boolean; status: string; printerType: string; capabilities?: { rawProtocol?: string } }
type Health = { ok: boolean; name: string; version: string; protocolVersion: string }

const port = ref(0)
const health = ref<Health | null>(null)
const printers = ref<Printer[]>([])
const error = ref('')
const busy = ref(false)
let timer: number | undefined

const agentUrl = computed(() => (port.value ? `http://127.0.0.1:${port.value}` : ''))
const online = computed(() => health.value?.ok === true)

async function refresh() {
  error.value = ''
  try {
    port.value = await invoke<number>('get_agent_port')
    if (!agentUrl.value) return
    const [healthResponse, printersResponse] = await Promise.all([
      fetch(`${agentUrl.value}/health`),
      fetch(`${agentUrl.value}/printers`),
    ])
    if (!healthResponse.ok) throw new Error(`健康检查失败（${healthResponse.status}）`)
    health.value = await healthResponse.json()
    printers.value = printersResponse.ok ? await printersResponse.json() : []
  } catch (cause) {
    health.value = null
    printers.value = []
    error.value = cause instanceof Error ? cause.message : '无法连接本地 Agent'
  }
}

async function testPrinter(printerName: string) {
  if (!agentUrl.value) return
  busy.value = true
  error.value = ''
  try {
    const response = await fetch(`${agentUrl.value}/test-raw`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ printerName, text: 'HPrint Agent 测试页\n', feed: 3, cut: false }),
    })
    if (!response.ok) throw new Error((await response.json()).error || `测试打印失败（${response.status}）`)
    window.alert('测试打印任务已提交')
  } catch (cause) {
    error.value = cause instanceof Error ? cause.message : '测试打印失败'
  } finally {
    busy.value = false
  }
}

onMounted(() => {
  refresh()
  timer = window.setInterval(refresh, 5000)
})
onUnmounted(() => timer && window.clearInterval(timer))
</script>

<template>
  <main class="shell">
    <header class="topbar">
      <div>
        <p class="eyebrow">HPRINT AGENT</p>
        <h1>本机打印服务</h1>
      </div>
      <button class="refresh" type="button" :disabled="busy" @click="refresh">刷新状态</button>
    </header>

    <section class="status-panel">
      <div class="status-mark" :class="{ online }"></div>
      <div>
        <strong>{{ online ? 'Agent 在线' : 'Agent 未连接' }}</strong>
        <span>{{ agentUrl || '正在分配本地端口' }}</span>
      </div>
      <dl v-if="health" class="meta">
        <div><dt>版本</dt><dd>{{ health.version }}</dd></div>
        <div><dt>协议</dt><dd>{{ health.protocolVersion }}</dd></div>
      </dl>
    </section>

    <p v-if="error" class="error">{{ error }}</p>

    <section class="content">
      <div class="section-heading">
        <div><p class="eyebrow">LOCAL PRINTERS</p><h2>打印机</h2></div>
        <span class="count">{{ printers.length }} 台</span>
      </div>
      <div v-if="!printers.length" class="empty">未发现本机打印机。安装打印机驱动后点击刷新。</div>
      <div v-else class="printer-list">
        <article v-for="printer in printers" :key="printer.name" class="printer-row">
          <div class="printer-icon">PR</div>
          <div class="printer-info">
            <strong>{{ printer.name }}</strong>
            <span>{{ printer.isDefault ? '默认打印机 · ' : '' }}{{ printer.printerType }} · {{ printer.status }}</span>
          </div>
          <span class="protocol">{{ printer.capabilities?.rawProtocol || 'webview' }}</span>
          <button class="test" type="button" :disabled="busy" @click="testPrinter(printer.name)">测试打印</button>
        </article>
      </div>
    </section>

    <footer>业务系统通过 HTTP 连接本机 Agent；模板设计和打印设置由 hiprint-v2 SDK 提供。</footer>
  </main>
</template>

<style>
:root { font-family: Inter, "Segoe UI", sans-serif; color: #1f2937; background: #f5f7fa; font-synthesis: none; text-rendering: optimizeLegibility; }
* { box-sizing: border-box; }
body { margin: 0; min-width: 620px; }
button { cursor: pointer; border: 1px solid #d4dbe5; border-radius: 5px; background: #fff; color: #334155; padding: 8px 13px; font: inherit; }
button:hover:not(:disabled) { border-color: #2563eb; color: #1d4ed8; }
button:disabled { cursor: not-allowed; opacity: .55; }
.shell { max-width: 980px; margin: 0 auto; padding: 30px 34px; }
.topbar, .section-heading, .status-panel, .printer-row { display: flex; align-items: center; }
.topbar, .section-heading { justify-content: space-between; }
.eyebrow { margin: 0 0 5px; color: #64748b; font-size: 11px; font-weight: 700; letter-spacing: .12em; }
h1, h2 { margin: 0; color: #111827; } h1 { font-size: 25px; } h2 { font-size: 18px; }
.refresh { background: #1d4ed8; border-color: #1d4ed8; color: #fff; }
.status-panel { gap: 13px; margin-top: 28px; padding: 17px 19px; border: 1px solid #dce3ed; border-radius: 7px; background: #fff; }
.status-mark { width: 11px; height: 11px; border-radius: 50%; background: #dc2626; } .status-mark.online { background: #16a34a; }
.status-panel strong, .status-panel span, .printer-info strong, .printer-info span { display: block; }
.status-panel span, .printer-info span { margin-top: 3px; color: #64748b; font-size: 12px; }
.meta { display: flex; gap: 26px; margin: 0 0 0 auto; } .meta dt { color: #94a3b8; font-size: 11px; } .meta dd { margin: 2px 0 0; font-size: 12px; }
.error { padding: 10px 12px; border: 1px solid #fecaca; background: #fef2f2; color: #b91c1c; border-radius: 5px; font-size: 13px; }
.content { margin-top: 30px; } .count { color: #64748b; font-size: 12px; }
.empty { margin-top: 12px; padding: 32px; text-align: center; color: #64748b; border: 1px dashed #cbd5e1; border-radius: 6px; background: #fff; }
.printer-list { margin-top: 12px; overflow: hidden; border: 1px solid #dce3ed; border-radius: 6px; background: #fff; }
.printer-row { gap: 13px; padding: 14px 16px; border-bottom: 1px solid #edf0f4; } .printer-row:last-child { border-bottom: 0; }
.printer-icon { display: grid; place-items: center; width: 34px; height: 34px; border-radius: 5px; background: #e8efff; color: #1d4ed8; font-size: 11px; font-weight: 700; }
.printer-info { flex: 1; min-width: 0; } .printer-info strong { overflow: hidden; text-overflow: ellipsis; white-space: nowrap; font-size: 14px; }
.protocol { min-width: 70px; color: #64748b; font-size: 12px; text-align: center; } .test { min-width: 78px; padding: 6px 10px; font-size: 12px; }
footer { margin-top: 32px; color: #94a3b8; font-size: 11px; text-align: center; }
</style>
