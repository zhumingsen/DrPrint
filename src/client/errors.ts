/**
 * Agent Client 错误码
 */

export type AgentErrorCode =
  | 'AGENT_NOT_FOUND'
  | 'AGENT_VERSION_UNSUPPORTED'
  | 'PRINTER_NOT_FOUND'
  | 'PRINTER_USAGE_NOT_CONFIGURED'
  | 'PRINT_JOB_FAILED'
  | 'TEMPLATE_INVALID'
  | 'UNSUPPORTED_FEATURE'
  | 'NETWORK_ERROR'
  | 'REQUEST_TIMEOUT'
  | 'PRINT_JOB_TIMEOUT'
  | 'RENDER_EMPTY'
  | 'WRITE_FAILED'
  | 'WRITE_INCOMPLETE'

export class AgentError extends Error {
  code: AgentErrorCode
  details?: any

  constructor(code: AgentErrorCode, message: string, details?: any) {
    super(message)
    this.name = 'AgentError'
    this.code = code
    this.details = details
  }
}

export function describeAgentError(error: unknown, agentUrl = 'http://127.0.0.1:17878'): string {
  if (error instanceof AgentError) {
    if (error.code === 'AGENT_NOT_FOUND') {
      return `无法连接到 HPrint Agent（${agentUrl}），请确认 Agent 已安装并正在运行`
    }
    if (error.code === 'REQUEST_TIMEOUT') {
      return `HPrint Agent 请求超时（${agentUrl}），请检查 Agent 是否卡住或被防火墙拦截`
    }
    return error.message
  }

  return (error as Error)?.message || `无法连接到 HPrint Agent（${agentUrl}）`
}
