/**
 * 复制文本到剪贴板
 *
 * 页面跑在内网 http（如 http://192.168.x.x）时不属于安全上下文，
 * navigator.clipboard 不可用，这里自动退回 textarea + execCommand，
 * 保证内网环境下「点击复制」也能正常工作。
 *
 * @param text 待复制文本
 * @returns 是否复制成功
 */
export async function copyText(text: string): Promise<boolean> {
  if (window.isSecureContext && navigator.clipboard) {
    try {
      await navigator.clipboard.writeText(text)
      return true
    } catch {
      // 权限被拒或浏览器限制时继续走兜底
    }
  }
  return legacyCopy(text)
}

/**
 * 兼容方案：临时 textarea + execCommand('copy')
 *
 * @param text 待复制文本
 * @returns 是否复制成功
 */
function legacyCopy(text: string): boolean {
  let textarea: HTMLTextAreaElement | null = null
  try {
    textarea = document.createElement('textarea')
    textarea.value = text
    textarea.setAttribute('readonly', '')
    textarea.style.position = 'fixed'
    textarea.style.top = '-9999px'
    textarea.style.left = '-9999px'
    textarea.style.opacity = '0'
    document.body.appendChild(textarea)
    textarea.focus()
    textarea.select()
    textarea.setSelectionRange(0, text.length)
    return document.execCommand('copy')
  } catch {
    return false
  } finally {
    if (textarea && textarea.parentNode) {
      textarea.parentNode.removeChild(textarea)
    }
  }
}
