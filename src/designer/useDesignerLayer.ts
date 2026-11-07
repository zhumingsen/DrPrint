import type { HPrintComponent } from '../core/types'

export type DesignerLayerAction = 'bring-front' | 'send-back' | 'move-forward' | 'move-backward'

function cloneComponents(components: HPrintComponent[]): HPrintComponent[] {
  return JSON.parse(JSON.stringify(components))
}

function normalizeZIndex(components: HPrintComponent[]) {
  return components.map((component, index) => ({
    ...component,
    zIndex: index,
  }))
}

export function arrangeComponentLayer(
  components: HPrintComponent[],
  selectedIds: string[],
  action: DesignerLayerAction,
): HPrintComponent[] {
  if (!selectedIds.length) return components
  const selected = new Set(selectedIds)
  const next = cloneComponents(components)

  if (action === 'bring-front') {
    return normalizeZIndex([
      ...next.filter(component => !selected.has(component.id)),
      ...next.filter(component => selected.has(component.id)),
    ])
  }

  if (action === 'send-back') {
    return normalizeZIndex([
      ...next.filter(component => selected.has(component.id)),
      ...next.filter(component => !selected.has(component.id)),
    ])
  }

  if (action === 'move-forward') {
    for (let index = next.length - 2; index >= 0; index -= 1) {
      if (selected.has(next[index].id) && !selected.has(next[index + 1].id)) {
        const current = next[index]
        next[index] = next[index + 1]
        next[index + 1] = current
      }
    }
    return normalizeZIndex(next)
  }

  if (action === 'move-backward') {
    for (let index = 1; index < next.length; index += 1) {
      if (selected.has(next[index].id) && !selected.has(next[index - 1].id)) {
        const current = next[index]
        next[index] = next[index - 1]
        next[index - 1] = current
      }
    }
    return normalizeZIndex(next)
  }

  return components
}
