<template>
  <div v-if="modelValue" class="calibration-mask" @click.self="close">
    <section class="calibration-dialog" role="dialog" aria-modal="true">
      <header class="dialog-header">
        <h2>小票/标签校准</h2>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="dialog-body">
        <div v-if="error" class="alert">{{ error }}</div>
        <div v-if="saved" class="success">校准参数已保存</div>

        <div class="usage-tabs">
          <button
            v-for="item in usages"
            :key="item.key"
            type="button"
            :class="{ active: activeUsage === item.key }"
            @click="activeUsage = item.key"
          >
            {{ item.label }}
          </button>
        </div>

        <section v-if="activeConfig" class="calibration-grid">
          <div class="form-panel">
            <h3>{{ activeUsageLabel }}参数</h3>
            <label>
              打印机
              <input :value="activeConfig.printerName || '未配置'" readonly />
            </label>
            <label>
              可打印宽 mm
              <input v-model.number="activeConfig.printableWidthMm" type="number" min="1" />
            </label>
            <label>
              可打印点宽
              <input v-model.number="activeConfig.printableWidthDots" type="number" min="1" />
            </label>
            <template v-if="activeUsage === 'label'">
              <label>
                标签介质
                <select v-model="activeConfig.labelMediaType">
                  <option value="gap">间隙纸</option>
                  <option value="blackMark">黑标纸</option>
                  <option value="continuous">连续纸</option>
                </select>
              </label>
              <label v-if="activeConfig.labelMediaType !== 'continuous'">
                间隙/黑标 mm
                <input
                  v-if="activeConfig.labelMediaType === 'blackMark'"
                  v-model.number="activeConfig.blackMarkMm"
                  type="number"
                  min="0"
                  step="0.1"
                />
                <input
                  v-else
                  v-model.number="activeConfig.gapMm"
                  type="number"
                  min="0"
                  step="0.1"
                />
              </label>
              <label v-if="activeConfig.labelMediaType !== 'continuous'">
                传感器偏移 mm
                <input v-model.number="activeConfig.gapOffsetMm" type="number" step="0.1" />
              </label>
              <label>
                停止偏移 mm
                <input v-model.number="activeConfig.tearOffsetMm" type="number" step="0.1" />
              </label>
            </template>
            <label>
              阈值
              <input v-model.number="calibration.threshold" type="number" min="0" max="255" />
            </label>
            <label class="checkbox-field">
              <input v-model="calibration.invertMono" type="checkbox" />
              黑白反转
            </label>
            <label>
              横向缩放
              <input v-model.number="calibration.scaleX" type="number" step="0.01" />
            </label>
            <label>
              纵向缩放
              <input v-model.number="calibration.scaleY" type="number" step="0.01" />
            </label>
            <label>
              X 偏移 mm
              <input v-model.number="calibration.offsetXMm" type="number" step="0.1" />
            </label>
            <label>
              Y 偏移 mm
              <input v-model.number="calibration.offsetYMm" type="number" step="0.1" />
            </label>
            <label>
              顶部裁剪 mm
              <input v-model.number="calibration.topCropMm" type="number" step="0.1" />
            </label>
          </div>

          <div class="guide-panel">
            <h3>校准方法</h3>
            <ol>
              <li>先保存参数，再打印校准页。</li>
              <li>顶部有空白时，逐步增加顶部裁剪。</li>
              <li>整体偏左/偏右时调整 X 偏移。</li>
              <li>宽度不准时优先检查可打印宽和点宽，再微调横向缩放。</li>
              <li>二维码或文字发虚时调整阈值。</li>
            </ol>
            <button class="button primary" type="button" :disabled="loading" @click="saveAndPrint">
              {{ loading ? '处理中...' : '保存并打印校准页' }}
            </button>
          </div>

          <div class="auto-calc-panel">
            <h3>自动计算缩放</h3>
            <p class="calc-hint">打印校准页后，用尺子测量实际打印宽度和高度，输入后自动计算缩放比例。</p>
            <label>
              预期宽度 mm
              <input v-model.number="autoCalc.expectedWidth" type="number" min="1" />
            </label>
            <label>
              实测宽度 mm
              <input v-model.number="autoCalc.actualWidth" type="number" min="1" />
            </label>
            <label>
              预期高度 mm
              <input v-model.number="autoCalc.expectedHeight" type="number" min="1" />
            </label>
            <label>
              实测高度 mm
              <input v-model.number="autoCalc.actualHeight" type="number" min="1" />
            </label>
            <div v-if="autoCalcResult" class="calc-result">
              <span>横向缩放: <strong>{{ autoCalcResult.scaleX }}</strong></span>
              <span>纵向缩放: <strong>{{ autoCalcResult.scaleY }}</strong></span>
            </div>
            <button class="button" type="button" @click="applyAutoCalc" :disabled="!autoCalcResult">应用计算结果</button>
          </div>
        </section>
      </div>

      <footer class="dialog-footer">
        <button class="button" type="button" :disabled="loading" @click="loadSettings">刷新</button>
        <button class="button" type="button" :disabled="loading" @click="saveSettings">保存</button>
        <button class="button" type="button" @click="close">关闭</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createAgentClient } from '../client/agentClient'
import { printUsageLabel } from '../core/printUsage'
import type {
  HPrintJobDetail,
  HPrintPrintUsage,
  HPrintPrinterSettings,
  HPrintPrinterUsageConfig,
  HPrintRasterCalibration,
  HPrintTemplate,
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
  (event: 'tested', value: HPrintJobDetail): void
}>()

const usages: Array<{ key: HPrintPrintUsage; label: string }> = [
  { key: 'label', label: '标签' },
  { key: 'receipt', label: '小票' },
]

const activeUsage = ref<HPrintPrintUsage>('label')
const settings = ref<HPrintPrinterSettings | null>(null)
const loading = ref(false)
const error = ref('')
const saved = ref(false)

const autoCalc = ref({ expectedWidth: 0, actualWidth: 0, expectedHeight: 0, actualHeight: 0 })

const autoCalcResult = computed(() => {
  const { expectedWidth, actualWidth, expectedHeight, actualHeight } = autoCalc.value
  if (actualWidth <= 0 || actualHeight <= 0 || expectedWidth <= 0 || expectedHeight <= 0) return null
  return {
    scaleX: Math.round((expectedWidth / actualWidth) * 10000) / 10000,
    scaleY: Math.round((expectedHeight / actualHeight) * 10000) / 10000,
  }
})

function applyAutoCalc() {
  if (!autoCalcResult.value || !calibration.value) return
  calibration.value.scaleX = autoCalcResult.value.scaleX
  calibration.value.scaleY = autoCalcResult.value.scaleY
}

const activeConfig = computed(() => settings.value?.printerSettings?.[activeUsage.value])
const activeUsageLabel = computed(() => printUsageLabel(activeUsage.value))
const calibration = computed(() => ensureCalibration(activeConfig.value, activeUsage.value))

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) loadSettings()
  },
)

function close() {
  emit('update:modelValue', false)
}

async function loadSettings() {
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    settings.value = await createAgentClient({
      agentUrl: props.agentUrl,
      token: props.agentToken || undefined,
    }).getPrinterSettings()
    for (const usage of usages) {
      ensureUsageConfig(usage.key)
    }
  } catch (err) {
    error.value = (err as Error).message || '读取校准配置失败'
  } finally {
    loading.value = false
  }
}

async function saveSettings() {
  if (!settings.value) return
  loading.value = true
  error.value = ''
  saved.value = false
  try {
    const result = await createAgentClient({
      agentUrl: props.agentUrl,
      token: props.agentToken || undefined,
    }).savePrinterSettings(settings.value)
    settings.value = result
    ensureUsageConfig(activeUsage.value)
    saved.value = true
    emit('saved', result)
  } catch (err) {
    error.value = (err as Error).message || '保存校准配置失败'
  } finally {
    loading.value = false
  }
}

async function saveAndPrint() {
  await saveSettings()
  if (error.value) return
  await printCalibration()
}

async function printCalibration() {
  loading.value = true
  error.value = ''
  try {
    const client = createAgentClient({
      agentUrl: props.agentUrl,
      token: props.agentToken || undefined,
      printTimeout: 90000,
    })
    const detail = await client.printAndWait({
      template: calibrationTemplate(activeUsage.value),
      data: {
        usage: activeUsageLabel.value,
        width: activeConfig.value?.printableWidthMm ?? '',
        dots: activeConfig.value?.printableWidthDots ?? '',
      },
      usage: activeUsage.value,
      documentName: `${activeUsageLabel.value}校准页`,
    })
    emit('tested', detail)
  } catch (err) {
    error.value = (err as Error).message || '打印校准页失败'
  } finally {
    loading.value = false
  }
}

function ensureUsageConfig(usage: HPrintPrintUsage): HPrintPrinterUsageConfig {
  if (!settings.value) {
    settings.value = { printerSettings: { label: {}, receipt: {}, document: {} } }
  }
  if (!settings.value.printerSettings[usage]) {
    settings.value.printerSettings[usage] = {}
  }
  const config = settings.value.printerSettings[usage]
  if (!config.paper) {
    config.paper = { width: 80, height: usage === 'label' ? 60 : 120, unit: 'mm' }
  }
  if (config.printableWidthMm === undefined) {
    config.printableWidthMm = usage === 'receipt' ? 72 : 80
  }
  if (config.printableWidthDots === undefined) {
    config.printableWidthDots = usage === 'receipt' ? 576 : 640
  }
  if (usage === 'label') {
    config.labelMediaType ??= 'gap'
    config.gapMm ??= 2
    config.gapOffsetMm ??= 0
  }
  ensureCalibration(config, usage)
  return config
}

function ensureCalibration(
  config?: HPrintPrinterUsageConfig,
  usage: HPrintPrintUsage = activeUsage.value,
): HPrintRasterCalibration {
  if (!config) return {}
  if (!config.rasterCalibration) {
    config.rasterCalibration = {}
  }
  config.rasterCalibration.scaleX ??= 1
  config.rasterCalibration.scaleY ??= 1
  config.rasterCalibration.offsetXMm ??= 0
  config.rasterCalibration.offsetYMm ??= 0
  config.rasterCalibration.topCropMm ??= 0
  config.rasterCalibration.threshold ??= 210
  config.rasterCalibration.invertMono ??= usage === 'label'
  return config.rasterCalibration
}

function calibrationTemplate(usage: HPrintPrintUsage): HPrintTemplate {
  const width = activeConfig.value?.paper?.width || 80
  const height = activeConfig.value?.paper?.height || (usage === 'label' ? 60 : 120)
  return {
    schemaVersion: '2026-06',
    name: `${printUsageLabel(usage)}校准页`,
    paper: { width, height, unit: 'mm' },
    components: [
      { id: 'top', type: 'line', x: 0, y: 0, width, height: 1, options: { lineWidth: 1 } },
      { id: 'left', type: 'line', x: 0, y: 0, width: 1, height, options: { direction: 'vertical', lineWidth: 1 } },
      { id: 'right', type: 'line', x: Math.max(width - 1, 0), y: 0, width: 1, height, options: { direction: 'vertical', lineWidth: 1 } },
      { id: 'title', type: 'text', x: 3, y: 3, width: Math.max(width - 6, 10), height: 7, options: { content: '{{usage}}校准页', fontSize: 13, fontWeight: 'bold', textAlign: 'center' } },
      { id: 'scale1', type: 'line', x: 5, y: 15, width: Math.max(width - 10, 10), height: 1, options: { lineWidth: 1 } },
      { id: 'scale2', type: 'line', x: 5, y: 25, width: Math.max(width - 10, 10), height: 1, options: { lineWidth: 1, lineStyle: 'dashed' } },
      { id: 'text', type: 'text', x: 5, y: 30, width: Math.max(width - 10, 10), height: 12, options: { content: '宽 {{width}}mm / {{dots}} dots', fontSize: 11, textAlign: 'center' } },
      { id: 'qr', type: 'qrcode', x: Math.max(width / 2 - 10, 2), y: 44, width: 20, height: 20, options: { content: 'HPRINT-CALIBRATION', margin: 0 } },
    ],
  }
}
</script>

<style scoped>
.calibration-mask {
  position: fixed;
  inset: 0;
  z-index: 2060;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}
.calibration-dialog {
  width: min(760px, 100%);
  max-height: calc(100vh - 48px);
  display: flex;
  flex-direction: column;
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
  overflow: auto;
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
.usage-tabs {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  overflow: hidden;
}
.usage-tabs button {
  height: 34px;
  border: none;
  border-right: 1px solid #cbd5e1;
  background: #fff;
  cursor: pointer;
}
.usage-tabs button:last-child {
  border-right: none;
}
.usage-tabs button.active {
  background: #eff6ff;
  color: #2563eb;
  font-weight: 600;
}
.calibration-grid {
  display: grid;
  grid-template-columns: minmax(280px, 1fr) 280px;
  gap: 16px;
}
.form-panel,
.guide-panel {
  display: grid;
  align-content: start;
  gap: 10px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
}
.form-panel h3,
.guide-panel h3 {
  margin: 0;
  font-size: 14px;
}
.form-panel label {
  display: grid;
  grid-template-columns: 108px 1fr;
  align-items: center;
  gap: 8px;
  color: #475569;
}
.form-panel input {
  height: 32px;
  min-width: 0;
  padding: 0 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}
.form-panel .checkbox-field input {
  height: auto;
  width: auto;
  justify-self: start;
}
.guide-panel ol {
  margin: 0;
  padding-left: 18px;
  color: #475569;
  line-height: 1.7;
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
.alert,
.success {
  padding: 10px 12px;
  border-radius: 6px;
}
.alert {
  border: 1px solid #fecaca;
  background: #fef2f2;
  color: #b91c1c;
}
.success {
  border: 1px solid #bbf7d0;
  background: #f0fdf4;
  color: #15803d;
}
.auto-calc-panel {
  display: grid;
  align-content: start;
  gap: 8px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  grid-column: span 2;
}
.auto-calc-panel h3 {
  margin: 0;
  font-size: 14px;
}
.calc-hint {
  margin: 0;
  color: #64748b;
  font-size: 12px;
}
.auto-calc-panel label {
  display: grid;
  grid-template-columns: 108px 1fr;
  align-items: center;
  gap: 8px;
  color: #475569;
  font-size: 13px;
}
.auto-calc-panel input {
  height: 32px;
  min-width: 0;
  padding: 0 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
}
.calc-result {
  display: flex;
  gap: 16px;
  padding: 6px 10px;
  background: #f0f9ff;
  border-radius: 4px;
  color: #1d4ed8;
  font-size: 13px;
}
.calc-result strong {
  color: #2563eb;
}
@media (max-width: 720px) {
  .calibration-grid {
    grid-template-columns: 1fr;
  }
}
</style>
