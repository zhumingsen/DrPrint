<template>
  <div v-if="modelValue" class="printer-settings-mask" @click.self="close">
    <section class="printer-settings-dialog" role="dialog" aria-modal="true">
      <header class="dialog-header">
        <h2>打印机设置</h2>
        <button class="icon-button" type="button" @click="close" aria-label="关闭">×</button>
      </header>

      <div class="dialog-body">
        <div v-if="error" class="alert alert-error">{{ error }}</div>
        <div v-if="saved" class="alert alert-success">已保存打印机设置</div>

        <label class="global-preview-toggle">
          <input v-model="settings.previewBeforePrint" type="checkbox" />
          <span>打印前先预览</span>
        </label>

        <div class="settings-table">
          <div class="settings-head">
            <span>类型</span>
            <span>打印机</span>
            <span>模式</span>
            <span>协议</span>
            <span>操作</span>
          </div>

          <div v-for="item in usages" :key="item.key" class="settings-row">
            <label class="usage-label" :class="{ required: item.required }">{{ item.label }}</label>

            <select v-model="settings.printerSettings[item.key].printerName" class="field">
              <option value="">请选择{{ item.label }}</option>
              <option v-for="printer in printers" :key="printer.name" :value="printer.name">
                {{ printer.name }}{{ printer.isDefault ? '（默认）' : '' }}
              </option>
            </select>

            <select v-model="settings.printerSettings[item.key].renderMode" class="field compact">
              <option value="">自动</option>
              <option value="raw-raster">位图打印</option>
              <option value="raw-text">高速文本</option>
              <option value="webview">文档打印</option>
            </select>

            <select v-model="settings.printerSettings[item.key].rawProtocol" class="field compact">
              <option value="">自动</option>
              <option value="tspl">TSPL</option>
              <option value="cpcl">CPCL</option>
              <option value="escpos">ESC/POS</option>
              <option value="none">无</option>
            </select>

            <div class="row-actions">
              <button type="button" class="text-button" @click="applyDetected(item.key)">应用识别</button>
              <button type="button" class="text-button" @click="toggleAdvanced(item.key)">
                {{ advancedUsage === item.key ? '收起' : '高级' }}
              </button>
            </div>

            <div v-if="advancedUsage === item.key" class="advanced-panel">
              <label>
                纸宽 mm
                <input v-model.number="paperFor(item.key).width" type="number" min="1" class="field" />
              </label>
              <label>
                纸高 mm
                <input v-model.number="paperFor(item.key).height" type="number" min="1" class="field" />
              </label>
              <label>
                方向
                <select :value="paperFor(item.key).orientation || ''" class="field" @change="updateOrientation(item.key, eventValue($event))">
                  <option value="">自动</option>
                  <option value="portrait">纵向</option>
                  <option value="landscape">横向</option>
                </select>
              </label>
              <label>
                纸张策略
                <select v-model="settings.printerSettings[item.key].paperPolicy" class="field">
                  <option value="template">模板优先</option>
                  <option value="configFallback">配置兜底</option>
                  <option value="configOverride">强制配置</option>
                </select>
              </label>
              <label>
                点宽
                <input v-model.number="settings.printerSettings[item.key].printableWidthDots" type="number" min="1" class="field" />
              </label>
              <label>
                可打印宽 mm
                <input v-model.number="settings.printerSettings[item.key].printableWidthMm" type="number" min="1" class="field" />
              </label>
              <label v-if="item.key === 'receipt'">
                切刀补偿 mm
                <input v-model.number="settings.printerSettings[item.key].cutterFeedMm" type="number" min="0" step="0.5" class="field" />
              </label>
              <label v-if="item.key === 'label'">
                标签介质
                <select v-model="settings.printerSettings[item.key].labelMediaType" class="field">
                  <option value="gap">间隙纸</option>
                  <option value="blackMark">黑标纸</option>
                  <option value="continuous">连续纸</option>
                </select>
              </label>
              <label v-if="item.key === 'label' && settings.printerSettings[item.key].labelMediaType !== 'continuous'">
                间隙/黑标 mm
                <input
                  v-if="settings.printerSettings[item.key].labelMediaType === 'blackMark'"
                  v-model.number="settings.printerSettings[item.key].blackMarkMm"
                  type="number"
                  min="0"
                  step="0.1"
                  class="field"
                />
                <input
                  v-else
                  v-model.number="settings.printerSettings[item.key].gapMm"
                  type="number"
                  min="0"
                  step="0.1"
                  class="field"
                />
              </label>
              <label v-if="item.key === 'label' && settings.printerSettings[item.key].labelMediaType !== 'continuous'">
                传感器偏移 mm
                <input v-model.number="settings.printerSettings[item.key].gapOffsetMm" type="number" step="0.1" class="field" />
              </label>
              <label v-if="item.key === 'label'">
                停止偏移 mm
                <input v-model.number="settings.printerSettings[item.key].tearOffsetMm" type="number" step="0.1" class="field" />
              </label>
              <label>
                阈值
                <input v-model.number="calibrationFor(item.key).threshold" type="number" min="0" max="255" class="field" />
              </label>
              <label class="checkbox-field">
                <input v-model="calibrationFor(item.key).invertMono" type="checkbox" />
                黑白反转
              </label>
              <label>
                顶部裁剪 mm
                <input v-model.number="calibrationFor(item.key).topCropMm" type="number" class="field" />
              </label>
              <label>
                X 偏移 mm
                <input v-model.number="calibrationFor(item.key).offsetXMm" type="number" class="field" />
              </label>
              <label>
                Y 偏移 mm
                <input v-model.number="calibrationFor(item.key).offsetYMm" type="number" class="field" />
              </label>
            </div>
          </div>
        </div>

        <div class="recommendation">
          <strong>推荐打印机型号：</strong>
          <p>标签机：佳博 GP-3120TL，优先使用 TSPL，不通时尝试 CPCL。</p>
          <p>小票机：佳博 GP-80160 或 80mm 热敏票据机，优先使用 ESC/POS。</p>
          <p>文档：A4、清单、拣货单、配送单等普通文档，优先使用 WebView。</p>
        </div>
      </div>

      <footer class="dialog-footer">
        <button type="button" class="button" @click="close">取消</button>
        <button type="button" class="button primary" :disabled="loading" @click="save">
          {{ loading ? '保存中...' : '确定' }}
        </button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { ref, watch } from 'vue'
import { createAgentClient } from '../client'
import type {
  HPrintPrinter,
  HPrintPrinterSettings,
  HPrintPrintUsage,
  HPrintPrinterUsagePaper,
  HPrintRasterCalibration,
} from '../core/types'

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
  (event: 'saved', value: HPrintPrinterSettings): void
}>()

const usages: Array<{ key: HPrintPrintUsage; label: string; required: boolean }> = [
  { key: 'label', label: '标签', required: true },
  { key: 'receipt', label: '小票', required: false },
  { key: 'document', label: '文档', required: false },
]

const loading = ref(false)
const saved = ref(false)
const error = ref('')
const printers = ref<HPrintPrinter[]>([])
const advancedUsage = ref<HPrintPrintUsage | ''>('')
const settings = ref(defaultSettings())

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) load()
  },
  { immediate: true }
)

function defaultSettings(): HPrintPrinterSettings {
  return {
    previewBeforePrint: true,
    printerSettings: {
      label: {
        printerName: '',
        renderMode: 'raw-raster',
        rawProtocol: 'tspl',
        paper: { width: 80, height: 60, unit: 'mm' },
        paperPolicy: 'template',
        printableWidthMm: 80,
        printableWidthDots: 640,
        labelMediaType: 'gap',
        gapMm: 2,
        gapOffsetMm: 0,
        rasterCalibration: { scaleX: 1, scaleY: 1, threshold: 210, invertMono: true },
      },
      receipt: {
        printerName: '',
        renderMode: 'raw-raster',
        rawProtocol: 'escpos',
        paper: { width: 80, height: 200, unit: 'mm' },
        paperPolicy: 'template',
        printableWidthMm: 72,
        printableWidthDots: 576,
        cutterFeedMm: 18,
      },
      document: {
        printerName: '',
        renderMode: 'webview',
        rawProtocol: 'none',
        paper: { width: 210, height: 297, unit: 'mm' },
        paperPolicy: 'template',
      },
    },
  }
}

async function load() {
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    const client = createAgentClient({ agentUrl: props.agentUrl, token: props.agentToken || undefined })
    const [printerList, remoteSettings] = await Promise.all([
      client.listPrinters(),
      client.getPrinterSettings(),
    ])
    printers.value = printerList
    settings.value = mergeSettings(defaultSettings(), remoteSettings)
  } catch (err) {
    error.value = (err as Error).message || '加载打印机设置失败'
  } finally {
    loading.value = false
  }
}

async function save() {
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    const client = createAgentClient({ agentUrl: props.agentUrl, token: props.agentToken || undefined })
    const result = await client.savePrinterSettings(settings.value)
    settings.value = mergeSettings(defaultSettings(), result)
    saved.value = true
    emit('saved', settings.value)
  } catch (err) {
    error.value = (err as Error).message || '保存打印机设置失败'
  } finally {
    loading.value = false
  }
}

function close() {
  emit('update:modelValue', false)
}

function toggleAdvanced(usage: HPrintPrintUsage) {
  advancedUsage.value = advancedUsage.value === usage ? '' : usage
}

function paperFor(usage: HPrintPrintUsage): HPrintPrinterUsagePaper {
  const config = settings.value.printerSettings[usage]
  if (!config.paper) {
    config.paper = usage === 'document'
      ? { width: 210, height: 297, unit: 'mm' }
      : { width: 80, height: usage === 'label' ? 60 : 200, unit: 'mm' }
  }
  return config.paper
}

function calibrationFor(usage: HPrintPrintUsage): HPrintRasterCalibration {
  const config = settings.value.printerSettings[usage]
  if (!config.rasterCalibration) {
    config.rasterCalibration = { scaleX: 1, scaleY: 1, threshold: 210 }
  }
  if (usage === 'label') {
    config.labelMediaType ??= 'gap'
    config.gapMm ??= 2
    config.gapOffsetMm ??= 0
  }
  config.rasterCalibration.invertMono ??= usage === 'label'
  return config.rasterCalibration
}

function eventValue(event: Event): string {
  return (event.target as HTMLSelectElement).value
}

function updateOrientation(usage: HPrintPrintUsage, value: string) {
  const paper = paperFor(usage)
  if (value === 'portrait' || value === 'landscape') {
    paper.orientation = value
  } else {
    delete paper.orientation
  }
}

function applyDetected(usage: HPrintPrintUsage) {
  const config = settings.value.printerSettings[usage]
  const printer = printers.value.find((item) => item.name === config.printerName)
  if (!printer) return

  const capabilities = printer.capabilities
  if (capabilities.rawProtocol && capabilities.rawProtocol !== 'none') {
    config.rawProtocol = capabilities.rawProtocol
  }
  if (capabilities.printableWidthDots) {
    config.printableWidthDots = capabilities.printableWidthDots
  }
  if (capabilities.printableWidthMm) {
    config.printableWidthMm = capabilities.printableWidthMm
  }
  if (printer.printerType === 'document') {
    config.renderMode = 'webview'
    config.rawProtocol = 'none'
  } else {
    config.renderMode = 'raw-raster'
  }
}

function mergeSettings(base: HPrintPrinterSettings, incoming?: HPrintPrinterSettings): HPrintPrinterSettings {
  if (!incoming?.printerSettings) return base
  base.previewBeforePrint = incoming.previewBeforePrint ?? base.previewBeforePrint
  for (const usage of usages) {
    base.printerSettings[usage.key] = {
      ...base.printerSettings[usage.key],
      ...incoming.printerSettings[usage.key],
    }
  }
  return base
}
</script>

<style scoped>
.printer-settings-mask {
  position: fixed;
  inset: 0;
  z-index: 2000;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.45);
}
.printer-settings-dialog {
  width: min(760px, calc(100vw - 32px));
  max-height: calc(100vh - 32px);
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 6px;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.28);
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
  font-size: 18px;
  font-weight: 600;
  text-align: center;
}
.dialog-footer {
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #e5e7eb;
  border-bottom: 0;
}
.dialog-body {
  flex: 1;
  padding: 14px 18px;
  overflow: auto;
}
.icon-button {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.settings-table {
  border: 1px solid #e5e7eb;
  border-radius: 4px;
  overflow: hidden;
}
.settings-head,
.settings-row {
  display: grid;
  grid-template-columns: 76px minmax(180px, 1fr) 116px 104px 120px;
  gap: 10px;
  align-items: center;
}
.settings-head {
  padding: 9px 12px;
  background: #f8fafc;
  color: #475569;
  font-size: 12px;
  font-weight: 600;
  border-bottom: 1px solid #e5e7eb;
}
.settings-row {
  padding: 10px 12px;
  border-bottom: 1px solid #f1f5f9;
}
.settings-row:last-child {
  border-bottom: 0;
}
.usage-label {
  color: #e11d48;
  font-weight: 600;
}
.usage-label.required::before {
  content: "* ";
}
.field {
  width: 100%;
  height: 34px;
  padding: 0 10px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  color: #111827;
  font-size: 13px;
}
.field.compact {
  padding: 0 6px;
}
.row-actions {
  display: flex;
  gap: 8px;
}
.global-preview-toggle {
  display: flex;
  align-items: center;
  gap: 6px;
  margin-bottom: 12px;
  padding: 10px 12px;
  border: 1px solid #dbeafe;
  border-radius: 4px;
  background: #eff6ff;
  color: #475569;
  font-size: 13px;
}
.text-button {
  border: 0;
  padding: 0;
  color: #2563eb;
  background: transparent;
  cursor: pointer;
  font-size: 12px;
}
.advanced-panel {
  grid-column: 1 / -1;
  display: grid;
  grid-template-columns: repeat(4, minmax(120px, 1fr));
  gap: 10px;
  padding: 12px;
  background: #f8fafc;
  border: 1px solid #e5e7eb;
  border-radius: 4px;
}
.advanced-panel label {
  display: flex;
  flex-direction: column;
  gap: 5px;
  color: #475569;
  font-size: 12px;
}
.advanced-panel .checkbox-field {
  flex-direction: row;
  align-items: center;
  padding-top: 22px;
}
.checkbox-field input {
  width: auto;
  height: auto;
}
.recommendation {
  margin-top: 14px;
  color: #1d4ed8;
  font-size: 13px;
  line-height: 1.7;
}
.recommendation p {
  margin: 0;
}
.alert {
  margin-bottom: 10px;
  padding: 8px 10px;
  border-radius: 4px;
  font-size: 13px;
}
.alert-error {
  color: #b91c1c;
  background: #fef2f2;
  border: 1px solid #fecaca;
}
.alert-success {
  color: #166534;
  background: #f0fdf4;
  border: 1px solid #bbf7d0;
}
.button {
  min-width: 72px;
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.button.primary {
  border-color: #ef4444;
  color: #fff;
  background: #ef4444;
}
.button:disabled {
  opacity: 0.6;
  cursor: not-allowed;
}
@media (max-width: 720px) {
  .settings-head {
    display: none;
  }
  .settings-row {
    grid-template-columns: 1fr;
  }
  .advanced-panel {
    grid-template-columns: 1fr 1fr;
  }
}
</style>
