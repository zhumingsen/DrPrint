import { ref } from 'vue'
import { createAgentClient } from '../client/agentClient'
import type { AgentClient, AgentClientOptions, PrintJobResponse } from '../client/agentClient'
import { inferPrintUsage, printUsageLabel } from '../core/printUsage'
import type {
  HPrintJobDetail,
  HPrintPrintUsage,
  HPrintRenderMode,
  HPrintTemplate,
} from '../core/types'

export interface HPrintConfiguredPrintParams {
  template: HPrintTemplate
  data?: Record<string, unknown>
  usage?: HPrintPrintUsage
  printerName?: string
  copies?: number
  documentName?: string
  renderMode?: HPrintRenderMode
  rawProtocol?: 'escpos' | 'tspl' | 'cpcl' | 'none'
}

export interface UseHPrintConfiguredPrintOptions extends AgentClientOptions {
  waitForComplete?: boolean
  client?: AgentClient
  getClient?: () => AgentClient
}

export function useHPrintConfiguredPrint(options: UseHPrintConfiguredPrintOptions = {}) {
  const { waitForComplete = false, client: providedClient, getClient, ...clientOptions } = options
  const client = providedClient || createAgentClient(clientOptions)
  const loading = ref(false)
  const error = ref<string | null>(null)
  const showPreview = ref(false)
  const showPrinterSettings = ref(false)
  const pendingPrint = ref<HPrintConfiguredPrintParams | null>(null)

  async function submit(params: HPrintConfiguredPrintParams) {
    const activeClient = getClient?.() || client
    if (waitForComplete) {
      return await activeClient.printAndWait(params)
    }
    return await activeClient.print(params)
  }

  async function printWithConfig(params: HPrintConfiguredPrintParams): Promise<PrintJobResponse | HPrintJobDetail | null> {
    loading.value = true
    error.value = null
    try {
      const usage = params.usage ?? inferPrintUsage(params.template)
      const settings = await (getClient?.() || client).getPrinterSettings()
      const usageConfig = settings.printerSettings?.[usage]

      if (!params.printerName && !usageConfig?.printerName) {
        showPrinterSettings.value = true
        throw new Error(`请先在打印机设置中配置“${printUsageLabel(usage)}”打印机`)
      }

      const normalizedParams = {
        ...params,
        usage,
        printerName: params.printerName || usageConfig?.printerName || undefined,
        renderMode: params.renderMode || usageConfig?.renderMode || undefined,
        rawProtocol: params.renderMode
          ? undefined
          : usageConfig?.rawProtocol || undefined,
      }

      if (settings.previewBeforePrint === true) {
        pendingPrint.value = {
          ...normalizedParams,
          rawProtocol: usageConfig?.rawProtocol,
        }
        showPreview.value = true
        return null
      }

      return await submit({
        ...normalizedParams,
        rawProtocol: usageConfig?.rawProtocol,
      })
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      loading.value = false
    }
  }

  async function confirmPreviewPrint(): Promise<PrintJobResponse | HPrintJobDetail | null> {
    if (!pendingPrint.value) return null
    loading.value = true
    error.value = null
    try {
      const result = await submit(pendingPrint.value)
      showPreview.value = false
      pendingPrint.value = null
      return result
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      loading.value = false
    }
  }

  function cancelPreview() {
    showPreview.value = false
    pendingPrint.value = null
  }

  return {
    client,
    loading,
    error,
    showPreview,
    showPrinterSettings,
    pendingPrint,
    printWithConfig,
    confirmPreviewPrint,
    cancelPreview,
  }
}
