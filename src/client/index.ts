/** HPrint SDK client exports used by the desktop demo and business projects. */
export { createAgentClient, discoverAgentUrl } from './agentClient'
export type {
  AgentClient,
  AgentClientOptions,
  HealthResponse,
  PrintJobResponse,
  TestRawResponse,
  LogsResponse,
  JobArtifactsResponse,
} from './agentClient'
export { AgentError, describeAgentError } from './errors'
export type { AgentErrorCode } from './errors'
export { useHPrintAgent } from '../composables/useHPrintAgent'
export type { UseHPrintAgentOptions, UseHPrintAgentReturn } from '../composables/useHPrintAgent'
export { useHPrintConfiguredPrint } from '../composables/useHPrintConfiguredPrint'
export type {
  HPrintConfiguredPrintParams,
  UseHPrintConfiguredPrintOptions,
} from '../composables/useHPrintConfiguredPrint'
export { useHPrintTemplatePrint } from '../composables/useHPrintTemplatePrint'
export type {
  HPrintTemplatePrintContext,
  HPrintTemplatePrintParams,
  HPrintTemplatePrinterConfig,
  UseHPrintTemplatePrintOptions,
} from '../composables/useHPrintTemplatePrint'
