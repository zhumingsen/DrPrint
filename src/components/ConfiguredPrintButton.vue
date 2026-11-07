<template>
  <span class="configured-print">
    <button
      type="button"
      class="print-button"
      :disabled="disabled || loading"
      @click="handlePrint"
    >
      <slot>{{ loading ? loadingText : label }}</slot>
    </button>

    <PrintPreviewDialog
      :model-value="showPreview"
      :template="pendingPrint?.template || template"
      :data="pendingPrint?.data || data"
      @update:model-value="handlePreviewVisibleChange"
      @print="handlePreviewPrint"
    />

    <PrinterSettingsDialog
      v-model="showPrinterSettings"
      :agent-url="agentUrl"
      :agent-token="agentToken"
      @saved="handleSettingsSaved"
    />
  </span>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import { createAgentClient } from '../client/agentClient'
import { useHPrintConfiguredPrint } from '../composables/useHPrintConfiguredPrint'
import type {
  HPrintJobDetail,
  HPrintPrintUsage,
  HPrintRenderMode,
  HPrintTemplate,
} from '../core/types'
import PrintPreviewDialog from './PrintPreviewDialog.vue'
import PrinterSettingsDialog from './PrinterSettingsDialog.vue'
import type { PrintJobResponse } from '../client/agentClient'

const props = withDefaults(defineProps<{
  template: HPrintTemplate
  data?: Record<string, unknown>
  usage?: HPrintPrintUsage
  agentUrl?: string
  agentToken?: string
  copies?: number
  documentName?: string
  renderMode?: HPrintRenderMode
  printerName?: string
  disabled?: boolean
  label?: string
  loadingText?: string
  waitForComplete?: boolean
}>(), {
  data: () => ({}),
  agentUrl: 'http://127.0.0.1:17878',
  agentToken: '',
  copies: 1,
  label: '打印',
  loadingText: '打印中...',
  waitForComplete: false,
})

const emit = defineEmits<{
  (event: 'submitted', value: PrintJobResponse | HPrintJobDetail): void
  (event: 'error', value: Error): void
  (event: 'settingsSaved'): void
}>()

const {
  loading,
  showPreview,
  showPrinterSettings,
  pendingPrint,
  printWithConfig,
  confirmPreviewPrint,
  cancelPreview,
} = useHPrintConfiguredPrint({
  getClient: () => agentClient.value,
  waitForComplete: props.waitForComplete,
})

const agentClient = computed(() => createAgentClient({
  agentUrl: props.agentUrl,
  token: props.agentToken || undefined,
}))

async function handlePrint() {
  try {
    const result = await printWithConfig({
      template: props.template,
      data: props.data,
      usage: props.usage,
      printerName: props.printerName,
      copies: props.copies,
      documentName: props.documentName,
      renderMode: props.renderMode,
    })
    if (result) emit('submitted', result)
  } catch (err) {
    emit('error', err as Error)
  }
}

async function handlePreviewPrint() {
  try {
    const result = await confirmPreviewPrint()
    if (result) emit('submitted', result)
  } catch (err) {
    emit('error', err as Error)
  }
}

function handlePreviewVisibleChange(visible: boolean) {
  showPreview.value = visible
  if (!visible) {
    cancelPreview()
  }
}

function handleSettingsSaved() {
  emit('settingsSaved')
}
</script>

<style scoped>
.configured-print {
  display: inline-flex;
}

.print-button {
  min-width: 72px;
  height: 34px;
  padding: 0 14px;
  border: 1px solid #2563eb;
  border-radius: 4px;
  color: #fff;
  background: #2563eb;
  cursor: pointer;
}

.print-button:disabled {
  border-color: #9ca3af;
  background: #9ca3af;
  cursor: not-allowed;
}
</style>
