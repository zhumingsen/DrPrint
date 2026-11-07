import type { HPrintComponent } from '../core/types'

export type DesignerArrangeAction =
  | 'align-left'
  | 'align-right'
  | 'align-top'
  | 'align-bottom'
  | 'align-horizontal-center'
  | 'align-vertical-center'
  | 'distribute-horizontal'
  | 'distribute-vertical'

function cloneComponents(components: HPrintComponent[]): HPrintComponent[] {
  return JSON.parse(JSON.stringify(components))
}

function selectedComponents(components: HPrintComponent[], selectedIds: string[]) {
  return components.filter(component => selectedIds.includes(component.id))
}

export function arrangeComponents(
  components: HPrintComponent[],
  selectedIds: string[],
  action: DesignerArrangeAction,
): HPrintComponent[] {
  const next = cloneComponents(components)
  const selected = selectedComponents(next, selectedIds)
  if (selected.length < 2) return components

  const minX = Math.min(...selected.map(component => component.x))
  const minY = Math.min(...selected.map(component => component.y))
  const maxRight = Math.max(...selected.map(component => component.x + component.width))
  const maxBottom = Math.max(...selected.map(component => component.y + component.height))
  const centerX = minX + (maxRight - minX) / 2
  const centerY = minY + (maxBottom - minY) / 2

  if (action === 'align-left') {
    selected.forEach(component => { component.x = minX })
  } else if (action === 'align-right') {
    selected.forEach(component => { component.x = maxRight - component.width })
  } else if (action === 'align-top') {
    selected.forEach(component => { component.y = minY })
  } else if (action === 'align-bottom') {
    selected.forEach(component => { component.y = maxBottom - component.height })
  } else if (action === 'align-horizontal-center') {
    selected.forEach(component => { component.x = centerX - component.width / 2 })
  } else if (action === 'align-vertical-center') {
    selected.forEach(component => { component.y = centerY - component.height / 2 })
  } else if (action === 'distribute-horizontal') {
    distributeHorizontal(selected)
  } else if (action === 'distribute-vertical') {
    distributeVertical(selected)
  }

  return next
}

function distributeHorizontal(selected: HPrintComponent[]) {
  if (selected.length < 3) return
  const sorted = [...selected].sort((a, b) => a.x - b.x)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalWidth = sorted.reduce((sum, component) => sum + component.width, 0)
  const available = (last.x + last.width) - first.x - totalWidth
  const gap = available / (sorted.length - 1)
  let cursor = first.x
  for (const component of sorted) {
    component.x = cursor
    cursor += component.width + gap
  }
}

function distributeVertical(selected: HPrintComponent[]) {
  if (selected.length < 3) return
  const sorted = [...selected].sort((a, b) => a.y - b.y)
  const first = sorted[0]
  const last = sorted[sorted.length - 1]
  const totalHeight = sorted.reduce((sum, component) => sum + component.height, 0)
  const available = (last.y + last.height) - first.y - totalHeight
  const gap = available / (sorted.length - 1)
  let cursor = first.y
  for (const component of sorted) {
    component.y = cursor
    cursor += component.height + gap
  }
}

/** 单个组件相对纸张的对齐方式 */
export type DesignerPageAlignAction =
  | 'page-left'
  | 'page-horizontal-center'
  | 'page-right'
  | 'page-top'
  | 'page-vertical-center'
  | 'page-bottom'

/**
 * 相对纸张对齐：单个组件即可用；多选时每个组件各自独立对齐到纸张。
 * 依赖纸张尺寸，因此通过参数传入（mm，与组件坐标单位一致）。
 */
export function alignComponentsToPage(
  components: HPrintComponent[],
  selectedIds: string[],
  action: DesignerPageAlignAction,
  paperWidthMm: number,
  paperHeightMm: number,
): HPrintComponent[] {
  const next = cloneComponents(components)
  const selected = selectedComponents(next, selectedIds)
  if (!selected.length) return components

  const round = (value: number) => Math.round(value * 10) / 10

  if (action === 'page-left') {
    selected.forEach(component => { component.x = 0 })
  } else if (action === 'page-horizontal-center') {
    selected.forEach(component => {
      component.x = round((paperWidthMm - component.width) / 2)
    })
  } else if (action === 'page-right') {
    selected.forEach(component => {
      component.x = round(paperWidthMm - component.width)
    })
  } else if (action === 'page-top') {
    selected.forEach(component => { component.y = 0 })
  } else if (action === 'page-vertical-center') {
    selected.forEach(component => {
      component.y = round((paperHeightMm - component.height) / 2)
    })
  } else if (action === 'page-bottom') {
    selected.forEach(component => {
      component.y = round(paperHeightMm - component.height)
    })
  }

  return next
}
