/**
 * 模板校验
 *
 * 校验模板 JSON 结构是否符合协议要求。
 */

import { SCHEMA_VERSION } from './types'

export interface ValidationError {
  path: string
  message: string
}

/** 校验模板 */
export function validateTemplate(template: any): ValidationError[] {
  const errors: ValidationError[] = []

  if (!template || typeof template !== 'object') {
    errors.push({ path: '', message: '模板必须是一个对象' })
    return errors
  }

  // schemaVersion
  if (!template.schemaVersion) {
    errors.push({ path: 'schemaVersion', message: '缺少 schemaVersion 字段' })
  } else if (template.schemaVersion !== SCHEMA_VERSION) {
    errors.push({ path: 'schemaVersion', message: `schemaVersion 应为 "${SCHEMA_VERSION}"，当前为 "${template.schemaVersion}"` })
  }

  // paper
  if (!template.paper) {
    errors.push({ path: 'paper', message: '缺少 paper 字段' })
  } else {
    if (typeof template.paper.width !== 'number' || template.paper.width <= 0) {
      errors.push({ path: 'paper.width', message: '纸张宽度必须为正数' })
    }
    if (typeof template.paper.height !== 'number' || template.paper.height <= 0) {
      errors.push({ path: 'paper.height', message: '纸张高度必须为正数' })
    }
  }

  // components
  if (!Array.isArray(template.components)) {
    errors.push({ path: 'components', message: 'components 必须是一个数组' })
  } else {
    template.components.forEach((comp: any, index: number) => {
      const prefix = `components[${index}]`
      if (!comp.id) errors.push({ path: `${prefix}.id`, message: '缺少 id' })
      if (!comp.type) errors.push({ path: `${prefix}.type`, message: '缺少 type' })
      if (typeof comp.x !== 'number') errors.push({ path: `${prefix}.x`, message: 'x 必须为数字' })
      if (typeof comp.y !== 'number') errors.push({ path: `${prefix}.y`, message: 'y 必须为数字' })
      if (typeof comp.width !== 'number' || comp.width <= 0) errors.push({ path: `${prefix}.width`, message: 'width 必须为正数' })
      if (typeof comp.height !== 'number' || comp.height <= 0) errors.push({ path: `${prefix}.height`, message: 'height 必须为正数' })
    })
  }

  return errors
}

/** 校验模板是否有效 */
export function isValidTemplate(template: any): boolean {
  return validateTemplate(template).length === 0
}
