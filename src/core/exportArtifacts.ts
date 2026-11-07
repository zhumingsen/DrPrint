import type { HPrintTemplate } from './types'
import {
  renderTemplateToPages,
  type VisualRenderPagesResult,
  type VisualRenderResult,
} from './visualRenderer'

export interface HPrintHtmlExportResult extends VisualRenderResult {
  filename: string
  exportedAt: string
  totalPages: number
  pages: VisualRenderPagesResult['pages']
}

export interface HPrintPreviewImageExportResult extends VisualRenderResult {
  svg: string
  filename: string
  exportedAt: string
  totalPages: number
}

export interface HPrintHtmlExportOptions {
  filename?: string
  data?: Record<string, unknown>
}

export function buildPrintReadyHtmlExport(
  template: HPrintTemplate,
  options: HPrintHtmlExportOptions = {},
): HPrintHtmlExportResult {
  const rendered = renderTemplateToPages(template, options.data || {})
  const exportedAt = new Date().toISOString()
  const filename = normalizeExportFilename(options.filename || template.name || 'hprint-template')
  const html = buildPagedHtml(rendered)

  return {
    ...rendered,
    html,
    filename,
    exportedAt,
  }
}

export function downloadPrintReadyHtml(exportResult: HPrintHtmlExportResult): void {
  downloadTextFile(
    exportResult.html,
    ensureExtension(exportResult.filename, '.html'),
    'text/html;charset=utf-8',
  )
}

export function openPrintReadyHtml(exportResult: HPrintHtmlExportResult): boolean {
  const win = window.open('', '_blank')
  if (!win) return false

  win.document.open()
  win.document.write(exportResult.html)
  win.document.close()
  return true
}

function normalizeExportFilename(filename: string): string {
  const normalized = filename
    .trim()
    .replace(/[\\/:*?"<>|]+/g, '-')
    .replace(/\s+/g, '-')

  return normalized || 'hprint-template'
}

export function buildPreviewSvgExport(
  template: HPrintTemplate,
  options: HPrintHtmlExportOptions = {},
): HPrintPreviewImageExportResult {
  const rendered = renderTemplateToPages(template, options.data || {})
  const filename = normalizeExportFilename(options.filename || template.name || 'hprint-preview')
  const style = extractTagContent(rendered.pages[0]?.html || '', 'style')
  const gapPx = rendered.totalPages > 1 ? 16 : 0
  const svgHeight = rendered.heightPx * rendered.totalPages + gapPx * Math.max(0, rendered.totalPages - 1)
  const pages = rendered.pages.map((page, index) => {
    const body = extractTagContent(page.html, 'body')
    const y = index * (rendered.heightPx + gapPx)
    return `<foreignObject x="0" y="${y}" width="${rendered.widthPx}" height="${rendered.heightPx}">
    <div xmlns="http://www.w3.org/1999/xhtml">
      <style>${style}</style>
      ${body}
    </div>
  </foreignObject>`
  }).join('\n')
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${rendered.widthPx}" height="${svgHeight}" viewBox="0 0 ${rendered.widthPx} ${svgHeight}">
  <rect width="100%" height="100%" fill="#f3f4f6"/>
  ${pages}
</svg>`

  return {
    html: buildPagedHtml(rendered),
    widthPx: rendered.widthPx,
    heightPx: svgHeight,
    widthMm: rendered.widthMm,
    heightMm: rendered.heightMm,
    orientation: rendered.orientation,
    svg,
    filename,
    exportedAt: new Date().toISOString(),
    totalPages: rendered.totalPages,
  }
}

export function downloadPreviewSvg(exportResult: HPrintPreviewImageExportResult): void {
  downloadTextFile(
    exportResult.svg,
    ensureExtension(exportResult.filename, '.svg'),
    'image/svg+xml;charset=utf-8',
  )
}

export async function downloadPreviewPng(exportResult: HPrintPreviewImageExportResult): Promise<void> {
  const blob = new Blob([exportResult.svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)

  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = Math.ceil(exportResult.widthPx)
    canvas.height = Math.ceil(exportResult.heightPx)
    const context = canvas.getContext('2d')
    if (!context) throw new Error('无法创建 Canvas 上下文')
    context.fillStyle = '#ffffff'
    context.fillRect(0, 0, canvas.width, canvas.height)
    context.drawImage(image, 0, 0)
    const pngUrl = canvas.toDataURL('image/png')
    const anchor = document.createElement('a')
    anchor.href = pngUrl
    anchor.download = ensureExtension(exportResult.filename, '.png')
    anchor.click()
  } finally {
    URL.revokeObjectURL(url)
  }
}

function extractTagContent(html: string, tagName: string): string {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1] || ''
}

export function buildPagedHtml(rendered: VisualRenderPagesResult): string {
  const style = extractTagContent(rendered.pages[0]?.html || '', 'style')
  const pageBodies = rendered.pages.map((page, index) => {
    const body = extractTagContent(page.html, 'body')
    return `<section class="hprint-export-page" data-page="${index + 1}">
${body}
</section>`
  }).join('\n')

  return `<!DOCTYPE html>
<html>
<head>
<meta charset="UTF-8">
<style>
${style}
html, body {
  width: auto;
  height: auto;
}
body {
  margin: 0;
  padding: 0;
  background: #f3f4f6;
}
.hprint-export-page {
  width: ${rendered.widthPx}px;
  height: ${rendered.heightPx}px;
  margin: 0 auto 16px;
  background: #ffffff;
  page-break-after: always;
  break-after: page;
}
.hprint-export-page:last-child {
  margin-bottom: 0;
  page-break-after: auto;
  break-after: auto;
}
@media print {
  body {
    background: #ffffff;
  }
  .hprint-export-page {
    margin: 0;
  }
}
</style>
</head>
<body>
${pageBodies}
</body>
</html>`
}

function ensureExtension(filename: string, extension: string): string {
  return filename.endsWith(extension) ? filename : `${filename}${extension}`
}

function downloadTextFile(content: string, filename: string, type: string): void {
  const blob = new Blob([content], { type })
  const url = URL.createObjectURL(blob)
  const anchor = document.createElement('a')
  anchor.href = url
  anchor.download = filename
  anchor.click()
  URL.revokeObjectURL(url)
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('预览图片生成失败，请改用 SVG 或 HTML 调试产物'))
    image.src = src
  })
}
