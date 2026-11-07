/**
 * HPrint V2 核心类型定义
 *
 * 模板 JSON 是核心协议资产，所有渲染端都以此为准。
 * 每次破坏性变更都必须有模板版本和迁移函数。
 */

/** 模板 schema 版本 */
export const SCHEMA_VERSION = '2026-06'

/** 纸张尺寸（单位统一为 mm） */
export interface HPrintPaper {
  width: number
  height: number
  unit?: string
  /** 打印方向；缺省时由渲染端按纸张宽高推断 */
  orientation?: 'portrait' | 'landscape'
}

/** 组件类型 — 统一组件，不区分普通/小票 */
export type HPrintComponentType =
  | 'text'
  | 'line'
  | 'rect'
  | 'ellipse'
  | 'image'
  | 'qrcode'
  | 'barcode'
  | 'table'
  | 'page-header'
  | 'page-footer'
  | 'page-number'
  | 'watermark'
  // --- 以下为兼容旧模板，新模板不再使用 ---
  /** @deprecated 使用 text + 大字号替代 */
  | 'receipt-title'
  /** @deprecated 使用 text 替代 */
  | 'receipt-text'
  /** @deprecated 使用两个 text 左右排列替代 */
  | 'receipt-keyvalue'
  /** @deprecated 使用 line 替代 */
  | 'receipt-divider'
  /** @deprecated 使用 text + 加粗替代 */
  | 'receipt-total'
  /** @deprecated 使用 qrcode 替代 */
  | 'receipt-qrcode'
  /** @deprecated 使用 barcode 替代 */
  | 'receipt-barcode'
  /** @deprecated 移到 printOptions.feedLines */
  | 'receipt-feed'
  /** @deprecated 移到 printOptions.cut */
  | 'receipt-cut'

/** 组件基础属性 */
export interface HPrintComponent {
  id: string
  type: HPrintComponentType
  x: number
  y: number
  width: number
  height: number
  rotate?: number
  opacity?: number
  zIndex?: number
  /** 隐藏组件：设计器中半透明显示，不参与打印 */
  hidden?: boolean
  /** 锁定组件：设计器中不可拖拽、不可缩放 */
  locked?: boolean
  options: Record<string, any>
}

/** 打印输出模式 */
export type HPrintRenderMode = 'auto' | 'webview' | 'raw' | 'raw-text' | 'raw-raster'

/** 打印选项 — 模板级别，控制打印行为 */
export interface HPrintPrintOptions {
  /** 打印模式 */
  renderMode?: HPrintRenderMode
  /** 打印份数 */
  copies?: number
  /** 尾部额外走纸行数，兼容旧模板；小票切刀补偿优先使用 cutterFeedMm。 */
  feedLines?: number
  /** Cutter compensation before receipt cutting, in millimeters. Takes priority over feedLines. */
  cutterFeedMm?: number
  /** 切纸方式 */
  cut?: 'none' | 'partial' | 'full'
  /** RAW raster output protocol; useful when printer name cannot be inferred reliably. */
  rawProtocol?: 'escpos' | 'tspl' | 'cpcl'
  /** Label media sensor mode for TSPL/CPCL label printers. */
  labelMediaType?: 'gap' | 'blackMark' | 'continuous'
  /** Label gap height in millimeters, used when labelMediaType is gap. */
  gapMm?: number
  /** Label gap or black-mark sensor offset in millimeters. */
  gapOffsetMm?: number
  /** Black mark height in millimeters, used when labelMediaType is blackMark. */
  blackMarkMm?: number
  /** Label stop/tear offset in millimeters where supported by the protocol. */
  tearOffsetMm?: number
  /**
   * RAW raster pagination strategy.
   * continuous: capture one fixed/continuous paper surface; default for receipt/label.
   * paged: submit per-page visual HTML and let Agent render RAW page by page.
   */
  rawPagination?: 'continuous' | 'paged'
  /** Receipt auto height expands paper height to fit positioned content before cutting. */
  receiptAutoHeight?: boolean
}

export type HPrintPrintUsage = 'label' | 'receipt' | 'document'

/** 字段类型 */
export type HPrintFieldType =
  | 'string'
  | 'number'
  | 'money'
  | 'date'
  | 'datetime'
  | 'boolean'
  | 'image'
  | 'qrcode'
  | 'barcode'
  | 'array'
  | 'object'

/** 字段定义 — 业务项目传入设计器 */
export interface HPrintField {
  /** 字段唯一标识 */
  key: string
  /** 设计器中展示的中文名称 */
  label: string
  /** 字段类型 */
  type: HPrintFieldType
  /** 实际数据路径，缺省时使用 key */
  path?: string
  /** 是否必填 */
  required?: boolean
  /** 默认值 */
  defaultValue?: unknown
  /** 预览数据 */
  sampleValue?: unknown
  /** 格式化规则，如金额、日期 */
  formatter?: string
  /** 对象/数组字段的子字段 */
  children?: HPrintField[]
}

/** 模板定义 */
export interface HPrintTemplate {
  schemaVersion: string
  name?: string
  paper: HPrintPaper
  components: HPrintComponent[]
  /** 字段定义（业务项目传入） */
  fields?: HPrintField[]
  /** 打印选项 */
  printOptions?: HPrintPrintOptions
  /** @deprecated 使用 printOptions.renderMode 替代 */
  designMode?: 'absolute' | 'receipt'
}

/** 客户端预渲染的单色位图页（raw-raster） */
export interface HPrintRasterPage {
  width: number
  height: number
  bytesBase64: string
}

/** 打印任务 */
export interface HPrintPrintJob {
  template: HPrintTemplate
  data: Record<string, unknown>
  /** Client-rendered visual HTML used by Agent WebView printing. */
  renderedHtml?: string
  /** Client-rendered per-page HTML used by paged raw-raster printing. */
  renderedPages?: string[]
  /** Client-rendered 1bit rasters for label/receipt raw printing. */
  renderedRasters?: HPrintRasterPage[]
  printerName?: string
  copies?: number
  documentName?: string
  renderMode?: HPrintRenderMode
  usage?: HPrintPrintUsage
  rawProtocol?: 'escpos' | 'tspl' | 'cpcl' | 'none'
}

/** 打印任务状态 */
export type HPrintJobStatus = 'queued' | 'rendering' | 'printing' | 'printed' | 'failed'

/** 打印任务结果 */
export interface HPrintJobResult {
  jobId: string
  status: HPrintJobStatus
  message?: string
}

export interface HPrintJobArtifact {
  name: string
  label: string
  contentType: string
  size: number
  path?: string
  url: string
}

/** 打印历史摘要（不含模板/数据快照） */
export interface HPrintHistoryEntry {
  id: string
  createdAt: string
  printerName: string
  documentName: string
  templateName?: string
  usage?: string
  renderMode?: string
  copies: number
  status: string
  errorCode?: string
  message?: string
  bytesWritten?: number
  /** 快照因体积超限被截断，重打能力受限 */
  snapshotTruncated?: boolean
}

/** 打印历史详情（含模板/数据快照，可用于重打） */
export interface HPrintHistoryDetail extends HPrintHistoryEntry {
  template?: HPrintTemplate
  data?: Record<string, any>
}

export interface HPrintHistoryListResponse {
  history: HPrintHistoryEntry[]
  count: number
}

/** 打印任务详情（含诊断信息） */
export interface HPrintJobDetail extends HPrintJobResult {
  printerName: string
  documentName: string
  copies: number
  createdAt: string
  renderMode?: string
  bytesWritten?: number
  errorCode?: string
  rawArtifacts?: HPrintJobArtifact[]
  /** RAW 渲染诊断信息 */
  rawMetrics?: {
    paperWidthMm: number
    paperHeightMm: number
    orientation: string
    printWidthMm?: number
    printLengthMm?: number
    renderedHeightMm?: number
    paddedHeightMm?: number
    feedLinesAdded?: number
    overflow?: boolean
    rowCount?: number
    inlineComponentCount?: number
    blockComponentCount?: number
    dpi?: number
    sourceWidthPx?: number
    sourceHeightPx?: number
    targetWidthDots?: number
    targetHeightDots?: number
    targetWidthSource?: string
    printableWidthMm?: number
    bitmapBytes?: number
    rawBytes?: number
    escposBytes?: number
    rawProtocol?: string
    cutterFeedMm?: number
    cutterFeedDots?: number
    scaleX?: number
    scaleY?: number
    calibrationScaleX?: number
    calibrationScaleY?: number
    offsetXMm?: number
    offsetYMm?: number
    topCropMm?: number
    threshold?: number
    invertMono?: boolean
    paperResolution?: {
      source?: string
      policy?: string
      templateValid?: boolean
      mismatch?: boolean
      configWidth?: number
      configHeight?: number
    }
  }
}

/** 打印机能力 */
export interface HPrintPrinterCapabilities {
  paperWidthMm: number
  charsPerLine: number
  encoding: string
  dpi: number
  printableWidthMm?: number
  printableWidthDots?: number
  rasterCalibration?: HPrintRasterCalibration
  rawProtocol?: 'escpos' | 'tspl' | 'cpcl' | 'none'
  supportedModes: string[]
}

export interface HPrintRasterCalibration {
  scaleX?: number
  scaleY?: number
  offsetXMm?: number
  offsetYMm?: number
  topCropMm?: number
  threshold?: number
  invertMono?: boolean
  /** 位图旋转角度，标签机常见需要 180 */
  rotateDegrees?: 0 | 90 | 180 | 270
}

export interface HPrintPrinterUsagePaper {
  width: number
  height: number
  unit?: string
  orientation?: 'portrait' | 'landscape'
}

export type HPrintPaperPolicy = 'template' | 'configFallback' | 'configOverride'

export interface HPrintPrinterUsageConfig {
  printerName?: string
  renderMode?: HPrintRenderMode
  rawProtocol?: 'escpos' | 'tspl' | 'cpcl' | 'none'
  paper?: HPrintPrinterUsagePaper
  paperPolicy?: HPrintPaperPolicy
  printableWidthMm?: number
  printableWidthDots?: number
  cutterFeedMm?: number
  labelMediaType?: 'gap' | 'blackMark' | 'continuous'
  gapMm?: number
  gapOffsetMm?: number
  blackMarkMm?: number
  tearOffsetMm?: number
  rasterCalibration?: HPrintRasterCalibration
}

export interface HPrintPrinterSettings {
  previewBeforePrint?: boolean
  printerSettings: Record<HPrintPrintUsage, HPrintPrinterUsageConfig>
}

/** 打印机信息 */
export interface HPrintPrinter {
  name: string
  isDefault: boolean
  status: string
  printerType: string
  capabilities: HPrintPrinterCapabilities
}

/** Agent 诊断信息 */
export interface HPrintDiagnostics {
  agent: {
    version: string
    protocolVersion: string
  }
  system: {
    platform: string
    arch: string
  }
  printers: {
    count: number
    defaultPrinter?: string
  }
  jobs: {
    total: number
    queued: number
    printing: number
    printed: number
    failed: number
  }
}

export interface HPrintDiagnosticsPackage {
  exportedAt: string
  agentUrl: string
  health?: {
    ok: boolean
    name: string
    version: string
    protocolVersion: string
  }
  diagnostics?: HPrintDiagnostics
  printers?: HPrintPrinter[]
  printerSettings?: HPrintPrinterSettings
  logs?: HPrintJobDetail[]
  failedJobs?: HPrintJobDetail[]
  rawRasterJobs?: Array<{
    jobId: string
    printerName: string
    renderMode?: string
    bytesWritten?: number
    rawMetrics?: HPrintJobDetail['rawMetrics']
    rawArtifacts?: HPrintJobArtifact[]
  }>
  errors?: Array<{
    step: string
    message: string
  }>
}

// --- 组件选项类型 ---

export interface TextOptions {
  content?: string
  fontSize?: number
  color?: string
  fontFamily?: string
  fontWeight?: string
  textAlign?: string
  lineHeight?: number
  whiteSpace?: 'nowrap' | 'pre-wrap'
  overflow?: 'visible' | 'hidden' | 'ellipsis'
  maxLines?: number
  /** 设计器预览时用于字段绑定的示例数据 */
  data?: Record<string, any>
  /**
   * 跨页续排：分页渲染时组件高度跨越纸张边界是否自动拆分续排。
   * 文本类组件默认开启；设为 false 可关闭，设为 true 可对其他组件强制开启。
   */
  splitAcrossPages?: boolean
}

/** 水印组件选项 */
export interface WatermarkOptions {
  content?: string
  fontSize?: number
  color?: string
  fontFamily?: string
  fontWeight?: string
  /** tile：全框斜向平铺（默认）；center：居中单个 */
  mode?: 'tile' | 'center'
  /** 文字旋转角度，单位 deg，默认 -30 */
  rotate?: number
  /** 文字透明度 0-1，默认 0.25 */
  opacity?: number
  /** 平铺间距（px），默认 fontSize * 3 */
  tileSpacing?: number
}

export interface LineOptions {
  color?: string
  lineWidth?: number
  lineStyle?: 'solid' | 'dashed' | 'dotted'
  direction?: 'horizontal' | 'vertical'
}

export interface RectOptions {
  backgroundColor?: string
  borderColor?: string
  borderWidth?: number
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  borderRadius?: number
}

export interface TableColumn {
  /** 叶子列取值字段；分组列可省略 */
  field?: string
  title?: string
  width?: number
  align?: 'left' | 'center' | 'right'
  fontSize?: number
  fontWeight?: string
  color?: string
  backgroundColor?: string
  /**
   * 分组表头：子列数组。有 children 时该列作为分组表头，
   * 占据子列总宽度（colspan），形成多行表头。
   */
  children?: TableColumn[]
  /**
   * 纵向合并相同值：与上方连续同值的单元格合并为 rowspan。
   * 分页时合并组在页边界截断，续页重新显示该值（不跨页合并）。
   */
  merge?: boolean
}

export interface TableOptions {
  dataSourceField?: string
  columns?: TableColumn[]
  rowHeight?: number
  /** 单行表头高度；多行表头时每一行表头的高度 */
  headerHeight?: number
  /** 多行表头每行高度，默认取 headerHeight */
  headerRowHeight?: number
  showHeader?: boolean
  borderWidth?: number
  borderColor?: string
  borderStyle?: 'solid' | 'dashed' | 'dotted'
  headerBackgroundColor?: string
  headerColor?: string
  rowBackgroundColor?: string
  alternatingRowBackgroundColor?: string
  fontSize?: number
  fontFamily?: string
  textAlign?: 'left' | 'center' | 'right'
  maxRows?: number
  emptyText?: string
  showSummary?: boolean
  summaryLabel?: string
  summaryField?: string
  summaryText?: string
  paginate?: boolean
  orphanRows?: number
  showPageSubtotal?: boolean
  pageSubtotalLabel?: string
  pageSubtotalField?: string
  /** 表头默认字号（列未单独指定时） */
  headerFontSize?: number
  /** 表头默认对齐（列未单独指定时） */
  headerAlign?: 'left' | 'center' | 'right'
  /** 表头默认字重（列未单独指定时） */
  headerFontWeight?: string
  /** 单元格内边距，CSS 值，默认 4px 8px */
  cellPadding?: string
  /** 外边框开关，默认 true */
  showOuterBorder?: boolean
  /** 表体横线开关（含表头下横线），默认 true */
  showRowLines?: boolean
  /** 纵向分隔线开关，默认 true */
  showColumnLines?: boolean
  /** 数据条件样式规则 */
  cellRules?: TableCellRule[]
}

/** 表格数据条件样式：按取值匹配后叠加样式 */
export interface TableCellRule {
  /**
   * 取值字段；不填时取当前单元格所在列的字段。
   * scope='cell' 时只作用于该字段对应列的单元格。
   */
  field?: string
  /** cell：只作用于取值单元格（默认）；row：作用于整行 */
  scope?: 'cell' | 'row'
  op: 'eq' | 'ne' | 'gt' | 'gte' | 'lt' | 'lte' | 'contains' | 'empty' | 'notEmpty'
  value?: string | number
  color?: string
  backgroundColor?: string
  fontWeight?: 'normal' | 'bold'
  fontStyle?: 'normal' | 'italic'
}

export interface QRCodeOptions {
  content?: string
  level?: string
  size?: number
  margin?: number
  darkColor?: string
  lightColor?: string
}

export interface BarcodeOptions {
  content?: string
  format?: string
  displayValue?: boolean
  lineColor?: string
  background?: string
  fontSize?: number
  barWidth?: number
  barHeight?: number
  textPosition?: 'top' | 'bottom'
  textAlign?: 'left' | 'center' | 'right'
  textMargin?: number
  margin?: number
}

export interface ImageOptions {
  src?: string
  url?: string
  content?: string
  objectFit?: 'contain' | 'cover' | 'fill'
  objectPosition?: string
  cropX?: number
  cropY?: number
  cropWidth?: number
  cropHeight?: number
}

// --- 兼容导出 ---

/** @deprecated 使用 HPrintComponent */
export type Component = HPrintComponent

/** @deprecated 使用 HPrintPaper */
export type PaperSize = HPrintPaper

/** @deprecated 使用 HPrintTemplate */
export type Template = HPrintTemplate
