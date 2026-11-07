<template>
  <div v-if="modelValue" class="pdf-export-mask" @click.self="close">
    <section class="pdf-export-dialog" role="dialog" aria-modal="true">
      <header class="dialog-header">
        <h2>导出 PDF</h2>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="dialog-body">
        <p class="intro">
          当前版本会导出同渲染链路的打印 HTML；连接 Agent 时也可以直接导出 PDF。
        </p>

        <div class="summary">
          <span>模板：{{ template?.name || '未命名模板' }}</span>
          <span>纸张：{{ exportResult.widthMm }}×{{ exportResult.heightMm }}mm</span>
          <span>方向：{{ orientationLabel }}</span>
          <span>页数：{{ exportResult.totalPages }}</span>
          <span>HTML：{{ htmlSizeKb }} KB</span>
        </div>

        <label class="field-row">
          文件名
          <input v-model="filename" type="text" />
        </label>

        <div v-if="error" class="alert">{{ error }}</div>
      </div>

      <footer class="dialog-footer">
        <button class="button" type="button" @click="openHtml">打开预览</button>
        <button class="button" type="button" @click="downloadSvg">下载 SVG</button>
        <button class="button" type="button" @click="downloadPng">下载 PNG</button>
        <button class="button primary" type="button" @click="downloadHtml">下载 HTML</button>
        <button v-if="agentBaseUrl" class="button" type="button" :disabled="exportingPdf" @click="exportViaAgent">
          {{ exportingPdf ? '导出中...' : 'Agent PDF' }}
        </button>
        <button class="button" type="button" @click="close">关闭</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HPrintTemplate } from '../core/types'
import {
  buildPrintReadyHtmlExport,
  buildPreviewSvgExport,
  downloadPrintReadyHtml,
  downloadPreviewPng,
  downloadPreviewSvg,
  openPrintReadyHtml,
  type HPrintHtmlExportResult,
} from '../core/exportArtifacts'

const props = withDefaults(defineProps<{
  modelValue: boolean
  template: HPrintTemplate | null
  data?: Record<string, unknown>
  agentUrl?: string
  agentToken?: string
}>(), {
  data: () => ({}),
  agentUrl: '',
  agentToken: '',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'exported', value: HPrintHtmlExportResult, format?: 'html' | 'pdf' | 'preview' | 'svg' | 'png'): void
}>()

const fallbackTemplate: HPrintTemplate = {
  schemaVersion: '2026-06',
  name: '导出模板',
  paper: { width: 210, height: 297, unit: 'mm' },
  components: [],
}

const filename = ref('')
const error = ref('')
const exportingPdf = ref(false)
const AGENT_PDF_TIMEOUT_MS = 120_000

function normalizeAgentUrl(agentUrl?: string): string {
  return (agentUrl || '').trim().replace(/\/+$/, '')
}

const exportResult = computed(() => buildPrintReadyHtmlExport(props.template || fallbackTemplate, {
  data: props.data,
  filename: filename.value || props.template?.name || 'hprint-template',
}))
const agentBaseUrl = computed(() => normalizeAgentUrl(props.agentUrl))
const imageExportResult = computed(() => buildPreviewSvgExport(props.template || fallbackTemplate, {
  data: props.data,
  filename: filename.value || props.template?.name || 'hprint-preview',
}))
const orientationLabel = computed(() => exportResult.value.orientation === 'landscape' ? '横向' : '纵向')
const htmlSizeKb = computed(() => Math.max(1, Math.ceil(new Blob([exportResult.value.html]).size / 1024)))

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      filename.value = props.template?.name || 'hprint-template'
      error.value = ''
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

function downloadHtml() {
  if (!exportResult.value.html) return
  downloadPrintReadyHtml(exportResult.value)
  emit('exported', exportResult.value, 'html')
}

async function exportViaAgent() {
  if (!agentBaseUrl.value || !props.template) return
  exportingPdf.value = true
  error.value = ''
  const controller = new AbortController()
  const timeoutId = window.setTimeout(() => controller.abort(), AGENT_PDF_TIMEOUT_MS)
  try {
    const resp = await fetch(`${agentBaseUrl.value}/export/pdf`, {
      method: 'POST',
      signal: controller.signal,
      headers: {
        'Content-Type': 'application/json',
        ...(props.agentToken ? { Authorization: `Bearer ${props.agentToken}` } : {}),
      },
      body: JSON.stringify({
        template: props.template,
        data: props.data,
        html: exportResult.value.html,
        paper: {
          width: exportResult.value.widthMm,
          height: exportResult.value.heightMm,
          orientation: exportResult.value.orientation,
        },
      }),
    })
    if (!resp.ok) {
      const err = await resp.json().catch(() => ({ error: resp.statusText }))
      throw new Error(err.error || resp.statusText)
    }
    const result = await resp.json()
    const pdfBytes = Uint8Array.from(atob(result.pdf), c => c.charCodeAt(0))
    const blob = new Blob([pdfBytes], { type: 'application/pdf' })
    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = filename.value.replace(/\.html$/, '.pdf')
    a.click()
    URL.revokeObjectURL(url)
    emit('exported', exportResult.value, 'pdf')
  } catch (e) {
    if (e instanceof DOMException && e.name === 'AbortError') {
      error.value = 'Agent PDF 导出超时，请检查 Agent 状态或稍后重试。'
    } else {
      error.value = 'Agent PDF 导出失败: ' + (e as Error).message
    }
  } finally {
    window.clearTimeout(timeoutId)
    exportingPdf.value = false
  }
}

function downloadSvg() {
  downloadPreviewSvg(imageExportResult.value)
  emit('exported', exportResult.value, 'svg')
}

async function downloadPng() {
  error.value = ''
  try {
    await downloadPreviewPng(imageExportResult.value)
    emit('exported', exportResult.value, 'png')
  } catch (err) {
    error.value = (err as Error).message || 'PNG 导出失败，请改用 SVG 或 HTML。'
  }
}

function openHtml() {
  error.value = ''
  if (!openPrintReadyHtml(exportResult.value)) {
    error.value = '浏览器阻止了新窗口，请允许弹窗后重试。'
    return
  }
  emit('exported', exportResult.value, 'preview')
}
</script>

<style scoped>
.pdf-export-mask {
  position: fixed;
  inset: 0;
  z-index: 2120;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}
.pdf-export-dialog {
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
.summary {
  display: grid;
  gap: 8px;
  padding: 12px;
  color: #334155;
  background: #f8fafc;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.field-row {
  display: grid;
  gap: 6px;
  color: #334155;
  font-size: 13px;
}
.field-row input {
  height: 34px;
  padding: 0 10px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  outline: none;
}
.field-row input:focus {
  border-color: #2563eb;
}
.alert {
  padding: 10px 12px;
  color: #b45309;
  background: #fffbeb;
  border: 1px solid #fde68a;
  border-radius: 6px;
}
.icon-button {
  width: 30px;
  height: 30px;
  border: 0;
  background: transparent;
  font-size: 20px;
  cursor: pointer;
}
.button {
  min-width: 82px;
  height: 34px;
  padding: 0 12px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.button.primary {
  border-color: #2563eb;
  color: #fff;
  background: #2563eb;
}
</style>
