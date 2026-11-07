/**
 * 组件默认值
 *
 * 单一来源维护组件默认配置，
 * addComponent() 和 addComponentAt() 统一从此处取值。
 */

import type { HPrintComponentType } from './types'

/** 组件默认配置 */
export const COMPONENT_DEFAULTS: Record<string, Record<string, any>> = {
  text: {
    content: '文本内容',
    fontSize: 14,
    color: '#000000',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    textAlign: 'left',
    lineHeight: 18,
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    maxLines: 0,
  },
  line: {
    color: '#000000',
    lineWidth: 1,
    lineStyle: 'solid',
    direction: 'horizontal',
  },
  rect: {
    backgroundColor: 'transparent',
    borderColor: '#000000',
    borderWidth: 1,
    borderStyle: 'solid',
    borderRadius: 0,
  },
  ellipse: {
    backgroundColor: 'transparent',
    borderColor: '#000000',
    borderWidth: 1,
    borderStyle: 'solid',
  },
  qrcode: {
    content: '{{qrcode}}',
    level: 'M',
    margin: 1,
    darkColor: '#000000',
    lightColor: '#ffffff',
  },
  barcode: {
    content: '{{barcode}}',
    format: 'CODE128',
    displayValue: true,
    lineColor: '#000000',
    background: '#ffffff',
    fontSize: 12,
    barWidth: 1.5,
    barHeight: 40,
    textPosition: 'bottom',
    textAlign: 'center',
    textMargin: 2,
    margin: 0,
  },
  image: {
    src: '',
    objectFit: 'contain',
    objectPosition: 'center center',
  },
  table: {
    dataSourceField: 'items',
    columns: [
      { field: 'name', title: '商品', width: 90, align: 'left' },
      { field: 'qty', title: '数量', width: 50, align: 'center' },
      { field: 'price', title: '金额', width: 70, align: 'right' },
    ],
    headerHeight: 30,
    rowHeight: 25,
    showHeader: true,
    borderWidth: 1,
    borderColor: '#000000',
    borderStyle: 'solid',
    headerBackgroundColor: '#f5f5f5',
    headerColor: '#000000',
    rowBackgroundColor: '#ffffff',
    alternatingRowBackgroundColor: '#fafafa',
    fontSize: 12,
    fontFamily: 'Arial',
    textAlign: 'left',
    maxRows: 0,
    emptyText: '暂无数据',
    showSummary: false,
    summaryLabel: '合计',
    summaryField: '',
    summaryText: '',
  },
  'page-header': {
    content: '页眉',
    fontSize: 14,
    color: '#000000',
    fontFamily: 'Arial',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 18,
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    maxLines: 1,
  },
  'page-footer': {
    content: '页脚',
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    textAlign: 'center',
    lineHeight: 16,
    whiteSpace: 'pre-wrap',
    overflow: 'hidden',
    maxLines: 1,
  },
  'page-number': {
    content: '第 {page} / {total} 页',
    fontSize: 12,
    color: '#000000',
    fontFamily: 'Arial',
    fontWeight: 'normal',
    textAlign: 'center',
    lineHeight: 16,
    whiteSpace: 'nowrap',
    overflow: 'hidden',
    maxLines: 1,
  },
  watermark: {
    content: '水印',
    fontSize: 36,
    color: '#999999',
    fontFamily: 'Arial',
    fontWeight: 'bold',
    textAlign: 'center',
    lineHeight: 44,
    whiteSpace: 'nowrap',
    overflow: 'visible',
    // 平铺斜向水印：mode: 'tile' | 'center'，rotate 角度，opacity 文字透明度，tileSpacing 平铺间距(px)
    mode: 'tile',
    rotate: -30,
    opacity: 0.25,
    tileSpacing: 120,
  },
  // 小票组件默认值
  'receipt-title': {
    content: '标题',
    fontSize: 20,
    fontWeight: 'bold',
    textAlign: 'center',
  },
  'receipt-text': {
    content: '文本内容',
    fontSize: 14,
    textAlign: 'left',
  },
  'receipt-keyvalue': {
    key: '项目',
    value: '{{value}}',
    keyFontSize: 14,
    valueFontSize: 14,
    fontWeight: 'normal',
  },
  'receipt-divider': {
    char: '-',
  },
  'receipt-total': {
    label: '合计',
    value: '{{total}}',
    labelFontSize: 16,
    valueFontSize: 16,
  },
  'receipt-qrcode': {
    content: '{{qrcode}}',
    moduleSize: 4,
  },
  'receipt-barcode': {
    content: '{{barcode}}',
    barcodeType: 'code128',
  },
  'receipt-feed': {
    lines: 3,
  },
  'receipt-cut': {
    type: 'full',
  },
}

/** 获取组件默认选项 */
/**
 * 组件默认层级：
 * 水印默认 1（垫底层），其余组件不预设（渲染时按顺序取 index + 2，始终在水印之上）。
 */
export function getDefaultZIndex(type: HPrintComponentType): number | undefined {
  return type === 'watermark' ? 1 : undefined
}

export function getDefaultOptions(type: HPrintComponentType): Record<string, any> {
  return { ...(COMPONENT_DEFAULTS[type] || {}) }
}

/** 获取组件默认尺寸 */
export function getDefaultSize(type: HPrintComponentType): { width: number; height: number } {
  switch (type) {
    case 'line':
      return { width: 80, height: 2 }
    case 'ellipse':
      return { width: 40, height: 30 }
    case 'qrcode':
      return { width: 30, height: 30 }
    case 'barcode':
      return { width: 50, height: 18 }
    case 'image':
      return { width: 40, height: 30 }
    case 'table':
      return { width: 80, height: 40 }
    case 'page-header':
      return { width: 160, height: 12 }
    case 'page-footer':
      return { width: 160, height: 10 }
    case 'page-number':
      return { width: 50, height: 8 }
    case 'watermark':
      return { width: 120, height: 40 }
    case 'receipt-title':
      return { width: 76, height: 10 }
    case 'receipt-text':
      return { width: 76, height: 6 }
    case 'receipt-keyvalue':
      return { width: 76, height: 6 }
    case 'receipt-divider':
      return { width: 76, height: 4 }
    case 'receipt-total':
      return { width: 76, height: 8 }
    case 'receipt-qrcode':
      return { width: 30, height: 30 }
    case 'receipt-barcode':
      return { width: 50, height: 15 }
    case 'receipt-feed':
      return { width: 76, height: 2 }
    case 'receipt-cut':
      return { width: 76, height: 2 }
    default:
      return { width: 50, height: 20 }
  }
}

/** 获取组件默认位置（小票贴顶打印，y 从 2mm 开始） */
export function getDefaultPosition(componentCount: number): { x: number; y: number } {
  return { x: 2, y: 2 + componentCount * 12 }
}
