import type { HPrintPrintUsage, HPrintTemplate } from './types'

export function inferPrintUsage(template: HPrintTemplate): HPrintPrintUsage {
  const width = template.paper?.width || 210
  const height = template.paper?.height || 297

  if (width <= 90 && height <= 120) return 'label'
  if (width <= 90) return 'receipt'
  return 'document'
}

export function printUsageLabel(usage: HPrintPrintUsage): string {
  const labels: Record<HPrintPrintUsage, string> = {
    label: '标签',
    receipt: '小票',
    document: '文档',
  }
  return labels[usage]
}
