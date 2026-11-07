import { computed, ref } from 'vue'
import { useHPrintConfiguredPrint } from './useHPrintConfiguredPrint'
import type {
  HPrintConfiguredPrintParams,
  UseHPrintConfiguredPrintOptions,
} from './useHPrintConfiguredPrint'
import { inferPrintUsage } from '../core/printUsage'
import type {
  HPrintJobDetail,
  HPrintPrintUsage,
  HPrintRenderMode,
  HPrintTemplate,
} from '../core/types'
import type { PrintJobResponse } from '../client/agentClient'

export interface HPrintTemplatePrintContext<TDataParams = unknown> {
  templateId: string
  template: HPrintTemplate
  data: Record<string, unknown>
  dataParams?: TDataParams
  usage: HPrintPrintUsage
}

export interface HPrintTemplatePrintParams<TDataParams = unknown> {
  templateId: string
  dataParams?: TDataParams
  data?: Record<string, unknown>
  usage?: HPrintPrintUsage
  printerName?: string
  copies?: number
  documentName?: string
  renderMode?: HPrintRenderMode
}

export type HPrintTemplatePrinterConfig<TDataParams = unknown> =
  Partial<Omit<HPrintConfiguredPrintParams, 'template' | 'data' | 'usage'>>
  | ((context: HPrintTemplatePrintContext<TDataParams>) =>
    Partial<Omit<HPrintConfiguredPrintParams, 'template' | 'data' | 'usage'>>
    | Promise<Partial<Omit<HPrintConfiguredPrintParams, 'template' | 'data' | 'usage'>>>)

export interface UseHPrintTemplatePrintOptions<TDataParams = unknown>
  extends UseHPrintConfiguredPrintOptions {
  usage?: HPrintPrintUsage
  getTemplate: (templateId: string) => HPrintTemplate | Promise<HPrintTemplate>
  getData?: (
    dataParams: TDataParams | undefined,
    template: HPrintTemplate,
  ) => Record<string, unknown> | Promise<Record<string, unknown>>
  getPrinterConfig?: HPrintTemplatePrinterConfig<TDataParams>
}

export function useHPrintTemplatePrint<TDataParams = unknown>(
  options: UseHPrintTemplatePrintOptions<TDataParams>,
) {
  const {
    usage: defaultUsage,
    getTemplate,
    getData,
    getPrinterConfig,
    ...configuredOptions
  } = options
  const configuredPrint = useHPrintConfiguredPrint(configuredOptions)
  const resolving = ref(false)
  const error = ref<string | null>(null)
  const loading = computed(() => resolving.value || configuredPrint.loading.value)

  async function resolvePrintParams(
    params: HPrintTemplatePrintParams<TDataParams>,
  ): Promise<HPrintConfiguredPrintParams> {
    const template = await getTemplate(params.templateId)
    const data = params.data ?? await getData?.(params.dataParams, template) ?? {}
    const usage = params.usage ?? defaultUsage ?? inferPrintUsage(template)
    const context: HPrintTemplatePrintContext<TDataParams> = {
      templateId: params.templateId,
      template,
      data,
      dataParams: params.dataParams,
      usage,
    }
    const printerConfig = typeof getPrinterConfig === 'function'
      ? await getPrinterConfig(context)
      : getPrinterConfig

    const requestConfig: Partial<HPrintConfiguredPrintParams> = {}
    if (params.printerName !== undefined) requestConfig.printerName = params.printerName
    if (params.copies !== undefined) requestConfig.copies = params.copies
    if (params.documentName !== undefined) requestConfig.documentName = params.documentName
    if (params.renderMode !== undefined) requestConfig.renderMode = params.renderMode

    return {
      ...printerConfig,
      ...requestConfig,
      template,
      data,
      usage,
    }
  }

  async function print(
    params: HPrintTemplatePrintParams<TDataParams>,
  ): Promise<PrintJobResponse | HPrintJobDetail | null> {
    resolving.value = true
    error.value = null
    configuredPrint.error.value = null
    try {
      const printParams = await resolvePrintParams(params)
      return await configuredPrint.printWithConfig(printParams)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      resolving.value = false
    }
  }

  async function preview(params: HPrintTemplatePrintParams<TDataParams>) {
    resolving.value = true
    error.value = null
    configuredPrint.error.value = null
    try {
      const printParams = await resolvePrintParams(params)
      configuredPrint.pendingPrint.value = printParams
      configuredPrint.showPreview.value = true
      return printParams
    } catch (err) {
      error.value = (err as Error).message
      throw err
    } finally {
      resolving.value = false
    }
  }

  async function confirmPreviewPrint(): Promise<PrintJobResponse | HPrintJobDetail | null> {
    try {
      return await configuredPrint.confirmPreviewPrint()
    } catch (err) {
      error.value = (err as Error).message
      throw err
    }
  }

  return {
    client: configuredPrint.client,
    loading,
    resolving,
    error,
    printError: configuredPrint.error,
    showPreview: configuredPrint.showPreview,
    showPrinterSettings: configuredPrint.showPrinterSettings,
    pendingPrint: configuredPrint.pendingPrint,
    print,
    preview,
    confirmPreviewPrint,
    cancelPreview: configuredPrint.cancelPreview,
  }
}
