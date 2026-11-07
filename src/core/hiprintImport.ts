import { SCHEMA_VERSION, type HPrintComponent, type HPrintComponentType, type HPrintTemplate } from './types'

export type HiprintImportIssueLevel = 'info' | 'warning' | 'error'

export interface HiprintImportIssue {
  level: HiprintImportIssueLevel
  path: string
  message: string
  source?: unknown
}

export interface HiprintImportResult {
  template: HPrintTemplate
  issues: HiprintImportIssue[]
  sourcePanelCount: number
  convertedComponentCount: number
  skippedComponentCount: number
}

export interface HiprintImportOptions {
  name?: string
  coordinateUnit?: 'auto' | 'mm' | 'px'
}

const PX_PER_MM = 3.7795

const PAPER_PRESETS: Record<string, { width: number; height: number }> = {
  a4: { width: 210, height: 297 },
  a5: { width: 148, height: 210 },
  b5: { width: 176, height: 250 },
}

export function isHiprintTemplate(value: unknown): boolean {
  return !!value
    && typeof value === 'object'
    && Array.isArray((value as any).panels)
}

export function importHiprintTemplate(source: unknown, options: HiprintImportOptions = {}): HiprintImportResult {
  const issues: HiprintImportIssue[] = []

  if (!isHiprintTemplate(source)) {
    throw new Error('不是有效的 hiprint 模板：缺少 panels 数组')
  }

  const panels = (source as any).panels as any[]
  const firstPanel = panels[0] || {}

  const paper = resolvePaper(firstPanel, issues, 'panels[0]')
  const components: HPrintComponent[] = []
  let skippedComponentCount = 0

  panels.forEach((panel, panelIndex) => {
    const path = `panels[${panelIndex}]`
    const panelPaper = resolvePaper(panel, issues, path)
    if (panelIndex > 0 && !samePaper(paper, panelPaper)) {
      issues.push({
        level: 'warning',
        path,
        message: `panel 纸张尺寸 ${panelPaper.width}×${panelPaper.height}mm 与首页 ${paper.width}×${paper.height}mm 不一致，已按首页纸张分页导入。`,
      })
    }
    const unit = resolveCoordinateUnit(panel, panelPaper, options.coordinateUnit || 'auto')
    if (unit === 'px') {
      issues.push({
        level: 'info',
        path,
        message: '检测到 hiprint 坐标更接近 px，已按 96dpi 转换为 mm。',
      })
    }

    const printElements = Array.isArray(panel.printElements) ? panel.printElements : []
    printElements.forEach((element: any, index: number) => {
      const elementPath = `${path}.printElements[${index}]`
      const converted = convertElement(element, elementPath, unit, issues, panelIndex * paper.height)
      if (converted) {
        components.push(converted)
      } else {
        skippedComponentCount += 1
      }
    })
  })

  checkBoundaries(components, paper, issues)

  return {
    template: {
      schemaVersion: SCHEMA_VERSION,
      name: options.name || (source as any).title || (source as any).name || 'hiprint 导入模板',
      paper,
      components,
      fields: inferFields(components),
    },
    issues,
  sourcePanelCount: panels.length,
    convertedComponentCount: components.length,
    skippedComponentCount,
  }
}

function resolvePaper(panel: any, issues: HiprintImportIssue[], path = 'panels[0]') {
  const paperType = String(panel.paperType || panel.paperSize || '').toLowerCase()
  const preset = PAPER_PRESETS[paperType]
  if (preset) return { ...preset, unit: 'mm' }

  const width = numberValue(panel.width ?? panel.paperWidth, 0)
  const height = numberValue(panel.height ?? panel.paperHeight ?? panel.paperFooter, 0)
  if (width > 0 && height > 0) {
    const normalized = width > 400 || height > 400
      ? { width: pxToMm(width), height: pxToMm(height) }
      : { width, height }
    return { ...normalized, unit: 'mm' }
  }

  const footer = numberValue(panel.paperFooter, 0)
  if (footer > 0) {
    return { width: 210, height: footer > 400 ? pxToMm(footer) : footer, unit: 'mm' }
  }

    issues.push({
    level: 'warning',
    path,
    message: '未识别到纸张尺寸，已按 A4 纵向导入。',
  })
  return { width: 210, height: 297, unit: 'mm' }
}

function resolveCoordinateUnit(
  panel: any,
  paper: { width: number; height: number },
  preferred: 'auto' | 'mm' | 'px',
): 'mm' | 'px' {
  if (preferred !== 'auto') return preferred

  const elements = Array.isArray(panel.printElements) ? panel.printElements : []
  const maxRight = Math.max(0, ...elements.map((element: any) => {
    const options = element?.options || {}
    return numberValue(options.left, 0) + numberValue(options.width, 0)
  }))
  const maxBottom = Math.max(0, ...elements.map((element: any) => {
    const options = element?.options || {}
    return numberValue(options.top, 0) + numberValue(options.height, 0)
  }))

  return maxRight > paper.width * 1.5 || maxBottom > paper.height * 1.5 ? 'px' : 'mm'
}

function convertElement(
  element: any,
  path: string,
  unit: 'mm' | 'px',
  issues: HiprintImportIssue[],
  yOffsetMm = 0,
): HPrintComponent | null {
  const options = element?.options || {}
  const sourceType = String(element?.printElementType?.type || element?.type || options.type || '').toLowerCase()
  const type = mapElementType(sourceType, options)

  if (!type) {
    issues.push({
      level: 'warning',
      path,
      message: `暂不支持的 hiprint 组件类型：${sourceType || 'unknown'}，已跳过并保留在报告中。`,
      source: element,
    })
    return null
  }

  const component: HPrintComponent = {
    id: String(options.id || element.id || `hiprint-${Math.random().toString(36).slice(2, 9)}`),
    type,
    x: lengthValue(options.left, 0, unit),
    y: yOffsetMm + lengthValue(options.top, 0, unit),
    width: Math.max(1, lengthValue(options.width, defaultWidth(type), unit)),
    height: Math.max(1, lengthValue(options.height, defaultHeight(type), unit)),
    rotate: numberOrUndefined(options.rotate),
    zIndex: numberOrUndefined(options.zIndex),
    options: mapElementOptions(type, options, issues, path),
  }

  return component
}

function samePaper(
  a: { width: number; height: number },
  b: { width: number; height: number },
): boolean {
  return Math.abs(a.width - b.width) < 0.1 && Math.abs(a.height - b.height) < 0.1
}

function mapElementType(sourceType: string, options: Record<string, unknown>): HPrintComponentType | null {
  if (sourceType.includes('qrcode') || sourceType.includes('qr_code')) return 'qrcode'
  if (sourceType.includes('barcode')) return 'barcode'
  if (sourceType.includes('image')) return 'image'
  if (sourceType.includes('table')) return 'table'
  if (sourceType.includes('hline') || sourceType.includes('vline') || sourceType === 'line') return 'line'
  if (sourceType.includes('rect')) return 'rect'
  if (sourceType.includes('ellipse') || sourceType.includes('circle')) return 'ellipse'
  if (sourceType.includes('text') || options.field || options.title || options.text) return 'text'
  return null
}

function mapElementOptions(
  type: HPrintComponentType,
  options: Record<string, any>,
  issues: HiprintImportIssue[],
  path: string,
): Record<string, any> {
  const commonText = {
    fontSize: numberValue(options.fontSize, 12),
    color: String(options.color || '#000000'),
    fontFamily: String(options.fontFamily || 'Arial'),
    fontWeight: options.fontWeight === 'bold' || options.fontWeight === 700 ? 'bold' : 'normal',
    textAlign: normalizeTextAlign(options.textAlign),
    lineHeight: numberValue(options.lineHeight, Math.round(numberValue(options.fontSize, 12) * 1.2)),
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    maxLines: 0,
  }

  if (type === 'text') {
    return {
      ...commonText,
      content: resolveContent(options),
    }
  }

  if (type === 'image') {
    const src = options.src || options.url
    return {
      src: src ? String(src) : bindField(String(options.field || '')),
      objectFit: String(options.objectFit || 'contain'),
      objectPosition: String(options.objectPosition || 'center center'),
    }
  }

  if (type === 'qrcode') {
    return {
      content: resolveContent(options),
      level: String(options.level || 'M'),
      margin: numberValue(options.margin, 1),
      darkColor: String(options.color || options.darkColor || '#000000'),
      lightColor: String(options.background || options.lightColor || '#ffffff'),
    }
  }

  if (type === 'barcode') {
    return {
      content: resolveContent(options),
      format: String(options.format || options.barcodeType || 'CODE128').toUpperCase(),
      displayValue: options.showText ?? options.displayValue ?? true,
      lineColor: String(options.color || options.lineColor || '#000000'),
      background: String(options.background || '#ffffff'),
      fontSize: numberValue(options.fontSize, 12),
      barWidth: numberValue(options.barWidth, 1.5),
      barHeight: numberValue(options.barHeight || options.height, 40),
      textPosition: 'bottom',
      textAlign: normalizeTextAlign(options.textAlign),
      textMargin: numberValue(options.textMargin, 2),
      margin: numberValue(options.margin, 0),
    }
  }

  if (type === 'line') {
    return {
      color: String(options.borderColor || options.color || '#000000'),
      lineWidth: numberValue(options.borderWidth || options.lineWidth, 1),
      lineStyle: String(options.borderStyle || options.lineStyle || 'solid'),
      direction: numberValue(options.height, 0) > numberValue(options.width, 0) ? 'vertical' : 'horizontal',
    }
  }

  if (type === 'rect' || type === 'ellipse') {
    return {
      backgroundColor: String(options.background || options.backgroundColor || 'transparent'),
      borderColor: String(options.borderColor || options.color || '#000000'),
      borderWidth: numberValue(options.borderWidth, 1),
      borderStyle: String(options.borderStyle || 'solid'),
      borderRadius: numberValue(options.borderRadius, 0),
    }
  }

  if (type === 'table') {
    const columns = Array.isArray(options.columns) ? options.columns : []
    if (!columns.length) {
      issues.push({
        level: 'warning',
        path,
        message: '表格未识别到 columns，已生成默认三列表格，请手动调整字段。',
      })
    }
    return {
      dataSourceField: String(options.field || options.dataSource || 'items'),
      columns: columns.length ? columns.map((column: any) => ({
        field: String(column.field || column.name || ''),
        title: String(column.title || column.text || column.field || ''),
        width: numberValue(column.width, 80),
        align: normalizeTextAlign(column.align || column.textAlign),
      })) : [
        { field: 'name', title: '名称', width: 90, align: 'left' },
        { field: 'qty', title: '数量', width: 50, align: 'center' },
        { field: 'amount', title: '金额', width: 70, align: 'right' },
      ],
      headerHeight: numberValue(options.headerHeight, 30),
      rowHeight: numberValue(options.rowHeight, 25),
      showHeader: options.showHeader !== false,
      borderWidth: numberValue(options.borderWidth, 1),
      borderColor: String(options.borderColor || '#000000'),
      borderStyle: String(options.borderStyle || 'solid'),
      headerBackgroundColor: String(options.headerBackground || '#f5f5f5'),
      headerColor: String(options.headerColor || '#000000'),
      rowBackgroundColor: String(options.rowBackground || '#ffffff'),
      alternatingRowBackgroundColor: String(options.alternatingRowBackground || '#fafafa'),
      fontSize: numberValue(options.fontSize, 12),
      fontFamily: String(options.fontFamily || 'Arial'),
      textAlign: normalizeTextAlign(options.textAlign),
      maxRows: 0,
      emptyText: '暂无数据',
      showSummary: false,
      summaryLabel: '合计',
      summaryField: '',
      summaryText: '',
    }
  }

  return {}
}

function inferFields(components: HPrintComponent[]) {
  const keys = new Set<string>()
  components.forEach((component) => {
    const content = component.options?.content || component.options?.src || component.options?.dataSourceField
    String(content || '').replace(/\{\{([^}]+)\}\}/g, (_, key) => {
      keys.add(String(key).trim())
      return ''
    })
  })
  return [...keys].map((key) => ({ key, label: key, type: 'string' as const, sampleValue: key }))
}

function resolveContent(options: Record<string, any>): string {
  if (options.field) return bindField(String(options.field))
  if (options.text) return String(options.text)
  if (options.title) return String(options.title)
  if (options.content) return String(options.content)
  return ''
}

function bindField(field: string): string {
  if (!field) return ''
  if (field.startsWith('{{') && field.endsWith('}}')) return field
  return `{{${field}}}`
}

function normalizeTextAlign(value: unknown): 'left' | 'center' | 'right' {
  return value === 'center' || value === 'right' ? value : 'left'
}

function lengthValue(value: unknown, fallback: number, unit: 'mm' | 'px'): number {
  const number = numberValue(value, fallback)
  return unit === 'px' ? pxToMm(number) : number
}

function numberValue(value: unknown, fallback: number): number {
  if (typeof value === 'number' && Number.isFinite(value)) return value
  if (typeof value === 'string' && value.trim() !== '') {
    const parsed = Number(value)
    if (Number.isFinite(parsed)) return parsed
  }
  return fallback
}

function numberOrUndefined(value: unknown): number | undefined {
  const parsed = numberValue(value, Number.NaN)
  return Number.isFinite(parsed) ? parsed : undefined
}

function pxToMm(value: number): number {
  return Number((value / PX_PER_MM).toFixed(2))
}

function defaultWidth(type: HPrintComponentType): number {
  if (type === 'qrcode') return 30
  if (type === 'barcode') return 50
  if (type === 'image') return 40
  if (type === 'line') return 80
  return 50
}

function defaultHeight(type: HPrintComponentType): number {
  if (type === 'qrcode') return 30
  if (type === 'barcode') return 18
  if (type === 'image') return 30
  if (type === 'line') return 2
  return 12
}

function checkBoundaries(
  components: HPrintComponent[],
  paper: { width: number; height: number },
  issues: HiprintImportIssue[],
) {
  const outOfBounds: string[] = []
  for (const comp of components) {
    const right = comp.x + comp.width
    const bottom = comp.y + comp.height
    if (comp.x < 0 || comp.y < 0 || right > paper.width || bottom > paper.height) {
      outOfBounds.push(comp.id)
      issues.push({
        level: 'warning',
        path: `component:${comp.id}`,
        message: `组件 ${comp.id} (${comp.type}) 超出纸张边界: x=${comp.x} y=${comp.y} w=${comp.width} h=${comp.height}，纸张 ${paper.width}×${paper.height}mm`,
      })
    }
  }
}

export function fitComponentsToPaper(
  components: HPrintComponent[],
  paperWidth: number,
  paperHeight: number,
): HPrintComponent[] {
  return components.map(comp => {
    let { x, y, width, height } = comp
    if (width > paperWidth) width = paperWidth
    if (height > paperHeight) height = paperHeight
    if (x < 0) x = 0
    if (y < 0) y = 0
    if (x + width > paperWidth) x = Math.max(0, paperWidth - width)
    if (y + height > paperHeight) y = Math.max(0, paperHeight - height)
    if (x === comp.x && y === comp.y && width === comp.width && height === comp.height) return comp
    return { ...comp, x, y, width, height }
  })
}
