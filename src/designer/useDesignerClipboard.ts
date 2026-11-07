import { computed, ref } from 'vue'
import type { HPrintComponent } from '../core/types'

const PASTE_OFFSET_MM = 5

function cloneComponent(component: HPrintComponent): HPrintComponent {
  return JSON.parse(JSON.stringify(component))
}

export function useDesignerClipboard() {
  const copiedComponents = ref<HPrintComponent[]>([])
  const pasteCount = ref(0)
  const canPaste = computed(() => copiedComponents.value.length > 0)

  function copy(components: HPrintComponent[]) {
    copiedComponents.value = components.map(cloneComponent)
    pasteCount.value = 0
  }

  function paste(generateId: () => string): HPrintComponent[] {
    if (!copiedComponents.value.length) return []
    pasteCount.value += 1
    const offset = PASTE_OFFSET_MM * pasteCount.value
    return copiedComponents.value.map((component) => ({
      ...cloneComponent(component),
      id: generateId(),
      x: component.x + offset,
      y: component.y + offset,
    }))
  }

  return {
    canPaste,
    copy,
    paste,
  }
}
