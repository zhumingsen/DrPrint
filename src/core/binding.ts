/**
 * 字段绑定逻辑
 *
 * 支持 {{field}} 和 {{user.name}} 语法。
 * 统一供 Text.vue 和 renderToHtml 使用。
 */

/** 解析嵌套路径取值 */
export function getNestedValue(obj: Record<string, any>, path: string): any {
  const parts = path.split('.')
  let current = obj
  for (const part of parts) {
    if (current === null || current === undefined) return undefined
    current = current[part]
  }
  return current
}

/**
 * 将模板字符串中的 {{field}} 替换为实际值
 *
 * 取不到值时默认替换为空字符串：打印/预览要贴合真实出纸效果，
 * 不能把 item.materialName 这类内部字段名直接印在纸上。
 *
 * @param template 含 {{field}} 的模板串
 * @param data 单据数据
 * @param options.keepFieldNameWhenMissing 取不到值时是否保留字段名（设计器里便于识别绑定了什么）
 * @returns 替换后的字符串
 */
export function bindTemplate(
  template: string,
  data: Record<string, any>,
  options: { keepFieldNameWhenMissing?: boolean } = {},
): string {
  const keepFieldName = options.keepFieldNameWhenMissing === true
  let result = template
  while (result.includes('{{')) {
    const start = result.indexOf('{{')
    const end = result.indexOf('}}', start)
    if (end === -1) break
    const field = result.slice(start + 2, end).trim()
    const resolved = getNestedValue(data, field)
    const value = resolved ?? (keepFieldName ? field : '')
    result = result.slice(0, start) + String(value) + result.slice(end + 2)
  }
  return result
}
