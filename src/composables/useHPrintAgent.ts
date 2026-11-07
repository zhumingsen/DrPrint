/**
 * useHPrintAgent - Vue 3 Composable
 *
 * 封装 Agent 客户端的响应式状态管理。
 * 业务项目只需一行 `const { print, printers, agentStatus } = useHPrintAgent()` 即可接入打印。
 *
 * @example
 * ```vue
 * <script setup>
 * import { useHPrintAgent } from 'hiprint-v2/client'
 *
 * const { print, printers, agentStatus, error } = useHPrintAgent()
 *
 * async function handlePrint() {
 *   await print({
 *     template: myTemplate,
 *     data: { name: '张三', total: '100.00' },
 *     printerName: 'GP-80160',
 *   })
 * }
 * </script>
 * ```
 */

import { ref, onMounted } from 'vue'
import { createAgentClient } from '../client'
import type { AgentClient, AgentClientOptions } from '../client/agentClient'
import { describeAgentError } from '../client/errors'
import type {
  HPrintTemplate,
  HPrintRenderMode,
  HPrintPrintUsage,
  HPrintPrinter,
  HPrintJobDetail,
  HPrintDiagnostics,
} from '../core/types'

interface UseHPrintPrintParams {
  template: HPrintTemplate
  data?: Record<string, any>
  printerName?: string
  copies?: number
  documentName?: string
  renderMode?: HPrintRenderMode
  usage?: HPrintPrintUsage
}

export interface UseHPrintAgentOptions extends AgentClientOptions {
  /** 是否在挂载时自动加载打印机列表，默认 true */
  autoLoadPrinters?: boolean
  /** 是否在挂载时自动检查 Agent 状态，默认 true */
  autoCheckHealth?: boolean
}

export interface UseHPrintAgentReturn {
  /** Agent 客户端实例 */
  client: AgentClient
  /** Agent 是否在线 */
  agentStatus: ReturnType<typeof ref<'online' | 'offline' | 'checking'>>
  /** 打印机列表 */
  printers: ReturnType<typeof ref<HPrintPrinter[]>>
  /** 当前错误信息 */
  error: ReturnType<typeof ref<string | null>>
  /** 最近一次诊断信息 */
  diagnostics: ReturnType<typeof ref<HPrintDiagnostics | null>>
  /** 加载打印机列表 */
  loadPrinters: () => Promise<void>
  /** 检查 Agent 健康状态 */
  checkHealth: () => Promise<boolean>
  /** 获取诊断信息 */
  loadDiagnostics: () => Promise<void>
  /** 打印（提交任务） */
  print: (params: UseHPrintPrintParams) => Promise<{ jobId: string; status: string }>
  /** 打印并等待完成 */
  printAndWait: (params: UseHPrintPrintParams) => Promise<HPrintJobDetail>
  /** 查询任务状态 */
  getJob: (jobId: string) => Promise<HPrintJobDetail>
  /** RAW 测试 */
  testRaw: (params?: {
    printerName?: string
    text?: string
    cut?: boolean
  }) => Promise<any>
}

export function useHPrintAgent(options: UseHPrintAgentOptions = {}): UseHPrintAgentReturn {
  const {
    autoLoadPrinters = true,
    autoCheckHealth = true,
    ...clientOptions
  } = options

  const client = createAgentClient(clientOptions)
  const agentStatus = ref<'online' | 'offline' | 'checking'>('checking')
  const printers = ref<HPrintPrinter[]>([])
  const error = ref<string | null>(null)
  const diagnostics = ref<HPrintDiagnostics | null>(null)

  async function checkHealth(): Promise<boolean> {
    try {
      agentStatus.value = 'checking'
      await client.health()
      agentStatus.value = 'online'
      error.value = null
      return true
    } catch (err) {
      agentStatus.value = 'offline'
      error.value = describeAgentError(err, client.getAgentUrl())
      return false
    }
  }

  async function loadPrinters() {
    try {
      printers.value = await client.listPrinters()
      error.value = null
    } catch (err) {
      error.value = `获取打印机列表失败: ${(err as Error).message}`
    }
  }

  async function loadDiagnostics() {
    try {
      diagnostics.value = await client.diagnostics()
      error.value = null
    } catch (err) {
      error.value = `获取诊断信息失败: ${(err as Error).message}`
    }
  }

  async function print(params: UseHPrintPrintParams) {
    try {
      error.value = null
      return await client.print(params)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    }
  }

  async function printAndWait(params: UseHPrintPrintParams) {
    try {
      error.value = null
      return await client.printAndWait(params)
    } catch (err) {
      error.value = (err as Error).message
      throw err
    }
  }

  async function getJob(jobId: string) {
    return client.getJobDetail(jobId)
  }

  async function testRaw(params?: { printerName?: string; text?: string; cut?: boolean }) {
    try {
      error.value = null
      return await client.testRaw(params || {})
    } catch (err) {
      error.value = (err as Error).message
      throw err
    }
  }

  // 自动初始化
  onMounted(async () => {
    if (autoCheckHealth) {
      const online = await checkHealth()
      if (online && autoLoadPrinters) {
        await loadPrinters()
      }
    } else if (autoLoadPrinters) {
      await loadPrinters()
    }
  })

  return {
    client,
    agentStatus,
    printers,
    error,
    diagnostics,
    loadPrinters,
    checkHealth,
    loadDiagnostics,
    print,
    printAndWait,
    getJob,
    testRaw,
  }
}
