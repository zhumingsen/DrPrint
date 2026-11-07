<template>
  <div v-if="modelValue" class="diagnostic-mask" @click.self="close">
    <section class="diagnostic-dialog" role="dialog" aria-modal="true">
      <header class="dialog-header">
        <h2>导出诊断包</h2>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="dialog-body">
        <p class="intro">诊断包会导出 Agent 版本、打印机列表、当前打印设置、最近任务日志、raw-raster 诊断字段和调试产物下载信息。</p>

        <label class="field-row">
          日志条数
          <input v-model.number="limit" type="number" min="1" max="200" />
        </label>

        <div v-if="error" class="alert">{{ error }}</div>
        <div v-if="lastPackage" class="summary">
          <strong>已生成诊断包</strong>
          <span>打印机：{{ lastPackage.printers?.length ?? 0 }} 台</span>
          <span>日志：{{ lastPackage.logs?.length ?? 0 }} 条</span>
          <span>失败任务：{{ lastPackage.failedJobs?.length ?? 0 }} 条</span>
          <span>raw-raster：{{ lastPackage.rawRasterJobs?.length ?? 0 }} 条</span>
          <span v-if="lastPackage.errors?.length">采集错误：{{ lastPackage.errors.length }} 项</span>
        </div>
      </div>

      <footer class="dialog-footer">
        <button class="button" type="button" :disabled="loading" @click="generateOnly">
          {{ loading ? '生成中...' : '只生成' }}
        </button>
        <button class="button primary" type="button" :disabled="loading" @click="exportPackage">
          {{ loading ? '导出中...' : '导出 JSON' }}
        </button>
        <button class="button" type="button" @click="close">关闭</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { createAgentClient } from '../client/agentClient'
import type { HPrintDiagnosticsPackage } from '../core/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  agentUrl?: string
  agentToken?: string
}>(), {
  agentUrl: 'http://127.0.0.1:17878',
  agentToken: '',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'generated', value: HPrintDiagnosticsPackage): void
}>()

const limit = ref(50)
const loading = ref(false)
const error = ref('')
const lastPackage = ref<HPrintDiagnosticsPackage | null>(null)

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      error.value = ''
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

async function generateOnly() {
  lastPackage.value = await collectPackage()
  emit('generated', lastPackage.value)
}

async function exportPackage() {
  const pkg = await collectPackage()
  lastPackage.value = pkg
  emit('generated', pkg)
  downloadJson(pkg)
}

async function collectPackage(): Promise<HPrintDiagnosticsPackage> {
  loading.value = true
  error.value = ''
  const client = createAgentClient({
    agentUrl: props.agentUrl,
    token: props.agentToken || undefined,
    timeout: 15000,
  })
  const pkg: HPrintDiagnosticsPackage = {
    exportedAt: new Date().toISOString(),
    agentUrl: props.agentUrl,
    errors: [],
  }

  try {
    pkg.health = await client.health()
  } catch (err) {
    pushError(pkg, 'health', err)
  }

  try {
    pkg.diagnostics = await client.diagnostics()
  } catch (err) {
    pushError(pkg, 'diagnostics', err)
  }

  try {
    pkg.printers = await client.listPrinters()
  } catch (err) {
    pushError(pkg, 'printers', err)
  }

  try {
    pkg.printerSettings = await client.getPrinterSettings()
  } catch (err) {
    pushError(pkg, 'printerSettings', err)
  }

  try {
    const result = await client.logs(limit.value)
    pkg.logs = result.logs
    pkg.failedJobs = result.logs.filter((job) => job.status === 'failed')
    pkg.rawRasterJobs = result.logs
      .filter((job) => job.renderMode === 'raw-raster' || job.rawMetrics?.rawBytes || job.rawMetrics?.bitmapBytes)
      .map((job) => ({
        jobId: job.jobId,
        printerName: job.printerName,
        renderMode: job.renderMode,
        bytesWritten: job.bytesWritten,
        rawMetrics: job.rawMetrics,
        rawArtifacts: job.rawArtifacts,
      }))
  } catch (err) {
    pushError(pkg, 'logs', err)
  } finally {
    loading.value = false
  }

  if (pkg.errors?.length && !pkg.health) {
    error.value = '诊断包已生成，但 Agent 连接失败，包内只包含错误信息。'
  }

  return pkg
}

function pushError(pkg: HPrintDiagnosticsPackage, step: string, err: unknown) {
  pkg.errors ||= []
  pkg.errors.push({
    step,
    message: (err as Error).message || String(err),
  })
}

function downloadJson(pkg: HPrintDiagnosticsPackage) {
  const blob = new Blob([JSON.stringify(pkg, null, 2)], { type: 'application/json' })
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = `hprint-diagnostics-${formatDate(new Date())}.json`
  a.click()
  URL.revokeObjectURL(url)
}

function formatDate(date: Date): string {
  const pad = (value: number) => value.toString().padStart(2, '0')
  return `${date.getFullYear()}${pad(date.getMonth() + 1)}${pad(date.getDate())}-${pad(date.getHours())}${pad(date.getMinutes())}${pad(date.getSeconds())}`
}
</script>

<style scoped>
.diagnostic-mask {
  position: fixed;
  inset: 0;
  z-index: 2070;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}
.diagnostic-dialog {
  width: min(560px, 100%);
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
}
.dialog-header,
.dialog-footer {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}
.dialog-header h2 {
  flex: 1;
  margin: 0;
  font-size: 16px;
}
.dialog-footer {
  justify-content: flex-end;
  gap: 8px;
  border-top: 1px solid #e5e7eb;
  border-bottom: none;
}
.dialog-body {
  display: grid;
  gap: 14px;
  padding: 18px;
}
.intro {
  margin: 0;
  color: #475569;
  line-height: 1.6;
}
.icon-button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
}
.field-row {
  display: grid;
  grid-template-columns: 80px 120px;
  align-items: center;
  gap: 10px;
  color: #475569;
}
.field-row input {
  height: 32px;
  padding: 0 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}
.button {
  height: 34px;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.button.primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}
.button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
.summary {
  display: grid;
  gap: 6px;
  padding: 12px;
  border: 1px solid #bbf7d0;
  border-radius: 6px;
  background: #f0fdf4;
  color: #166534;
}
.alert {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
}
</style>
