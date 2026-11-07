import * as QRCode from 'qrcode'
import type { QRCodeErrorCorrectionLevel } from 'qrcode'
import JsBarcode from 'jsbarcode'
import { bindTemplate } from './binding'

export interface CodeAssetOptions {
  content?: string
  level?: string
  errorCorrectionLevel?: string
  format?: string
  barcodeType?: string
  displayValue?: boolean
  lineColor?: string
  background?: string
  fontSize?: number
  barWidth?: number
  barHeight?: number
  darkColor?: string
  lightColor?: string
  margin?: number
  textPosition?: string
  textAlign?: string
  textMargin?: number
}

export function escapeHtml(value: unknown): string {
  return String(value ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;')
}

export function escapeAttr(value: unknown): string {
  return escapeHtml(value).replace(/`/g, '&#96;')
}

export function bindCodeContent(
  options: CodeAssetOptions | undefined,
  data: Record<string, unknown>,
  fallback: string,
): string {
  const content = options?.content ?? fallback
  return bindTemplate(String(content), data as Record<string, any>)
}

export function renderPlaceholderSvg(label: string): string {
  const safeLabel = escapeHtml(label)
  return `<div class="hprint-code-placeholder">${safeLabel}</div>`
}

export function renderQrSvg(content: string, options: CodeAssetOptions = {}): string {
  if (!content) return renderPlaceholderSvg('QR')

  try {
    const qr = QRCode.create(content, {
      errorCorrectionLevel: (options.errorCorrectionLevel || options.level || 'M') as QRCodeErrorCorrectionLevel,
    })
    const size = qr.modules.size
    const cells = qr.modules.data
    const margin = Math.max(0, Number(options.margin ?? 1))
    const viewSize = size + margin * 2
    const darkColor = escapeAttr(options.darkColor || options.lineColor || '#000000')
    const lightColor = escapeAttr(options.lightColor || options.background || '#ffffff')
    const rects: string[] = []

    for (let y = 0; y < size; y += 1) {
      for (let x = 0; x < size; x += 1) {
        if (cells[y * size + x]) {
          rects.push(`<rect x="${x + margin}" y="${y + margin}" width="1" height="1"/>`)
        }
      }
    }

    return `<svg class="hprint-qrcode" viewBox="0 0 ${viewSize} ${viewSize}" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="${escapeAttr(content)}"><rect width="${viewSize}" height="${viewSize}" fill="${lightColor}"/><g fill="${darkColor}">${rects.join('')}</g></svg>`
  } catch {
    return renderPlaceholderSvg(content)
  }
}

export function renderBarcodeSvg(content: string, options: CodeAssetOptions = {}): string {
  if (!content) return renderPlaceholderSvg('BARCODE')
  if (typeof document === 'undefined') return renderPlaceholderSvg(content)

  try {
    const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg')
    JsBarcode(svg, content, {
      format: options.format || options.barcodeType || 'CODE128',
      displayValue: options.displayValue ?? true,
      lineColor: options.lineColor || '#000000',
      background: options.background || '#ffffff',
      fontSize: options.fontSize || 12,
      width: options.barWidth || 1.5,
      height: options.barHeight || 40,
      margin: options.margin ?? 0,
      textPosition: options.textPosition || 'bottom',
      textAlign: options.textAlign || 'center',
      textMargin: options.textMargin ?? 2,
    })
    svg.classList.add('hprint-barcode')
    svg.setAttribute('preserveAspectRatio', 'xMidYMid meet')
    return svg.outerHTML
  } catch {
    return renderPlaceholderSvg(content)
  }
}
