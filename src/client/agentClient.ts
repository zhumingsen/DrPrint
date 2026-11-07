/**
 * HPrint Agent Client
 *
 * 浏览器 SDK，负责和本地 Agent 通信。
 * 业务项目只需要安装 npm 包，不依赖 Tauri 环境。
 */

import { AgentError } from './errors'
import type {
  HPrintTemplate,
  HPrintPrintJob,
  HPrintRenderMode,
  HPrintJobResult,
  HPrintJobDetail,
  HPrintDiagnostics,
  HPrintPrinter,
  HPrintPrinterSettings,
  HPrintPrintUsage,
  HPrintJobArtifact,
  HPrintHistoryDetail,
  HPrintHistoryListResponse,
} from '../core/types'
import { buildPagedHtml } from '../core/exportArtifacts'
import { renderTemplateToHtml, renderTemplateToPages } from '../core/visualRenderer'

export interface AgentClientOptions {
  agentUrl?: string
  /** HTTP 请求超时（提交任务、查询等），默认 10000ms */
  timeout?: number
  /** 打印任务执行超时（轮询等待），默认 60000ms */
  printTimeout?: number
  /** Agent 认证 token，从 Agent 配置文件获取 */
  token?: string
}

export interface HealthResponse {
  ok: boolean
  name: string
  version: string
  protocolVersion: string
}

export interface PrintJobResponse {
  jobId: string
  status: string
  errorCode?: string
  message?: string
}

export interface TestRawResponse {
  success: boolean
  printer: string
  init: boolean
  feedLines: number
  cut: boolean
  text: string
  bytesWritten: number
}

export interface LogsResponse {
  logs: HPrintJobDetail[]
  count: number
}

export interface JobArtifactsResponse {
  jobId: string
  artifacts: HPrintJobArtifact[]
}

/**
 * 自动发现 Agent URL
 *
 * 优先级：
 * 1. 用户显式指定 agentUrl
 * 2. Tauri IPC 读取端口文件（仅 Tauri 环境）
 * 3. 回退到默认端口 17878
 */
export async function discoverAgentUrl(explicitUrl?: string): Promise<string> {
  if (explicitUrl) return explicitUrl

  // Tauri 2：通过 IPC 获取实际端口
  if (typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window) {
    try {
      const { invoke } = await import('@tauri-apps/api/core')
      const port = await invoke<number>('get_agent_port')
      if (port && typeof port === 'number') {
        return `http://127.0.0.1:${port}`
      }
    } catch {
      // 读取失败，回退到默认端口
    }
  }
  return 'http://127.0.0.1:17878'
}

/**
 * 创建 Agent 客户端
 *
 * 同步创建，默认连接 127.0.0.1:17878。
 * 如果 Agent 端口不是默认值，使用前先调用 discoverAgentUrl()：
 * ```ts
 * const url = await discoverAgentUrl()
 * const client = createAgentClient({ agentUrl: url })
 * ```
 */
function normalizeAgentUrl(agentUrl?: string): string {
  const defaultUrl = 'http://127.0.0.1:17878'
  const trimmed = (agentUrl || defaultUrl).trim()
  return trimmed.replace(/\/+$/, '') || defaultUrl
}

export function createAgentClient(options: AgentClientOptions = {}) {
  const agentUrl = normalizeAgentUrl(options.agentUrl)
  const timeout = options.timeout || 10000
  const printTimeout = options.printTimeout || 60000
  let token = options.token || ''

  async function requestResponse(path: string, init?: RequestInit): Promise<Response> {
    const controller = new AbortController()
    const timer = setTimeout(() => controller.abort(), timeout)

    try {
      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        ...init?.headers as Record<string, string>,
      }
      if (token) {
        headers['Authorization'] = `Bearer ${token}`
      }

      const response = await fetch(`${agentUrl}${path}`, {
        ...init,
        signal: controller.signal,
        headers,
      })

      if (!response.ok) {
        const text = await response.text()
        throw new AgentError('PRINT_JOB_FAILED', `Agent 返回 ${response.status}: ${text}`)
      }

      return response
    } catch (err) {
      if (err instanceof AgentError) throw err

      if (err instanceof DOMException && err.name === 'AbortError') {
        throw new AgentError('REQUEST_TIMEOUT', `Agent 请求超时: ${agentUrl}`)
      }

      if (err instanceof TypeError && err.message.includes('fetch')) {
        throw new AgentError('AGENT_NOT_FOUND', `无法连接到 Agent: ${agentUrl}，请确认 Agent 已启动`)
      }

      throw new AgentError('NETWORK_ERROR', `网络错误: ${(err as Error).message}`)
    } finally {
      clearTimeout(timer)
    }
  }

  async function request<T>(path: string, init?: RequestInit): Promise<T> {
    const response = await requestResponse(path, init)
    return await response.json()
  }

  return {
    /**
     * 健康检查
     */
    async health(): Promise<HealthResponse> {
      return request<HealthResponse>('/health')
    },

    /**
     * 获取打印机列表（含完整 capabilities）
     */
    async listPrinters(): Promise<HPrintPrinter[]> {
      return request<HPrintPrinter[]>('/printers')
    },

    async getPrinterSettings(): Promise<HPrintPrinterSettings> {
      return request<HPrintPrinterSettings>('/printer-settings')
    },

    async savePrinterSettings(settings: HPrintPrinterSettings): Promise<HPrintPrinterSettings> {
      return request<HPrintPrinterSettings>('/printer-settings', {
        method: 'PUT',
        body: JSON.stringify(settings),
      })
    },

    /**
     * 提交打印任务
     */
    async print(params: {
      template: HPrintTemplate
      data?: Record<string, any>
      printerName?: string
      copies?: number
      documentName?: string
      renderMode?: HPrintRenderMode
      usage?: HPrintPrintUsage
    }): Promise<PrintJobResponse> {
      const data = params.data || {}
      const template = normalizePrintTemplate(params.template, params.usage)
      const rawPagination = template.printOptions?.rawPagination || 'continuous'
      const pagedRenderResult = rawPagination === 'paged'
        ? renderTemplateToPages(template, data)
        : null
      const usePagedHtml = params.renderMode === 'webview' || params.usage === 'document'
      const renderedHtml = usePagedHtml
        ? buildPagedHtml(pagedRenderResult || renderTemplateToPages(template, data))
        : pagedRenderResult?.pages[0]?.html
          || renderTemplateToHtml(template, data).html
      const renderedPages = pagedRenderResult?.pages.map((page) => page.html)
      const job: HPrintPrintJob = {
        template,
        data,
        renderedHtml,
        renderedPages,
        printerName: params.printerName,
        copies: params.copies,
        documentName: params.documentName,
        renderMode: params.renderMode,
        usage: params.usage,
      }

      const result = await request<PrintJobResponse>('/print-jobs', {
        method: 'POST',
        body: JSON.stringify(job),
      })
      if (result.status === 'failed') {
        throw new AgentError(
          (result.errorCode || 'PRINT_JOB_FAILED') as any,
          result.message || '打印任务创建失败',
          result
        )
      }
      return result
    },

    /**
     * 提交打印任务并等待完成
     *
     * 区分两种超时：
     * - 提交超时（timeout）：HTTP 请求本身的超时
     * - 执行超时（printTimeout）：等待打印完成的轮询超时
     */
    async printAndWait(params: {
      template: HPrintTemplate
      data?: Record<string, any>
      printerName?: string
      copies?: number
      documentName?: string
      renderMode?: HPrintRenderMode
      usage?: HPrintPrintUsage
    }): Promise<HPrintJobDetail> {
      // 1. 提交任务（使用 HTTP 超时）
      const result = await this.print(params)

      // 2. 轮询等待完成（使用打印执行超时）
      const startTime = Date.now()
      const pollInterval = 500

      while (Date.now() - startTime < printTimeout) {
        const job = await this.getJobDetail(result.jobId)

        if (job.status === 'printed') {
          return job
        }
        if (job.status === 'failed') {
          throw new AgentError(
            'PRINT_JOB_FAILED',
            job.message || `打印失败: ${job.errorCode || '未知错误'}`,
            job
          )
        }

        await new Promise((resolve) => setTimeout(resolve, pollInterval))
      }

      throw new AgentError(
        'PRINT_JOB_TIMEOUT',
        `打印超时: 任务 ${result.jobId} 在 ${printTimeout}ms 内未完成`
      )
    },

    /**
     * 查询任务状态（简要）
     */
    async getJob(jobId: string): Promise<HPrintJobResult> {
      return request<HPrintJobResult>(`/print-jobs/${jobId}`)
    },

    /**
     * 查询任务详情（含诊断信息：renderMode, bytesWritten, errorCode）
     */
    async getJobDetail(jobId: string): Promise<HPrintJobDetail> {
      return request<HPrintJobDetail>(`/print-jobs/${jobId}`)
    },

    async getJobArtifacts(jobId: string): Promise<JobArtifactsResponse> {
      return request<JobArtifactsResponse>(`/print-jobs/${jobId}/artifacts`)
    },

    async downloadJobArtifact(jobId: string, artifactName: string): Promise<Blob> {
      const response = await requestResponse(
        `/print-jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactName)}`
      )
      return await response.blob()
    },

    getJobArtifactUrl(jobId: string, artifactName: string): string {
      return `${agentUrl}/print-jobs/${encodeURIComponent(jobId)}/artifacts/${encodeURIComponent(artifactName)}`
    },

    /**
     * 打印历史：摘要列表（最新在前，不含模板/数据快照）
     */
    async getPrintHistory(limit?: number): Promise<HPrintHistoryListResponse> {
      const query = typeof limit === 'number' && limit > 0 ? `?limit=${Math.floor(limit)}` : ''
      return request<HPrintHistoryListResponse>(`/print-history${query}`)
    },

    /**
     * 打印历史：详情（含模板/数据快照，可用于重打）
     */
    async getPrintHistoryItem(id: string): Promise<HPrintHistoryDetail> {
      return request<HPrintHistoryDetail>(`/print-history/${encodeURIComponent(id)}`)
    },

    async deletePrintHistoryItem(id: string): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>(`/print-history/${encodeURIComponent(id)}`, {
        method: 'DELETE',
      })
    },

    async clearPrintHistory(): Promise<{ ok: boolean }> {
      return request<{ ok: boolean }>('/print-history', { method: 'DELETE' })
    },

    /**
     * RAW 测试：直接发送 ESC/POS 测试页到打印机
     */
    async testRaw(params: {
      printerName?: string
      init?: boolean
      feed?: number
      cut?: boolean
      text?: string
    }): Promise<TestRawResponse> {
      return request<TestRawResponse>('/test-raw', {
        method: 'POST',
        body: JSON.stringify(params),
      })
    },

    /**
     * 获取 Agent 诊断信息
     */
    async diagnostics(): Promise<HPrintDiagnostics> {
      return request<HPrintDiagnostics>('/diagnostics')
    },

    /**
     * 获取最近任务日志
     */
    async logs(limit?: number): Promise<LogsResponse> {
      const query = limit ? `?limit=${limit}` : ''
      return request<LogsResponse>(`/logs${query}`)
    },

    /**
     * 打印前检查：Agent 是否在线、打印机是否存在
     */
    async preflightCheck(printerName?: string): Promise<{
      agentOnline: boolean
      printerExists: boolean
      printerName?: string
      defaultPrinter?: string
      error?: string
    }> {
      try {
        await this.health()
      } catch {
        return {
          agentOnline: false,
          printerExists: false,
          error: 'Agent 未运行，请启动本地打印 Agent',
        }
      }

      if (!printerName) {
        return { agentOnline: true, printerExists: false }
      }

      try {
        const printers = await this.listPrinters()
        const found = printers.some(
          (p) => p.name === printerName || p.name.includes(printerName)
        )
        return {
          agentOnline: true,
          printerExists: found,
          printerName,
          defaultPrinter: printers.find((p) => p.isDefault)?.name,
        }
      } catch {
        return {
          agentOnline: true,
          printerExists: false,
          error: '无法获取打印机列表',
        }
      }
    },

    /**
     * 获取 Agent URL
     */
    getAgentUrl(): string {
      return agentUrl
    },

    /**
     * 设置认证 token
     */
    setToken(newToken: string) {
      token = newToken
    },

    /**
     * 获取当前 token
     */
    getToken(): string {
      return token
    },

    /**
     * 获取 Agent 认证配置
     */
    async getAuthConfig(): Promise<{ authEnabled: boolean; allowedOrigins: string[] }> {
      return request('/auth/config')
    },
  }
}

export type AgentClient = ReturnType<typeof createAgentClient>

function normalizePrintTemplate(template: HPrintTemplate, usage?: HPrintPrintUsage): HPrintTemplate {
  if (usage !== 'receipt') return template
  const paperHeight = template.paper?.height || 0
  const contentHeight = receiptContentHeight(template)
  const nextHeight = Math.max(paperHeight, contentHeight)
  const cut = template.printOptions?.cut || 'full'
  const shouldDefaultCutterFeed = template.printOptions?.cutterFeedMm === undefined
    && template.printOptions?.feedLines === undefined

  return {
    ...template,
    paper: {
      ...template.paper,
      height: nextHeight,
    },
    printOptions: {
      ...template.printOptions,
      cut,
      ...(shouldDefaultCutterFeed ? { cutterFeedMm: defaultReceiptCutterFeedMm(cut) } : {}),
      receiptAutoHeight: true,
    },
  }
}

function defaultReceiptCutterFeedMm(cut?: 'none' | 'partial' | 'full'): number {
  return cut === 'none' ? 0 : 18
}

function receiptContentHeight(template: HPrintTemplate): number {
  const bottomMargin = 6
  const maxBottom = (template.components || []).reduce((height, component) => {
    const y = typeof component.y === 'number' && Number.isFinite(component.y) ? component.y : 0
    const componentHeight = typeof component.height === 'number' && Number.isFinite(component.height)
      ? component.height
      : 0
    return Math.max(height, y + componentHeight)
  }, 0)

  return Math.ceil(maxBottom + bottomMargin)
}
