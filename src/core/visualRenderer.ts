import { bindTemplate, getNestedValue } from './binding'
import {
  bindCodeContent,
  escapeAttr,
  escapeHtml,
  renderBarcodeSvg,
  renderQrSvg,
} from './barcodeAssets'
import type { HPrintComponent, HPrintTemplate } from './types'

export interface VisualRenderResult {
  html: string
  widthPx: number
  heightPx: number
  widthMm: number
  heightMm: number
  orientation: 'portrait' | 'landscape'
}

export interface VisualRenderPage extends VisualRenderResult {
  pageIndex: number
  pageNumber: number
  totalPages: number
  diagnostics: VisualRenderDiagnostic[]
}

export interface VisualRenderPagesResult {
  pages: VisualRenderPage[]
  widthPx: number
  heightPx: number
  widthMm: number
  heightMm: number
  orientation: 'portrait' | 'landscape'
  totalPages: number
  diagnostics: VisualRenderDiagnostic[]
}

export type VisualRenderDiagnosticLevel = 'info' | 'warning' | 'error'

export type VisualRenderDiagnosticCode =
  | 'component-overflow-x'
  | 'component-overflow-y'
  | 'component-cross-page'
  | 'component-split'
  | 'table-paginated'

export interface VisualRenderDiagnostic {
  level: VisualRenderDiagnosticLevel
  code: VisualRenderDiagnosticCode
  message: string
  pageNumber?: number
  componentId?: string
  componentType?: string
}

export interface VisualRenderOptions {
  mmToPx?: number
  includePageStyle?: boolean
}

const DEFAULT_MM_TO_PX = 3.7795

function cssText(value: unknown, fallback: string): string {
  const text = String(value ?? fallback)
  return /[<>{};]/.test(text) ? fallback : text
}

function numberOption(value: unknown, fallback: number): number {
  return typeof value === 'number' && Number.isFinite(value) ? value : fallback
}

interface VisualRenderPageContext {
  pageNumber: number
  totalPages: number
}

function renderText(
  component: HPrintComponent,
  data: Record<string, unknown>,
  pageContext: VisualRenderPageContext = { pageNumber: 1, totalPages: 1 },
): string {
  const options = component.options || {}
  let rawContent = component.type === 'receipt-total' && !options.content
    ? `${options.label ?? 'Total'}: ${options.value ?? '0.00'}`
    : String(options.content ?? '')
  if (component.type === 'page-number') {
    rawContent = rawContent
      .replace(/\{page\}/g, String(pageContext.pageNumber))
      .replace(/\{total\}/g, String(pageContext.totalPages))
  }
  const content = escapeHtml(bindTemplate(rawContent, data as Record<string, any>))
  const fontSize = numberOption(options.fontSize ?? options.valueFontSize, 14)
  const color = cssText(options.color, '#000000')
  const fontFamily = cssText(options.fontFamily, 'Arial')
  const fontWeight = cssText(options.fontWeight, component.type === 'receipt-total' ? 'bold' : 'normal')
  const textAlign = cssText(options.textAlign, component.type === 'receipt-total' ? 'right' : 'left')
  const lineHeight = numberOption(options.lineHeight, Math.round(fontSize * 1.2))
  const whiteSpace = cssText(options.whiteSpace, 'pre-wrap')
  const overflowMode = cssText(options.overflow, 'hidden')
  const maxLines = Math.max(0, numberOption(options.maxLines, 0))
  const overflow = overflowMode === 'visible' ? 'visible' : 'hidden'
  const textOverflow = overflowMode === 'ellipsis' ? 'ellipsis' : 'clip'
  const clampStyle = maxLines > 0
    ? `display:-webkit-box;-webkit-line-clamp:${maxLines};-webkit-box-orient:vertical;`
    : 'display:block;'

  return `<div class="hprint-text" style="${clampStyle}font-size:${fontSize}px;line-height:${lineHeight}px;color:${color};font-family:${fontFamily};font-weight:${fontWeight};text-align:${textAlign};white-space:${whiteSpace};word-break:break-word;overflow:${overflow};text-overflow:${textOverflow};">${content}</div>`
}

function renderWatermark(
  component: HPrintComponent,
  data: Record<string, unknown>,
  mmToPx: number = DEFAULT_MM_TO_PX,
): string {
  const options = component.options || {}
  const content = escapeHtml(bindTemplate(String(options.content ?? 'Watermark'), data as Record<string, any>))
  const fontSize = numberOption(options.fontSize, 36)
  const lineHeight = numberOption(options.lineHeight, Math.round(fontSize * 1.2))
  const color = cssText(options.color, '#999999')
  const fontFamily = cssText(options.fontFamily, 'Arial')
  const fontWeight = cssText(options.fontWeight, 'bold')
  const textAlign = cssText(options.textAlign, 'center')
  const mode = options.mode === 'center' ? 'center' : 'tile'
  const rotate = numberOption(options.rotate, -30)
  const opacity = Math.min(1, Math.max(0, numberOption(options.opacity, 0.25)))
  const baseStyle = `font-size:${fontSize}px;line-height:${lineHeight}px;color:${color};font-family:${fontFamily};font-weight:${fontWeight};text-align:${textAlign};opacity:${opacity};`

  if (mode === 'center') {
    return `<div class="hprint-watermark" style="${baseStyle}position:relative;width:100%;height:100%;display:flex;align-items:center;justify-content:center;overflow:hidden;"><span style="white-space:nowrap;transform:rotate(${rotate}deg);">${content}</span></div>`
  }

  // 平铺模式：按间距在组件框内生成旋转文字网格，隔行交错，视觉上覆盖整个区域
  const widthPx = Math.max(1, numberOption(component.width, 120) * mmToPx)
  const heightPx = Math.max(1, numberOption(component.height, 40) * mmToPx)
  const spacing = Math.max(40, numberOption(options.tileSpacing, Math.round(fontSize * 3)))
  const cols = Math.max(1, Math.ceil(widthPx / spacing) + 1)
  const rows = Math.max(1, Math.ceil(heightPx / spacing) + 1)
  const tiles: string[] = []
  for (let row = 0; row < rows; row++) {
    for (let col = 0; col < cols; col++) {
      const left = col * spacing + (row % 2 === 1 ? spacing / 2 : 0)
      const top = row * spacing
      tiles.push(
        `<span style="position:absolute;left:${left}px;top:${top}px;white-space:nowrap;transform:translate(-50%,-50%) rotate(${rotate}deg);">${content}</span>`,
      )
    }
  }
  return `<div class="hprint-watermark" style="${baseStyle}position:relative;width:100%;height:100%;overflow:hidden;">${tiles.join('')}</div>`
}

function renderReceiptKeyValue(component: HPrintComponent, data: Record<string, unknown>): string {
  const options = component.options || {}
  const key = escapeHtml(bindTemplate(String(options.key ?? ''), data as Record<string, any>))
  const value = escapeHtml(bindTemplate(String(options.value ?? ''), data as Record<string, any>))
  const fontWeight = cssText(options.fontWeight, 'normal')

  return `<div class="hprint-keyvalue" style="font-weight:${fontWeight};"><span>${key}</span><span>${value}</span></div>`
}

function renderReceiptFeed(component: HPrintComponent): string {
  const lines = Math.max(0, numberOption(component.options?.lines, 3))
  return `<div style="width:100%;height:${lines * 6}px;"></div>`
}

function renderReceiptCut(component: HPrintComponent): string {
  const cutType = escapeHtml(component.options?.type ?? 'full')
  return `<div class="hprint-placeholder">CUT ${cutType}</div>`
}

function renderLine(component: HPrintComponent): string {
  const options = component.options || {}
  const color = cssText(options.color, '#000000')
  const lineWidth = numberOption(options.lineWidth, 1)
  const lineStyle = cssText(options.lineStyle, 'solid')
  const direction = options.direction === 'vertical' ? 'vertical' : 'horizontal'
  const borderBottom = direction === 'horizontal' ? `${lineWidth}px ${lineStyle} ${color}` : 'none'
  const borderRight = direction === 'vertical' ? `${lineWidth}px ${lineStyle} ${color}` : 'none'

  return `<div class="hprint-line" style="border-bottom:${borderBottom};border-right:${borderRight};"></div>`
}

function renderRect(component: HPrintComponent): string {
  const options = component.options || {}
  const backgroundColor = cssText(options.backgroundColor, 'transparent')
  const borderColor = cssText(options.borderColor, '#000000')
  const borderWidth = numberOption(options.borderWidth, 1)
  const borderStyle = cssText(options.borderStyle, 'solid')
  const borderRadius = numberOption(options.borderRadius, 0)

  return `<div class="hprint-rect" style="background-color:${backgroundColor};border:${borderWidth}px ${borderStyle} ${borderColor};border-radius:${borderRadius}px;"></div>`
}

function renderEllipse(component: HPrintComponent): string {
  const options = component.options || {}
  const backgroundColor = cssText(options.backgroundColor, 'transparent')
  const borderColor = cssText(options.borderColor, '#000000')
  const borderWidth = numberOption(options.borderWidth, 1)
  const borderStyle = cssText(options.borderStyle, 'solid')

  return `<div class="hprint-ellipse" style="background-color:${backgroundColor};border:${borderWidth}px ${borderStyle} ${borderColor};border-radius:50%;"></div>`
}

function renderImage(component: HPrintComponent, data: Record<string, unknown>): string {
  const options = component.options || {}
  const rawSrc = options.src ?? options.url ?? options.content ?? ''
  const boundSrc = bindTemplate(String(rawSrc), data as Record<string, any>)
  const objectFit = cssText(options.objectFit, 'contain')
  const objectPosition = cssText(options.objectPosition, 'center center')

  if (!boundSrc) {
    return '<div class="hprint-placeholder">IMAGE</div>'
  }

  const cropX = numberOption(options.cropX, 0)
  const cropY = numberOption(options.cropY, 0)
  const cropWidth = numberOption(options.cropWidth, 100)
  const cropHeight = numberOption(options.cropHeight, 100)
  const hasCrop = cropX !== 0 || cropY !== 0 || cropWidth !== 100 || cropHeight !== 100
  const clipPath = hasCrop
    ? `clip-path:inset(${cropY}% ${100 - cropX - cropWidth}% ${100 - cropY - cropHeight}% ${cropX}%);`
    : ''

  return `<img class="hprint-image" src="${escapeAttr(boundSrc)}" alt="" style="object-fit:${objectFit};object-position:${objectPosition};${clipPath}" />`
}

/** 取表格列树的所有叶子列（决定表体单元格顺序与总列数） */
function tableLeafColumns(columns: unknown): any[] {
  const leaves: any[] = []
  const walk = (cols: any[]) => {
    cols.forEach((col) => {
      const children = Array.isArray(col?.children) && col.children.length ? col.children : null
      if (children) walk(children)
      else if (col) leaves.push(col)
    })
  }
  walk(Array.isArray(columns) ? (columns as any[]) : [])
  return leaves
}

/** 取表格列树的表头行数（分组表头深度） */
function tableColumnDepth(columns: unknown): number {
  let maxDepth = 1
  const walk = (cols: any[], depth: number) => {
    if (depth > maxDepth) maxDepth = depth
    cols.forEach((col) => {
      const children = Array.isArray(col?.children) && col.children.length ? col.children : null
      if (children) walk(children, depth + 1)
    })
  }
  walk(Array.isArray(columns) ? (columns as any[]) : [], 1)
  return Math.max(1, maxDepth)
}

function tableHeaderRowCount(columns: unknown, showHeader: boolean): number {
  return showHeader ? tableColumnDepth(columns) : 0
}

interface TableHeaderCell {
  cell: any
  colspan: number
  rowspan: number
}

/** 构建多行分组表头：分组列 colspan=子叶数，叶列 rowspan=剩余深度 */
function buildTableHeaderRows(columns: unknown, maxDepth: number): TableHeaderCell[][] {
  const rows: TableHeaderCell[][] = Array.from({ length: maxDepth }, () => [])
  const walk = (cols: any[], depth: number) => {
    cols.forEach((col) => {
      const children = Array.isArray(col?.children) && col.children.length ? col.children : null
      if (children) {
        rows[depth].push({ cell: col, colspan: tableLeafColumns(children).length, rowspan: 1 })
        walk(children, depth + 1)
      } else {
        rows[depth].push({ cell: col, colspan: 1, rowspan: maxDepth - depth })
      }
    })
  }
  walk(Array.isArray(columns) ? (columns as any[]) : [], 0)
  return rows
}

/**
 * 计算表体纵向合并（rowspan）：
 * 启用 merge 的列把连续同值单元格合并，返回每行每叶列的 rowspan（0 表示被合并覆盖需跳过）。
 * 分页拆行后在每页行块内独立计算，因此合并组跨页时在页边界截断，续页重新显示值。
 */
function computeTableRowSpans(rows: unknown[], columns: any[]): number[][] {
  const spans = rows.map(() => columns.map(() => 1))
  columns.forEach((column, columnIndex) => {
    if (!column?.merge) return
    const field = String(column.field ?? '')
    let groupStart = 0
    for (let rowIndex = 1; rowIndex <= rows.length; rowIndex++) {
      const prev = String(getNestedValue(rows[rowIndex - 1] as Record<string, any>, field) ?? '')
      const current = rowIndex < rows.length
        ? String(getNestedValue(rows[rowIndex] as Record<string, any>, field) ?? '')
        : null
      const same = current !== null && current !== '' && current === prev
      if (!same) {
        const span = rowIndex - groupStart
        if (span > 1) {
          spans[groupStart][columnIndex] = span
          for (let covered = groupStart + 1; covered < rowIndex; covered++) {
            spans[covered][columnIndex] = 0
          }
        }
        groupStart = rowIndex
      }
    }
  })
  return spans
}

/** 匹配表格条件样式规则（数值比较优先，否则字符串比较） */
function matchTableCellRule(rule: any, value: unknown): boolean {
  const op = String(rule?.op ?? 'eq')
  const target = rule?.value
  const raw = value ?? ''
  const asNumber = Number(raw)
  const targetNumber = Number(target)
  const numeric = op !== 'contains'
    && String(target ?? '') !== ''
    && Number.isFinite(asNumber)
    && Number.isFinite(targetNumber)
  switch (op) {
    case 'eq':
      return numeric ? asNumber === targetNumber : String(raw) === String(target ?? '')
    case 'ne':
      return numeric ? asNumber !== targetNumber : String(raw) !== String(target ?? '')
    case 'gt':
      return numeric && asNumber > targetNumber
    case 'gte':
      return numeric && asNumber >= targetNumber
    case 'lt':
      return numeric && asNumber < targetNumber
    case 'lte':
      return numeric && asNumber <= targetNumber
    case 'contains':
      return String(raw).includes(String(target ?? ''))
    case 'empty':
      return String(raw).trim() === ''
    case 'notEmpty':
      return String(raw).trim() !== ''
    default:
      return false
  }
}

function tableRuleStyle(rule: any): string {
  const styles: string[] = []
  if (rule.color) styles.push(`color:${cssText(rule.color, '#000000')};`)
  if (rule.backgroundColor) styles.push(`background-color:${cssText(rule.backgroundColor, 'transparent')};`)
  if (rule.fontWeight) styles.push(`font-weight:${cssText(rule.fontWeight, 'normal')};`)
  if (rule.fontStyle) styles.push(`font-style:${cssText(rule.fontStyle, 'normal')};`)
  return styles.join('')
}

/** scope='cell'：只作用于取值字段对应列的单元格；field 不填时按当前列取值 */
function tableCellRuleStyle(rules: unknown, row: unknown, column: any): string {
  if (!Array.isArray(rules) || !rules.length) return ''
  const styles: string[] = []
  rules.forEach((rule: any) => {
    if (!rule || (rule.scope ?? 'cell') !== 'cell') return
    const field = String(rule.field ?? column?.field ?? '')
    if (rule.field && field !== String(column?.field ?? '')) return
    const value = getNestedValue(row as Record<string, any>, field)
    if (matchTableCellRule(rule, value)) styles.push(tableRuleStyle(rule))
  })
  return styles.join('')
}

/** scope='row'：整行高亮，必须提供取值字段 */
function tableRowRuleStyle(rules: unknown, row: unknown): string {
  if (!Array.isArray(rules) || !rules.length) return ''
  const styles: string[] = []
  rules.forEach((rule: any) => {
    if (!rule || rule.scope !== 'row') return
    const field = String(rule.field ?? '')
    if (!field) return
    const value = getNestedValue(row as Record<string, any>, field)
    if (matchTableCellRule(rule, value)) styles.push(tableRuleStyle(rule))
  })
  return styles.join('')
}

function renderTable(component: HPrintComponent, data: Record<string, unknown>): string {
  const options = component.options || {}
  const columns = Array.isArray(options.columns) ? options.columns : []
  const leafColumns = tableLeafColumns(columns)
  const headerRowCount = tableHeaderRowCount(columns, options.showHeader !== false)
  const sourceField = String(options.dataSourceField ?? '')
  const rows = sourceField ? getNestedValue(data as Record<string, any>, sourceField) : []
  const sourceRows = Array.isArray(rows) ? rows : []
  const rowData = Array.isArray(options.__hprintRows) ? options.__hprintRows : sourceRows
  const summaryRows = Array.isArray(options.__hprintSummaryRows) ? options.__hprintSummaryRows : rowData
  const rowHeight = numberOption(options.rowHeight, 25)
  const headerHeight = numberOption(options.headerHeight, 30)
  const showHeader = options.showHeader !== false
  const borderWidth = numberOption(options.borderWidth, 1)
  const borderColor = cssText(options.borderColor, '#000000')
  const borderStyle = cssText(options.borderStyle, 'solid')
  const headerBackgroundColor = cssText(options.headerBackgroundColor, '#f5f5f5')
  const headerColor = cssText(options.headerColor, '#000000')
  const rowBackgroundColor = cssText(options.rowBackgroundColor, '#ffffff')
  const alternatingRowBackgroundColor = cssText(options.alternatingRowBackgroundColor, '#fafafa')
  const fontSize = numberOption(options.fontSize, 12)
  const fontFamily = cssText(options.fontFamily, 'Arial')
  const textAlign = cssText(options.textAlign, 'left')
  const headerFontSize = numberOption(options.headerFontSize, fontSize)
  const headerFontWeight = cssText(options.headerFontWeight, 'bold')
  const headerAlign = cssText(options.headerAlign, textAlign)
  const cellPadding = cssText(options.cellPadding, '4px 8px')
  const showOuterBorder = options.showOuterBorder !== false
  const showRowLines = options.showRowLines !== false
  const showColumnLines = options.showColumnLines !== false
  const cellRules = Array.isArray(options.cellRules) ? options.cellRules : []
  const maxRows = Math.max(0, numberOption(options.maxRows, 0))
  const visibleRows = maxRows > 0 ? rowData.slice(0, maxRows) : rowData
  const emptyText = escapeHtml(options.emptyText ?? '暂无数据')
  const showSummary = options.__hprintShowSummary ?? options.showSummary === true
  const summaryLabel = escapeHtml(options.summaryLabel ?? '合计')
  const summaryField = String(options.summaryField ?? '')
  const summaryText = String(options.summaryText ?? '')

  if (!leafColumns.length) {
    return '<div class="hprint-placeholder">TABLE</div>'
  }

  const border = `${borderWidth}px ${borderStyle} ${borderColor}`
  const cellBorder = `border-top:0;border-left:0;${showColumnLines ? `border-right:${border};` : 'border-right:0;'}${showRowLines ? `border-bottom:${border};` : 'border-bottom:0;'}`
  const tableBorder = showOuterBorder ? `border:${border};` : 'border:0;'
  const headerRowHeight = Math.max(0, numberOption(options.headerRowHeight, headerHeight))
  const colgroup = `<colgroup>${leafColumns.map((column: any) => {
    return `<col${column.width ? ` style="width:${numberOption(column.width, 80)}px;"` : ''}>`
  }).join('')}</colgroup>`
  const headerRowsHtml = showHeader
    ? buildTableHeaderRows(columns, headerRowCount).map((row) => {
        const cells = row.map(({ cell, colspan, rowspan }) => {
          const align = cssText(cell.align, headerAlign)
          const colFontSize = numberOption(cell.fontSize, headerFontSize)
          const colFontWeight = cssText(cell.fontWeight, headerFontWeight)
          const colColor = cssText(cell.color, headerColor)
          const colBackground = cssText(cell.backgroundColor, headerBackgroundColor)
          const spanAttrs = `${colspan > 1 ? ` colspan="${colspan}"` : ''}${rowspan > 1 ? ` rowspan="${rowspan}"` : ''}`
          return `<th${spanAttrs} style="text-align:${align};height:${headerRowHeight}px;padding:${cellPadding};background-color:${colBackground};color:${colColor};font-size:${colFontSize}px;font-weight:${colFontWeight};${cellBorder}">${escapeHtml(cell.title ?? cell.field ?? '')}</th>`
        }).join('')
        return `<tr>${cells}</tr>`
      }).join('')
    : ''

  const rowSpans = computeTableRowSpans(visibleRows, leafColumns)
  const body = visibleRows.map((row, rowIndex) => {
    const rowBackground = rowIndex % 2 === 0 ? rowBackgroundColor : alternatingRowBackgroundColor
    const rowStyle = tableRowRuleStyle(cellRules, row)
    const cells: string[] = []
    let columnIndex = 0
    while (columnIndex < leafColumns.length) {
      const column: any = leafColumns[columnIndex]
      const span = rowSpans[rowIndex]?.[columnIndex] ?? 1
      if (span === 0) {
        columnIndex += 1
        continue
      }
      // 表体横向合并：colspan 覆盖后续列，钳制在剩余列数内
      const colspan = Math.min(
        leafColumns.length - columnIndex,
        Math.max(1, Math.floor(numberOption(column.colspan, 1))),
      )
      const width = colspan === 1 && column.width ? `width:${numberOption(column.width, 80)}px;` : ''
      const align = cssText(column.align, textAlign)
      const colFontSize = numberOption(column.fontSize, fontSize)
      const colFontWeight = cssText(column.fontWeight, 'normal')
      const colColor = cssText(column.color, '#000000')
      const colBackground = cssText(column.backgroundColor, rowBackground)
      const value = getNestedValue(row as Record<string, any>, String(column.field ?? ''))
      const ruleStyle = rowStyle + tableCellRuleStyle(cellRules, row, column)
      const spanAttrs = `${span > 1 ? ` rowspan="${span}"` : ''}${colspan > 1 ? ` colspan="${colspan}"` : ''}`
      cells.push(`<td${spanAttrs} style="${width}text-align:${align};height:${rowHeight * span}px;padding:${cellPadding};background-color:${colBackground};color:${colColor};font-size:${colFontSize}px;font-weight:${colFontWeight};${cellBorder}${ruleStyle}">${escapeHtml(value)}</td>`)
      columnIndex += colspan
    }
    return `<tr>${cells.join('')}</tr>`
  }).join('')
  const emptyRow = visibleRows.length === 0
    ? `<tr><td style="height:${rowHeight}px;padding:${cellPadding};text-align:center;color:#909399;${cellBorder}" colspan="${leafColumns.length}">${emptyText}</td></tr>`
    : ''
  const summaryTotal = summaryField
    ? summaryRows.reduce((sum: number, row: unknown) => sum + Number(getNestedValue(row as Record<string, any>, summaryField) || 0), 0)
    : 0
  const summaryValue = summaryText
    ? bindTemplate(summaryText, { ...(data as Record<string, any>), total: summaryTotal })
    : summaryField
      ? String(summaryTotal)
      : ''
  const summaryRow = showSummary
    ? leafColumns.length === 1
      ? `<tr><td style="height:${rowHeight}px;padding:${cellPadding};text-align:right;font-weight:bold;${cellBorder}">${summaryLabel}${summaryValue ? ` ${escapeHtml(summaryValue)}` : ''}</td></tr>`
      : `<tr><td style="height:${rowHeight}px;padding:${cellPadding};font-weight:bold;${cellBorder}" colspan="${leafColumns.length - 1}">${summaryLabel}</td><td style="height:${rowHeight}px;padding:${cellPadding};text-align:right;font-weight:bold;${cellBorder}">${escapeHtml(summaryValue)}</td></tr>`
    : ''

  const showPageSubtotal = options.__hprintShowPageSubtotal === true
  const pageSubtotalLabel = escapeHtml(options.pageSubtotalLabel ?? '小计')
  const pageSubtotalField = String(options.pageSubtotalField ?? summaryField ?? '')
  const pageSubtotalRows = Array.isArray(options.__hprintPageSubtotalRows) ? options.__hprintPageSubtotalRows : rowData
  const pageSubtotalTotal = pageSubtotalField
    ? pageSubtotalRows.reduce((sum: number, row: unknown) => sum + Number(getNestedValue(row as Record<string, any>, pageSubtotalField) || 0), 0)
    : 0
  const pageSubtotalRow = showPageSubtotal && pageSubtotalField
    ? leafColumns.length === 1
      ? `<tr><td style="height:${rowHeight}px;padding:${cellPadding};text-align:right;font-weight:bold;${cellBorder}background:#f0f9ff;">${pageSubtotalLabel} ${escapeHtml(String(pageSubtotalTotal))}</td></tr>`
      : `<tr><td style="height:${rowHeight}px;padding:${cellPadding};font-weight:bold;${cellBorder}background:#f0f9ff;" colspan="${leafColumns.length - 1}">${pageSubtotalLabel}</td><td style="height:${rowHeight}px;padding:${cellPadding};text-align:right;font-weight:bold;${cellBorder}background:#f0f9ff;">${escapeHtml(String(pageSubtotalTotal))}</td></tr>`
    : ''

  return `<table class="hprint-table" style="${tableBorder}font-family:${fontFamily};">${colgroup}<thead>${headerRowsHtml}</thead><tbody>${body || emptyRow}${pageSubtotalRow}${summaryRow}</tbody></table>`
}

function renderPlaceholder(component: HPrintComponent, label: string, data: Record<string, unknown>): string {
  const content = component.options?.content
    ? bindTemplate(String(component.options.content), data as Record<string, any>)
    : label

  return `<div class="hprint-placeholder">${escapeHtml(content)}</div>`
}

function renderQrCode(component: HPrintComponent, data: Record<string, unknown>): string {
  const content = bindCodeContent(component.options, data, 'QR')
  return renderQrSvg(content, component.options)
}

function renderBarcode(component: HPrintComponent, data: Record<string, unknown>): string {
  const content = bindCodeContent(component.options, data, 'BARCODE')
  return renderBarcodeSvg(content, component.options)
}

export function renderComponentToHtml(
  component: HPrintComponent,
  data: Record<string, unknown> = {},
  pageContext: VisualRenderPageContext = { pageNumber: 1, totalPages: 1 },
  mmToPx: number = DEFAULT_MM_TO_PX,
): string {
  switch (component.type) {
    case 'text':
    case 'receipt-title':
    case 'receipt-text':
    case 'receipt-total':
    case 'page-header':
    case 'page-footer':
    case 'page-number':
      return renderText(component, data, pageContext)
    case 'watermark':
      return renderWatermark(component, data, mmToPx)
    case 'receipt-keyvalue':
      return renderReceiptKeyValue(component, data)
    case 'line':
    case 'receipt-divider':
      return renderLine(component)
    case 'rect':
      return renderRect(component)
    case 'ellipse':
      return renderEllipse(component)
    case 'image':
      return renderImage(component, data)
    case 'table':
      return renderTable(component, data)
    case 'qrcode':
    case 'receipt-qrcode':
      return renderQrCode(component, data)
    case 'barcode':
    case 'receipt-barcode':
      return renderBarcode(component, data)
    case 'receipt-feed':
      return renderReceiptFeed(component)
    case 'receipt-cut':
      return renderReceiptCut(component)
    default:
      return renderPlaceholder(component, String(component.type || 'UNKNOWN'), data)
  }
}

function componentWrapper(
  component: HPrintComponent,
  innerHtml: string,
  mmToPx: number,
  index: number,
  yOffsetMm = 0,
): string {
  const x = numberOption(component.x, 0) * mmToPx
  const y = (numberOption(component.y, 0) - yOffsetMm) * mmToPx
  const width = numberOption(component.width, 0) * mmToPx
  const height = numberOption(component.height, 0) * mmToPx
  const rotate = numberOption(component.rotate, 0)
  const opacity = numberOption(component.opacity, 1)
  // 层级从 0 起（负值会被父级背景盖住导致不可见）：水印默认 1（垫底），其余组件按序号 +2 递增
  const zIndex = Math.max(0, component.zIndex ?? (component.type === 'watermark' ? 1 : index + 2))

  const split = component.options?.__hprintSplit as { contentHeightMm?: number; clipTopMm?: number } | undefined
  const content = split
    ? `<div class="hprint-split-window" style="width:100%;height:${numberOption(split.contentHeightMm, numberOption(component.height, 0)) * mmToPx}px;margin-top:${-Math.max(0, numberOption(split.clipTopMm, 0)) * mmToPx}px;">${innerHtml}</div>`
    : innerHtml
  const overflowStyle = split ? 'overflow:hidden;' : ''

  return `<div class="hprint-component" style="left:${x}px;top:${y}px;width:${width}px;height:${height}px;${overflowStyle}transform:rotate(${rotate}deg);opacity:${opacity};z-index:${zIndex};">${content}</div>`
}

interface TemplateRenderGeometry {
  mmToPx: number
  includePageStyle: boolean
  widthMm: number
  heightMm: number
  widthPx: number
  heightPx: number
  orientation: 'portrait' | 'landscape'
}

function getTemplateGeometry(template: HPrintTemplate, options: VisualRenderOptions = {}): TemplateRenderGeometry {
  const mmToPx = options.mmToPx ?? DEFAULT_MM_TO_PX
  const includePageStyle = options.includePageStyle ?? true
  const rawWidthMm = numberOption(template.paper?.width, 80)
  const rawHeightMm = numberOption(template.paper?.height, 200)
  const orientation = template.paper?.orientation ?? (rawWidthMm > rawHeightMm ? 'landscape' : 'portrait')

  // 以方向为准纠正宽高：横向时长边为宽，纵向时短边为宽，
  // 避免 paper.width/height 与 orientation 不一致导致出纸方向错乱
  const longSide = Math.max(rawWidthMm, rawHeightMm)
  const shortSide = Math.min(rawWidthMm, rawHeightMm)
  const widthMm = orientation === 'landscape' ? longSide : shortSide
  const heightMm = orientation === 'landscape' ? shortSide : longSide
  const widthPx = widthMm * mmToPx
  const heightPx = heightMm * mmToPx

  return {
    mmToPx,
    includePageStyle,
    widthMm,
    heightMm,
    widthPx,
    heightPx,
    orientation,
  }
}

function buildTemplateHtml(
  body: string,
  geometry: TemplateRenderGeometry,
): string {
  const pageStyle = geometry.includePageStyle
    ? `@page { size: ${geometry.widthMm}mm ${geometry.heightMm}mm; margin: 0; }`
    : ''

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${pageStyle}
html, body {
  margin: 0;
  padding: 0;
  width: ${geometry.widthPx}px;
  height: ${geometry.heightPx}px;
  background: #ffffff;
}
body {
  overflow: hidden;
}
.hprint-paper {
  position: relative;
  width: ${geometry.widthPx}px;
  height: ${geometry.heightPx}px;
  background: #ffffff;
}
.hprint-component {
  position: absolute;
  box-sizing: border-box;
  transform-origin: center center;
}
.hprint-text {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  padding: 2px;
  box-sizing: border-box;
}
.hprint-line {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.hprint-rect,
.hprint-ellipse {
  width: 100%;
  height: 100%;
  box-sizing: border-box;
}
.hprint-image {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.hprint-qrcode,
.hprint-barcode {
  width: 100%;
  height: 100%;
  display: block;
}
.hprint-keyvalue {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: space-between;
  font-family: Arial;
  font-size: 14px;
  padding: 2px;
  box-sizing: border-box;
}
.hprint-table {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
}
.hprint-table th,
.hprint-table td {
  overflow: hidden;
  box-sizing: border-box;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.hprint-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  color: #909399;
  font-size: 12px;
  box-sizing: border-box;
}
.hprint-code-placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  color: #909399;
  font-size: 12px;
  box-sizing: border-box;
}
</style>
</head>
<body>
<div class="hprint-paper" data-orientation="${geometry.orientation}">
${body}
</div>
</body>
</html>`
}

function isRepeatingPageComponent(component: HPrintComponent): boolean {
  return ['page-header', 'page-footer', 'page-number', 'watermark'].includes(component.type)
}

function pageIndexForComponent(component: HPrintComponent, pageHeightMm: number): number {
  return Math.max(0, Math.floor(numberOption(component.y, 0) / pageHeightMm))
}

function getTableRows(component: HPrintComponent, data: Record<string, unknown>): unknown[] {
  const options = component.options || {}
  const sourceField = String(options.dataSourceField ?? '')
  const rows = sourceField ? getNestedValue(data as Record<string, any>, sourceField) : []
  const sourceRows = Array.isArray(rows) ? rows : []
  const maxRows = Math.max(0, numberOption(options.maxRows, 0))
  return maxRows > 0 ? sourceRows.slice(0, maxRows) : sourceRows
}

function tableRowsPerPage(component: HPrintComponent): number {
  const options = component.options || {}
  const rowHeight = Math.max(1, numberOption(options.rowHeight, 25))
  const headerRowHeight = Math.max(0, numberOption(options.headerRowHeight, numberOption(options.headerHeight, 30)))
  const headerHeight = options.showHeader === false
    ? 0
    : tableHeaderRowCount(options.columns, true) * headerRowHeight
  const summaryHeight = options.showSummary === true ? rowHeight : 0
  const pageSubtotalHeight = options.showPageSubtotal === true ? rowHeight : 0
  const availableHeight = Math.max(
    rowHeight,
    numberOption(component.height, 40) - headerHeight - summaryHeight - pageSubtotalHeight,
  )
  return Math.max(1, Math.floor(availableHeight / rowHeight))
}

function splitRowsForPages(rows: unknown[], rowsPerPage: number, orphanThreshold: number): unknown[][] {
  const chunks: unknown[][] = []
  for (let rowIndex = 0; rowIndex < rows.length; rowIndex += rowsPerPage) {
    chunks.push(rows.slice(rowIndex, rowIndex + rowsPerPage))
  }

  const lastIndex = chunks.length - 1
  if (lastIndex > 0 && rowsPerPage > 1 && orphanThreshold > 0) {
    const last = chunks[lastIndex]
    const previous = chunks[lastIndex - 1]
    if (last.length > 0 && last.length <= orphanThreshold && previous.length > 1) {
      const targetLastRows = Math.min(rowsPerPage, orphanThreshold + 1)
      const moveCount = Math.min(targetLastRows - last.length, previous.length - 1)
      if (moveCount > 0) {
        last.unshift(...previous.splice(previous.length - moveCount, moveCount))
      }
    }
  }

  return chunks
}

function expandPaginatedTables(
  components: HPrintComponent[],
  data: Record<string, unknown>,
  pageHeightMm: number,
): { components: HPrintComponent[]; diagnostics: VisualRenderDiagnostic[] } {
  const expanded: HPrintComponent[] = []
  const diagnostics: VisualRenderDiagnostic[] = []

  components.forEach((component) => {
    if (component.type !== 'table' || component.options?.paginate === false) {
      expanded.push(component)
      return
    }

    const rows = getTableRows(component, data)
    const rowsPerPage = tableRowsPerPage(component)
    if (rows.length <= rowsPerPage) {
      expanded.push(component)
      return
    }

    const orphanThreshold = Math.max(0, Math.floor(numberOption(component.options?.orphanRows, 1)))
    const pageRowsList = splitRowsForPages(rows, rowsPerPage, orphanThreshold)
    const splitPages = pageRowsList.length
    diagnostics.push({
      level: 'info',
      code: 'table-paginated',
      componentId: component.id,
      componentType: component.type,
      pageNumber: pageIndexForComponent(component, pageHeightMm) + 1,
      message: `表格 ${component.id} 共 ${rows.length} 行，已按每页 ${rowsPerPage} 行拆成 ${splitPages} 页。`,
    })

    const startPage = pageIndexForComponent(component, pageHeightMm)
    const pageY = numberOption(component.y, 0) - startPage * pageHeightMm
    pageRowsList.forEach((pageRows, pageOffset) => {
      const isLastPage = pageOffset === pageRowsList.length - 1
      const showPageSubtotal = component.options?.showPageSubtotal === true && !isLastPage
      const copyY = (startPage + pageOffset) * pageHeightMm + pageY
      // 每个分页副本限制在单页内，避免副本高度撑出页外导致多算页数
      const copyHeight = Math.max(
        0,
        Math.min(numberOption(component.height, 40), (startPage + pageOffset + 1) * pageHeightMm - copyY),
      )
      expanded.push({
        ...component,
        id: `${component.id}-page-${pageOffset + 1}`,
        y: copyY,
        height: copyHeight,
        options: {
          ...component.options,
          __hprintRows: pageRows,
          __hprintSummaryRows: rows,
          __hprintShowSummary: isLastPage ? component.options?.showSummary === true : false,
          __hprintShowPageSubtotal: showPageSubtotal,
          __hprintPageSubtotalRows: pageRows,
          __hprintPageNumber: pageOffset + 1,
          __hprintTotalPages: splitPages,
        },
      })
    })
  })

  return { components: expanded, diagnostics }
}

const SPLITTABLE_TEXT_TYPES = new Set([
  'text',
  'receipt-title',
  'receipt-text',
  'receipt-total',
  'receipt-keyvalue',
])

/** 图片/形状类：切片可保证内容不丢失，默认允许跨页拆分 */
const SPLITTABLE_SHAPE_TYPES = new Set([
  'image',
  'rect',
  'ellipse',
  'line',
])

/** 码图类：拆分后无法扫描，禁止跨页拆分 */
const NEVER_SPLIT_TYPES = new Set([
  'qrcode',
  'barcode',
  'receipt-qrcode',
  'receipt-barcode',
])

function isSplittableComponent(component: HPrintComponent): boolean {
  const splitOption = component.options?.splitAcrossPages
  if (splitOption === false) return false
  if (NEVER_SPLIT_TYPES.has(component.type)) return false
  // 旋转组件拆分后每段会围绕自身中心旋转导致错位，不参与拆分
  if (numberOption(component.rotate, 0) !== 0) return false
  return splitOption === true
    || SPLITTABLE_TEXT_TYPES.has(component.type)
    || SPLITTABLE_SHAPE_TYPES.has(component.type)
}

function componentLineHeightMm(component: HPrintComponent, mmToPx: number): number {
  const options = component.options || {}
  const fontSize = numberOption(options.fontSize ?? options.valueFontSize, 14)
  const lineHeightPx = numberOption(options.lineHeight, Math.round(fontSize * 1.2))
  return Math.max(0.5, lineHeightPx / Math.max(0.001, mmToPx))
}

/**
 * 跨页组件拆分：把高度跨越纸张边界的可拆分组件按"可见窗口切片"拆成多段。
 * 每段渲染完整内容并按 clipTopMm 上移，再由组件框裁剪，
 * 因此分页输出与单页所见即所得保持同源，不需要预先统计折行数。
 */
function expandCrossPageComponents(
  components: HPrintComponent[],
  pageHeightMm: number,
  mmToPx: number,
): { components: HPrintComponent[]; diagnostics: VisualRenderDiagnostic[] } {
  const expanded: HPrintComponent[] = []
  const diagnostics: VisualRenderDiagnostic[] = []

  components.forEach((component) => {
    if (isRepeatingPageComponent(component) || !isSplittableComponent(component)) {
      expanded.push(component)
      return
    }

    const y = numberOption(component.y, 0)
    const height = numberOption(component.height, 0)
    const startPage = Math.max(0, Math.floor(y / pageHeightMm))
    const pageY = y - startPage * pageHeightMm
    const firstAvailable = pageHeightMm - pageY
    if (height <= firstAvailable + 0.001) {
      expanded.push(component)
      return
    }

    const lineHeightMm = componentLineHeightMm(component, mmToPx)
    let remaining = height
    let pageIndex = startPage
    let clipTopMm = 0
    let segmentIndex = 0

    while (remaining > 0.001 && segmentIndex < 256) {
      const segmentPageY = segmentIndex === 0 ? pageY : 0
      const available = pageHeightMm - segmentPageY
      // 按行高对齐拆分边界，避免一页中间出现半行；不足一行时按剩余空间兜底
      const usableLines = Math.floor((available + 0.001) / lineHeightMm)
      const segmentHeight = usableLines > 0
        ? Math.min(remaining, usableLines * lineHeightMm)
        : Math.min(remaining, available)

      expanded.push({
        ...component,
        id: `${component.id}-split-${segmentIndex + 1}`,
        y: pageIndex * pageHeightMm + segmentPageY,
        height: segmentHeight,
        options: {
          ...component.options,
          __hprintSourceId: component.id,
          __hprintSplit: {
            contentHeightMm: height,
            clipTopMm: roundMm(clipTopMm),
          },
        },
      })

      clipTopMm += segmentHeight
      remaining -= segmentHeight
      pageIndex += 1
      segmentIndex += 1
    }

    if (remaining > 0.001) {
      // 段数达到安全上限：剩余内容整体放在最后一页顶部，避免内容丢失
      expanded.push({
        ...component,
        id: `${component.id}-split-${segmentIndex + 1}`,
        y: pageIndex * pageHeightMm,
        height: remaining,
        options: {
          ...component.options,
          __hprintSourceId: component.id,
          __hprintSplit: {
            contentHeightMm: height,
            clipTopMm: roundMm(clipTopMm),
          },
        },
      })
      segmentIndex += 1
    }

    diagnostics.push({
      level: 'info',
      code: 'component-split',
      componentId: component.id,
      componentType: component.type,
      pageNumber: startPage + 1,
      message: `文本 ${component.id} 高度 ${roundMm(height)}mm 跨越 ${segmentIndex} 页，已按行高边界拆分续排。`,
    })
  })

  return { components: expanded, diagnostics }
}

function getTotalPages(components: HPrintComponent[], pageHeightMm: number): number {
  const normalComponents = components.filter((component) => !isRepeatingPageComponent(component))
  const maxBottom = Math.max(0, ...normalComponents.map((component) => {
    return numberOption(component.y, 0) + Math.max(0, numberOption(component.height, 0)) - 0.001
  }))
  return Math.max(1, Math.floor(maxBottom / pageHeightMm) + 1)
}

function renderComponentsBody(
  components: HPrintComponent[],
  data: Record<string, unknown>,
  geometry: TemplateRenderGeometry,
  pageContext: VisualRenderPageContext,
  pageIndex = 0,
  paged = false,
): string {
  return components
    .filter((component) => !component.hidden)
    .map((component, index) => componentWrapper(
      component,
      renderComponentToHtml(component, data, pageContext, geometry.mmToPx),
      geometry.mmToPx,
      index,
      paged && !isRepeatingPageComponent(component) ? pageIndex * geometry.heightMm : 0,
    ))
    .join('')
}

function diagnosePageComponents(
  components: HPrintComponent[],
  geometry: TemplateRenderGeometry,
  pageIndex: number,
): VisualRenderDiagnostic[] {
  const diagnostics: VisualRenderDiagnostic[] = []
  const pageNumber = pageIndex + 1

  components.forEach((component) => {
    const x = numberOption(component.x, 0)
    const absoluteY = numberOption(component.y, 0)
    const y = isRepeatingPageComponent(component) ? absoluteY : absoluteY - pageIndex * geometry.heightMm
    const width = numberOption(component.width, 0)
    const height = numberOption(component.height, 0)
    const sourceId = String(component.options?.__hprintSourceId ?? component.id)
    const label = `${component.type}(${sourceId})`

    if (x < 0 || x + width > geometry.widthMm) {
      diagnostics.push({
        level: 'warning',
        code: 'component-overflow-x',
        pageNumber,
        componentId: sourceId,
        componentType: component.type,
        message: `${label} 横向超出纸张范围：x=${roundMm(x)}mm, width=${roundMm(width)}mm, paperWidth=${roundMm(geometry.widthMm)}mm。`,
      })
    }

    if (y < 0 || y > geometry.heightMm) {
      diagnostics.push({
        level: 'warning',
        code: 'component-overflow-y',
        pageNumber,
        componentId: sourceId,
        componentType: component.type,
        message: `${label} 页内 y 坐标超出纸张范围：y=${roundMm(y)}mm, paperHeight=${roundMm(geometry.heightMm)}mm。`,
      })
      return
    }

    if (y + height > geometry.heightMm) {
      const neverSplit = NEVER_SPLIT_TYPES.has(component.type)
      const rotated = numberOption(component.rotate, 0) !== 0
      const suffix = neverSplit
        ? '（码图类组件不支持跨页拆分，请调整位置或尺寸）'
        : rotated
          ? '（旋转组件不参与跨页拆分，请调整位置或尺寸）'
          : ''
      diagnostics.push({
        level: neverSplit ? 'error' : 'warning',
        code: 'component-cross-page',
        pageNumber,
        componentId: sourceId,
        componentType: component.type,
        message: `${label} 高度跨出当前页：y=${roundMm(y)}mm, height=${roundMm(height)}mm, paperHeight=${roundMm(geometry.heightMm)}mm。${suffix}`,
      })
    }
  })

  return diagnostics
}

function roundMm(value: number): number {
  return Number(value.toFixed(2))
}

export function renderTemplateToPages(
  template: HPrintTemplate,
  data: Record<string, unknown> = {},
  options: VisualRenderOptions = {},
): VisualRenderPagesResult {
  const geometry = getTemplateGeometry(template, options)
  const expandedTables = expandPaginatedTables(template.components || [], data, geometry.heightMm)
  const expandedCross = expandCrossPageComponents(expandedTables.components, geometry.heightMm, geometry.mmToPx)
  const components = expandedCross.components
  const totalPages = getTotalPages(components, geometry.heightMm)
  const repeatingComponents = components.filter(isRepeatingPageComponent)
  const normalComponents = components.filter((component) => !isRepeatingPageComponent(component))
  const pages = Array.from({ length: totalPages }, (_, pageIndex) => {
    const pageComponents = [
      ...repeatingComponents,
      ...normalComponents.filter((component) => pageIndexForComponent(component, geometry.heightMm) === pageIndex),
    ]
    const pageContext = { pageNumber: pageIndex + 1, totalPages }
    const body = renderComponentsBody(pageComponents, data, geometry, pageContext, pageIndex, true)
    const html = buildTemplateHtml(body, geometry)
    const diagnostics = diagnosePageComponents(pageComponents, geometry, pageIndex)

    return {
      html,
      widthPx: geometry.widthPx,
      heightPx: geometry.heightPx,
      widthMm: geometry.widthMm,
      heightMm: geometry.heightMm,
      orientation: geometry.orientation,
      pageIndex,
      pageNumber: pageIndex + 1,
      totalPages,
      diagnostics,
    }
  })
  const diagnostics = [
    ...expandedTables.diagnostics,
    ...expandedCross.diagnostics,
    ...pages.flatMap((page) => page.diagnostics),
  ]

  return {
    pages,
    widthPx: geometry.widthPx,
    heightPx: geometry.heightPx,
    widthMm: geometry.widthMm,
    heightMm: geometry.heightMm,
    orientation: geometry.orientation,
    totalPages,
    diagnostics,
  }
}

export function renderTemplateToHtml(
  template: HPrintTemplate,
  data: Record<string, unknown> = {},
  options: VisualRenderOptions = {},
): VisualRenderResult {
  const geometry = getTemplateGeometry(template, options)
  const components = template.components || []
  const body = renderComponentsBody(
    components,
    data,
    geometry,
    { pageNumber: 1, totalPages: 1 },
  )
  const html = buildTemplateHtml(body, geometry)

  return {
    html,
    widthPx: geometry.widthPx,
    heightPx: geometry.heightPx,
    widthMm: geometry.widthMm,
    heightMm: geometry.heightMm,
    orientation: geometry.orientation,
  }
}
