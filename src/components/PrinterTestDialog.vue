<template>
  <div v-if="modelValue" class="test-mask" @click.self="close">
    <section class="test-dialog" role="dialog" aria-modal="true">
      <header class="dialog-header">
        <h2>打印机测试</h2>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="dialog-body">
        <div v-if="error" class="alert">{{ error }}</div>

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

        <section class="usage-card">
          <div class="usage-summary">
            <div>
              <strong>{{ activeUsageLabel }}测试页</strong>
              <p>{{ activeDescription }}</p>
            </div>
            <button class="button primary" type="button" :disabled="loading" @click="printUsageTest(activeUsage)">
              {{ loading ? '测试中...' : '打印测试页' }}
            </button>
          </div>

          <dl class="config-list">
            <div>
              <dt>打印机</dt>
              <dd>{{ activeConfig?.printerName || '未配置' }}</dd>
            </div>
            <div>
              <dt>模式</dt>
              <dd>{{ activeConfig?.renderMode || '自动' }}</dd>
            </div>
            <div>
              <dt>协议</dt>
              <dd>{{ activeConfig?.rawProtocol || '自动' }}</dd>
            </div>
          </dl>

          <button
            v-if="activeUsage === 'receipt'"
            class="button"
            type="button"
            :disabled="loading"
            @click="testEscPosRaw"
          >
            ESC/POS RAW 直测
          </button>
        </section>

        <section v-if="lastResult" class="result-box">
          <strong>最近结果</strong>
          <p>任务：{{ lastResult.jobId }}</p>
          <p>状态：{{ lastResult.status }}</p>
          <p v-if="lastResult.renderMode">模式：{{ lastResult.renderMode }}</p>
          <p v-if="lastResult.message">信息：{{ lastResult.message }}</p>
        </section>
      </div>

      <footer class="dialog-footer">
        <button class="button" type="button" :disabled="loading" @click="loadSettings">刷新配置</button>
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
  HPrintPrinterSettings,
  HPrintPrintUsage,
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
  (event: 'tested', value: HPrintJobDetail): void
}>()

const usages: Array<{ key: HPrintPrintUsage; label: string }> = [
  { key: 'label', label: '标签' },
  { key: 'receipt', label: '小票' },
  { key: 'document', label: '文档' },
]

const activeUsage = ref<HPrintPrintUsage>('label')
const settings = ref<HPrintPrinterSettings | null>(null)
const loading = ref(false)
const error = ref('')
const lastResult = ref<HPrintJobDetail | null>(null)

const activeConfig = computed(() => settings.value?.printerSettings?.[activeUsage.value])
const activeUsageLabel = computed(() => printUsageLabel(activeUsage.value))
const activeDescription = computed(() => {
  if (activeUsage.value === 'document') return '走普通文档链路，适合验证 A4/WebView 打印。'
  if (activeUsage.value === 'receipt') return '走小票链路，适合验证 58/80mm 小票和 ESC/POS 能力。'
  return '走标签链路，适合验证 TSPL/CPCL/位图标签输出。'
})

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
  try {
    settings.value = await createAgentClient({
      agentUrl: props.agentUrl,
      token: props.agentToken || undefined,
    }).getPrinterSettings()
  } catch (err) {
    error.value = (err as Error).message || '读取打印配置失败'
  } finally {
    loading.value = false
  }
}

async function printUsageTest(usage: HPrintPrintUsage) {
  loading.value = true
  error.value = ''
  lastResult.value = null
  try {
    const client = createAgentClient({
      agentUrl: props.agentUrl,
      token: props.agentToken || undefined,
      printTimeout: 90000,
    })
    const detail = await client.printAndWait({
      template: testTemplateFor(usage),
      data: testData,
      usage,
      documentName: `${printUsageLabel(usage)}测试页`,
    })
    lastResult.value = detail
    emit('tested', detail)
  } catch (err) {
    error.value = (err as Error).message || '打印测试失败'
  } finally {
    loading.value = false
  }
}

async function testEscPosRaw() {
  loading.value = true
  error.value = ''
  try {
    const client = createAgentClient({ agentUrl: props.agentUrl, token: props.agentToken || undefined })
    await client.testRaw({
      printerName: activeConfig.value?.printerName,
      text: 'HPrint ESC/POS RAW Test\n中文测试\n',
      cut: true,
    })
    await printUsageTest('receipt')
  } catch (err) {
    error.value = (err as Error).message || 'ESC/POS RAW 测试失败'
  } finally {
    loading.value = false
  }
}

function testTemplateFor(usage: HPrintPrintUsage): HPrintTemplate {
  if (usage === 'document') return documentTemplate
  if (usage === 'receipt') return receiptTemplate
  return labelTemplate
}

const testData = {
  title: 'HPrint 测试页',
  time: '2026-06-09 10:30:00',
  code: 'HP-TEST-20260609',
}

const labelTemplate: HPrintTemplate = {
  schemaVersion: '2026-06',
  name: '标签测试页',
  paper: { width: 80, height: 60, unit: 'mm' },
  components: [
    { id: 't1', type: 'text', x: 4, y: 4, width: 72, height: 8, options: { content: '{{title}}', fontSize: 16, fontWeight: 'bold', textAlign: 'center' } },
    { id: 'l1', type: 'line', x: 4, y: 14, width: 72, height: 1, options: { lineWidth: 1 } },
    { id: 't2', type: 'text', x: 4, y: 18, width: 48, height: 8, options: { content: '标签/位图链路', fontSize: 12 } },
    { id: 'qr', type: 'qrcode', x: 56, y: 18, width: 18, height: 18, options: { content: '{{code}}', margin: 0 } },
    { id: 't3', type: 'text', x: 4, y: 42, width: 72, height: 6, options: { content: '{{time}}', fontSize: 10 } },
  ],
}

const receiptTemplate: HPrintTemplate = {
  schemaVersion: '2026-06',
  name: '小票测试页',
  paper: { width: 80, height: 120, unit: 'mm' },
  printOptions: { cut: 'full' },
  components: [
    { id: 't1', type: 'text', x: 2, y: 2, width: 76, height: 9, options: { content: '{{title}}', fontSize: 18, fontWeight: 'bold', textAlign: 'center' } },
    { id: 'l1', type: 'line', x: 2, y: 14, width: 76, height: 1, options: { lineWidth: 1 } },
    { id: 't2', type: 'text', x: 2, y: 18, width: 76, height: 7, options: { content: '小票 / ESC/POS / raw-raster', fontSize: 12, textAlign: 'center' } },
    { id: 't3', type: 'text', x: 2, y: 30, width: 76, height: 7, options: { content: '时间: {{time}}', fontSize: 12 } },
    { id: 'qr', type: 'qrcode', x: 30, y: 42, width: 20, height: 20, options: { content: '{{code}}', margin: 0 } },
  ],
}

const documentTemplate: HPrintTemplate = {
  schemaVersion: '2026-06',
  name: '文档测试页',
  paper: { width: 210, height: 297, unit: 'mm' },
  components: [
    { id: 't1', type: 'text', x: 20, y: 20, width: 170, height: 14, options: { content: '{{title}}', fontSize: 24, fontWeight: 'bold', textAlign: 'center' } },
    { id: 'l1', type: 'line', x: 20, y: 40, width: 170, height: 1, options: { lineWidth: 1 } },
    { id: 't2', type: 'text', x: 20, y: 50, width: 170, height: 10, options: { content: '普通文档 / WebView 打印链路', fontSize: 14 } },
    { id: 't3', type: 'text', x: 20, y: 66, width: 170, height: 8, options: { content: '时间: {{time}}', fontSize: 12 } },
    { id: 'rect', type: 'rect', x: 20, y: 84, width: 60, height: 24, options: { borderWidth: 1, borderStyle: 'dashed', backgroundColor: '#ffffff' } },
  ],
}
</script>

<style scoped>
.test-mask {
  position: fixed;
  inset: 0;
  z-index: 2050;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}
.test-dialog {
  width: min(680px, 100%);
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
  grid-template-columns: repeat(3, 1fr);
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
.usage-card,
.result-box {
  display: grid;
  gap: 12px;
  padding: 14px;
  border: 1px solid #e2e8f0;
  border-radius: 6px;
  background: #fff;
}
.usage-summary {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 12px;
}
.usage-summary p,
.result-box p {
  margin: 4px 0 0;
  color: #64748b;
}
.config-list {
  display: grid;
  gap: 8px;
  margin: 0;
}
.config-list div {
  display: grid;
  grid-template-columns: 64px 1fr;
  gap: 10px;
}
.config-list dt {
  color: #64748b;
}
.config-list dd {
  margin: 0;
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
.alert {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
}
</style>
