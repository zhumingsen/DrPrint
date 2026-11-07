/**
 * 描述：把模板页 HTML 转成 1bit 位图，供 raw-raster / TSPL / ESC/POS 出纸
 */

export interface MonoRasterPage {
  width: number
  height: number
  /** 1bit 打包，行宽按 8 点对齐；1=黑点 */
  bytesBase64: string
}

function extractTagContent(html: string, tagName: string): string {
  const match = html.match(new RegExp(`<${tagName}[^>]*>([\\s\\S]*?)<\\/${tagName}>`, 'i'))
  return match?.[1] || ''
}

function loadImage(url: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new Error('预览图加载失败'))
    image.src = url
  })
}

/**
 * 描述: HTML 页面渲染为 Canvas（via SVG foreignObject）
 */
async function htmlToCanvas(html: string, widthPx: number, heightPx: number): Promise<HTMLCanvasElement> {
  const width = Math.max(1, Math.ceil(widthPx))
  const height = Math.max(1, Math.ceil(heightPx))
  const style = extractTagContent(html, 'style')
  const body = extractTagContent(html, 'body') || html
  const svg = `<?xml version="1.0" encoding="UTF-8"?>
<svg xmlns="http://www.w3.org/2000/svg" width="${width}" height="${height}" viewBox="0 0 ${width} ${height}">
  <foreignObject x="0" y="0" width="${width}" height="${height}">
    <div xmlns="http://www.w3.org/1999/xhtml" style="width:${width}px;height:${height}px;background:#fff;overflow:hidden;">
      <style>${style}</style>
      ${body}
    </div>
  </foreignObject>
</svg>`
  const blob = new Blob([svg], { type: 'image/svg+xml;charset=utf-8' })
  const url = URL.createObjectURL(blob)
  try {
    const image = await loadImage(url)
    const canvas = document.createElement('canvas')
    canvas.width = width
    canvas.height = height
    const ctx = canvas.getContext('2d')
    if (!ctx) throw new Error('无法创建 Canvas 上下文')
    ctx.fillStyle = '#ffffff'
    ctx.fillRect(0, 0, width, height)
    ctx.drawImage(image, 0, 0, width, height)
    return canvas
  } finally {
    URL.revokeObjectURL(url)
  }
}

/**
 * 描述: Canvas 转 1bit 打包位图（阈值 160，以下变黑）
 */
export function canvasToMonoRaster(canvas: HTMLCanvasElement, threshold = 160): MonoRasterPage {
  const width = canvas.width
  const height = canvas.height
  const ctx = canvas.getContext('2d')
  if (!ctx) throw new Error('无法读取 Canvas 像素')
  const image = ctx.getImageData(0, 0, width, height)
  const widthBytes = Math.ceil(width / 8)
  const bytes = new Uint8Array(widthBytes * height)

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const i = (y * width + x) * 4
      const r = image.data[i]
      const g = image.data[i + 1]
      const b = image.data[i + 2]
      const a = image.data[i + 3]
      const gray = a < 16 ? 255 : 0.299 * r + 0.587 * g + 0.114 * b
      if (gray < threshold) {
        const byteIndex = y * widthBytes + (x >> 3)
        bytes[byteIndex] |= 0x80 >> (x & 7)
      }
    }
  }

  let binary = ''
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i])
  return {
    width,
    height,
    bytesBase64: btoa(binary),
  }
}

/**
 * 描述: 单页 HTML → 单色位图
 */
export async function htmlToMonoRaster(
  html: string,
  widthPx: number,
  heightPx: number,
): Promise<MonoRasterPage> {
  const canvas = await htmlToCanvas(html, widthPx, heightPx)
  return canvasToMonoRaster(canvas)
}
