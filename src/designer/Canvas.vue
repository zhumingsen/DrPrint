<template>
  <section class="canvas-area">
    <div class="canvas-shell" :class="{ 'with-rulers': showRulers }">
      <div v-if="showRulers" class="ruler-corner"></div>
      <div v-if="showRulers" class="ruler ruler-top" :style="topRulerStyle"></div>
      <div v-if="showRulers" class="ruler ruler-left" :style="leftRulerStyle"></div>
      <div
        ref="canvasRef"
        class="canvas"
        :style="canvasStyle"
        @dragover.prevent
        @drop="handleDrop"
        @mousedown.self="startMarqueeSelect"
      >
        <ComponentRenderer
          v-for="comp in sortedComponents"
          :key="comp.id"
          :component="comp"
          :data="previewData"
          :is-selected="selectedIds.includes(comp.id)"
          :mm-to-px="activeMmToPx"
          @start-drag="startDragComponent"
          @start-resize="startResizeComponent"
        />
        <div
          v-for="guide in activeGuides"
          :key="`${guide.direction}-${guide.position}`"
          class="snap-guide"
          :class="guide.direction"
          :style="guideStyle(guide)"
        ></div>
        <div
          v-if="marquee.active"
          class="selection-marquee"
          :style="marqueeStyle"
        ></div>
        <div
          v-if="selectedIds.length >= 2 && multiSelectBox"
          class="multi-select-box"
          :style="multiSelectBoxStyle"
          @mousedown.self="startMultiScale"
        >
          <div class="multi-scale-handle se" @mousedown.stop="startMultiScale"></div>
        </div>
      </div>
    </div>
  </section>
</template>

<script setup lang="ts">
import { ref, computed, onBeforeUnmount } from 'vue'
import ComponentRenderer from '../components/ComponentRenderer.vue'
import type { HPrintComponent } from '../core/types'

const props = defineProps<{
  paperWidth: number
  paperHeight: number
  components: HPrintComponent[]
  selectedId: string | null
  selectedIds: string[]
  previewData: Record<string, any>
  zoom: number
  showGrid: boolean
  showRulers: boolean
  snapToGrid: boolean
  showGuides: boolean
}>()

const emit = defineEmits<{
  (e: 'select', id: string | null, additive?: boolean): void
  (e: 'select-many', ids: string[]): void
  (e: 'edit-start'): void
  (e: 'edit-end'): void
  (e: 'update-position', id: string, x: number, y: number): void
  (e: 'update-size', id: string, width: number, height: number): void
  (e: 'drop-component', type: string, x: number, y: number): void
  (e: 'drop-field-component', fieldKey: string, fieldLabel: string, x: number, y: number): void
  (e: 'batch-scale', ids: string[], scaleX: number, scaleY: number, baseline?: BatchScaleBaseline): void
}>()

interface BatchScaleBaseline {
  boxX: number
  boxY: number
  components: Array<{ id: string; x: number; y: number; width: number; height: number }>
}

const baseMmToPx = 3.7795
const gridMm = 5
const canvasRef = ref<HTMLElement>()
const activeMmToPx = computed(() => baseMmToPx * props.zoom)

const canvasStyle = computed(() => ({
  width: `${props.paperWidth * activeMmToPx.value}px`,
  height: `${props.paperHeight * activeMmToPx.value}px`,
  backgroundSize: props.showGrid ? `${gridMm * activeMmToPx.value}px ${gridMm * activeMmToPx.value}px` : undefined,
  backgroundImage: props.showGrid
    ? 'linear-gradient(to right, rgba(64, 158, 255, 0.14) 1px, transparent 1px), linear-gradient(to bottom, rgba(64, 158, 255, 0.14) 1px, transparent 1px)'
    : undefined,
}))

/**
 * 画布渲染顺序按有效 zIndex 排序（与 Visual Renderer 打印顺序一致）：
 * - 显式 zIndex 优先；未设置时水印默认 1（垫底层），其余组件按数组序号 +2 递增。
 * - 层级从 0 起算，负值会被画布背景盖住导致不可见。
 * - 这样层级设定在设计器里即时生效，水印也不会挡住其他组件的选择和编辑。
 */
const sortedComponents = computed(() => props.components
  .map((comp, index) => ({
    comp,
    index,
    z: Math.max(0, comp.zIndex ?? (comp.type === 'watermark' ? 1 : index + 2)),
  }))
  .sort((a, b) => a.z - b.z || a.index - b.index)
  .map((item) => item.comp))

const topRulerStyle = computed(() => ({
  width: `${props.paperWidth * activeMmToPx.value}px`,
  backgroundSize: `${10 * activeMmToPx.value}px 100%`,
}))

const leftRulerStyle = computed(() => ({
  height: `${props.paperHeight * activeMmToPx.value}px`,
  backgroundSize: `100% ${10 * activeMmToPx.value}px`,
}))

const activeGuides = ref<Array<{ direction: 'vertical' | 'horizontal'; position: number; color?: string }>>([])
const snapThresholdMm = 2

const marquee = ref({
  active: false,
  startX: 0,
  startY: 0,
  currentX: 0,
  currentY: 0,
})

const marqueeStyle = computed(() => {
  const left = Math.min(marquee.value.startX, marquee.value.currentX)
  const top = Math.min(marquee.value.startY, marquee.value.currentY)
  const width = Math.abs(marquee.value.currentX - marquee.value.startX)
  const height = Math.abs(marquee.value.currentY - marquee.value.startY)
  return {
    left: `${left}px`,
    top: `${top}px`,
    width: `${width}px`,
    height: `${height}px`,
  }
})

function handleDrop(e: DragEvent) {
  const rect = (e.target as HTMLElement).getBoundingClientRect()
  const x = snapMm((e.clientX - rect.left) / activeMmToPx.value)
  const y = snapMm((e.clientY - rect.top) / activeMmToPx.value)

  const type = e.dataTransfer?.getData('component-type')
  if (type) {
    emit('drop-component', type, x, y)
    return
  }

  const fieldKey = e.dataTransfer?.getData('field-key')
  const fieldLabel = e.dataTransfer?.getData('field-label')
  if (fieldKey) {
    emit('drop-field-component', fieldKey, fieldLabel || fieldKey, x, y)
  }
}

// === 拖拽移动 ===
const isDragging = ref(false)
const dragOffset = ref({ x: 0, y: 0 })
const dragComponentId = ref<string | null>(null)
const dragStartPointer = ref({ x: 0, y: 0 })
const dragStartComponents = ref<Array<{ id: string; x: number; y: number }>>([])

function snapMm(value: number) {
  if (!props.snapToGrid) return Math.round(value)
  return Math.round(value / gridMm) * gridMm
}

function setGuides(x?: number, y?: number) {
  if (!props.showGuides) {
    activeGuides.value = []
    return
  }
  const guides: Array<{ direction: 'vertical' | 'horizontal'; position: number }> = []
  if (typeof x === 'number') guides.push({ direction: 'vertical', position: x })
  if (typeof y === 'number') guides.push({ direction: 'horizontal', position: y })
  activeGuides.value = guides
}

function clearGuides() {
  activeGuides.value = []
}

function getSnapPoints(excludeIds: string[]) {
  const points: { vertical: number[]; horizontal: number[] } = { vertical: [], horizontal: [] }
  for (const comp of props.components) {
    if (excludeIds.includes(comp.id)) continue
    points.vertical.push(comp.x, comp.x + comp.width / 2, comp.x + comp.width)
    points.horizontal.push(comp.y, comp.y + comp.height / 2, comp.y + comp.height)
  }
  points.vertical.push(0, props.paperWidth)
  points.horizontal.push(0, props.paperHeight)
  return points
}

function findSnap(value: number, targets: number[]): { snapped: number; guide: number | null } {
  let best = value
  let guide: number | null = null
  let bestDist = snapThresholdMm
  for (const t of targets) {
    const dist = Math.abs(value - t)
    if (dist < bestDist) {
      bestDist = dist
      best = t
      guide = t
    }
  }
  return { snapped: best, guide }
}

function guideStyle(guide: { direction: 'vertical' | 'horizontal'; position: number }) {
  if (guide.direction === 'vertical') {
    return { left: `${guide.position * activeMmToPx.value}px` }
  }
  return { top: `${guide.position * activeMmToPx.value}px` }
}

function startDragComponent(e: MouseEvent, compId: string) {
  e.preventDefault()
  e.stopPropagation()

  if (e.shiftKey) {
    emit('select', compId, true)
    return
  }

  const comp = props.components.find(c => c.id === compId)
  if (comp?.locked) return

  isDragging.value = true
  dragComponentId.value = compId
  const dragIds = props.selectedIds.includes(compId) ? props.selectedIds : [compId]
  if (!props.selectedIds.includes(compId)) {
    emit('select', compId)
  }
  emit('edit-start')

  const target = e.currentTarget as HTMLElement
  const rect = target.getBoundingClientRect()
  dragOffset.value = { x: e.clientX - rect.left, y: e.clientY - rect.top }
  dragStartPointer.value = { x: e.clientX, y: e.clientY }
  dragStartComponents.value = props.components
    .filter(c => dragIds.includes(c.id) && !c.locked)
    .map(c => ({ id: c.id, x: c.x, y: c.y }))

  document.addEventListener('mousemove', onDragMove)
  document.addEventListener('mouseup', onDragEnd)
}

function onDragMove(e: MouseEvent) {
  if (!isDragging.value || !dragComponentId.value) return
  const canvas = canvasRef.value
  if (!canvas) return

  if (dragStartComponents.value.length > 1) {
    const rawDx = (e.clientX - dragStartPointer.value.x) / activeMmToPx.value
    const rawDy = (e.clientY - dragStartPointer.value.y) / activeMmToPx.value
    const first = dragStartComponents.value[0]
    const minX = Math.min(...dragStartComponents.value.map(item => item.x))
    const minY = Math.min(...dragStartComponents.value.map(item => item.y))
    let dx = props.snapToGrid ? snapMm(rawDx) : Math.round(rawDx)
    let dy = props.snapToGrid ? snapMm(rawDy) : Math.round(rawDy)

    if (!props.snapToGrid && props.showGuides) {
      const snapPts = getSnapPoints(dragStartComponents.value.map(d => d.id))
      const snapX = findSnap(first.x + rawDx, snapPts.vertical)
      const snapY = findSnap(first.y + rawDy, snapPts.horizontal)
      dx = snapX.snapped - first.x
      dy = snapY.snapped - first.y
      const guides: Array<{ direction: 'vertical' | 'horizontal'; position: number; color?: string }> = []
      if (snapX.guide !== null) guides.push({ direction: 'vertical', position: snapX.guide })
      if (snapY.guide !== null) guides.push({ direction: 'horizontal', position: snapY.guide })
      activeGuides.value = guides
    }
    dx = Math.max(-minX, dx)
    dy = Math.max(-minY, dy)
    for (const item of dragStartComponents.value) {
      emit('update-position', item.id, item.x + dx, item.y + dy)
    }
    return
  }

  const canvasRect = canvas.getBoundingClientRect()
  const rawX = (e.clientX - canvasRect.left - dragOffset.value.x) / activeMmToPx.value
  const rawY = (e.clientY - canvasRect.top - dragOffset.value.y) / activeMmToPx.value

  let newX = Math.max(0, props.snapToGrid ? snapMm(rawX) : Math.round(rawX))
  let newY = Math.max(0, props.snapToGrid ? snapMm(rawY) : Math.round(rawY))

  if (!props.snapToGrid && props.showGuides) {
    const snapPts = getSnapPoints([dragComponentId.value!])
    const snapX = findSnap(rawX, snapPts.vertical)
    const snapY = findSnap(rawY, snapPts.horizontal)
    newX = Math.max(0, snapX.snapped)
    newY = Math.max(0, snapY.snapped)
    const guides: Array<{ direction: 'vertical' | 'horizontal'; position: number; color?: string }> = []
    if (snapX.guide !== null) guides.push({ direction: 'vertical', position: snapX.guide })
    if (snapY.guide !== null) guides.push({ direction: 'horizontal', position: snapY.guide })
    activeGuides.value = guides
  } else {
    setGuides(newX, newY)
  }
  emit('update-position', dragComponentId.value, newX, newY)
}

function onDragEnd() {
  isDragging.value = false
  dragComponentId.value = null
  dragStartComponents.value = []
  clearGuides()
  emit('edit-end')
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
}

// === 框选 ===
function startMarqueeSelect(e: MouseEvent) {
  const canvas = e.currentTarget as HTMLElement
  const rect = canvas.getBoundingClientRect()
  const x = e.clientX - rect.left
  const y = e.clientY - rect.top
  marquee.value = {
    active: true,
    startX: x,
    startY: y,
    currentX: x,
    currentY: y,
  }
  document.addEventListener('mousemove', onMarqueeMove)
  document.addEventListener('mouseup', onMarqueeEnd)
}

function onMarqueeMove(e: MouseEvent) {
  if (!marquee.value.active) return
  const canvas = canvasRef.value
  if (!canvas) return
  const rect = canvas.getBoundingClientRect()
  marquee.value.currentX = e.clientX - rect.left
  marquee.value.currentY = e.clientY - rect.top
}

function onMarqueeEnd() {
  const left = Math.min(marquee.value.startX, marquee.value.currentX) / activeMmToPx.value
  const top = Math.min(marquee.value.startY, marquee.value.currentY) / activeMmToPx.value
  const right = Math.max(marquee.value.startX, marquee.value.currentX) / activeMmToPx.value
  const bottom = Math.max(marquee.value.startY, marquee.value.currentY) / activeMmToPx.value
  const ids = props.components
    .filter((component) => {
      const componentRight = component.x + component.width
      const componentBottom = component.y + component.height
      return component.x >= left
        && component.y >= top
        && componentRight <= right
        && componentBottom <= bottom
    })
    .map(component => component.id)

  emit('select-many', ids)
  marquee.value.active = false
  document.removeEventListener('mousemove', onMarqueeMove)
  document.removeEventListener('mouseup', onMarqueeEnd)
}

// === 拖拽缩放 ===
const isResizing = ref(false)
const resizeId = ref<string | null>(null)
const resizeDir = ref('')
const resizeStart = ref({ x: 0, y: 0, compX: 0, compY: 0, compW: 0, compH: 0 })

function startResizeComponent(e: MouseEvent, compId: string, direction: string) {
  e.preventDefault()
  e.stopPropagation()

  const comp = props.components.find(c => c.id === compId)
  if (!comp || comp.locked) return

  isResizing.value = true
  resizeId.value = compId
  resizeDir.value = direction
  if (!props.selectedIds.includes(compId)) {
    emit('select', compId)
  }
  emit('edit-start')
  resizeStart.value = {
    x: e.clientX,
    y: e.clientY,
    compX: comp.x,
    compY: comp.y,
    compW: comp.width,
    compH: comp.height,
  }

  document.addEventListener('mousemove', onResizeMove)
  document.addEventListener('mouseup', onResizeEnd)
}

function onResizeMove(e: MouseEvent) {
  if (!isResizing.value || !resizeId.value) return

  const dx = snapMm((e.clientX - resizeStart.value.x) / activeMmToPx.value)
  const dy = snapMm((e.clientY - resizeStart.value.y) / activeMmToPx.value)
  const s = resizeStart.value
  const dir = resizeDir.value

  let newX = s.compX
  let newY = s.compY
  let newW = s.compW
  let newH = s.compH

  // 根据方向计算新的位置和尺寸
  if (dir.includes('e')) {
    newW = Math.max(5, s.compW + dx)
  }
  if (dir.includes('w')) {
    newW = Math.max(5, s.compW - dx)
    newX = s.compX + (s.compW - newW)
  }
  if (dir.includes('s')) {
    newH = Math.max(5, s.compH + dy)
  }
  if (dir.includes('n')) {
    newH = Math.max(5, s.compH - dy)
    newY = s.compY + (s.compH - newH)
  }

  emit('update-size', resizeId.value, newW, newH)
  if (newX !== s.compX || newY !== s.compY) {
    emit('update-position', resizeId.value, newX, newY)
  }
  setGuides(newX, newY)
}

function onResizeEnd() {
  isResizing.value = false
  resizeId.value = null
  resizeDir.value = ''
  clearGuides()
  emit('edit-end')
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
}

// === 多选整体缩放 ===
const multiSelectBox = computed(() => {
  if (props.selectedIds.length < 2) return null
  const selected = props.components.filter(c => props.selectedIds.includes(c.id) && !c.locked)
  if (selected.length < 2) return null
  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity
  for (const c of selected) {
    minX = Math.min(minX, c.x)
    minY = Math.min(minY, c.y)
    maxX = Math.max(maxX, c.x + c.width)
    maxY = Math.max(maxY, c.y + c.height)
  }
  return { x: minX, y: minY, width: maxX - minX, height: maxY - minY }
})

const multiSelectBoxStyle = computed(() => {
  if (!multiSelectBox.value) return {}
  const b = multiSelectBox.value
  const mmToPx = activeMmToPx.value
  return {
    left: `${b.x * mmToPx}px`,
    top: `${b.y * mmToPx}px`,
    width: `${b.width * mmToPx}px`,
    height: `${b.height * mmToPx}px`,
  }
})

const multiScaleState = ref<{
  startX: number
  startY: number
  boxW: number
  boxH: number
  ids: string[]
  baseline: BatchScaleBaseline
} | null>(null)

function startMultiScale(e: MouseEvent) {
  e.preventDefault()
  e.stopPropagation()
  if (!multiSelectBox.value) return
  const selectedComponents = props.components.filter(c => props.selectedIds.includes(c.id) && !c.locked)
  multiScaleState.value = {
    startX: e.clientX,
    startY: e.clientY,
    boxW: multiSelectBox.value.width,
    boxH: multiSelectBox.value.height,
    ids: selectedComponents.map(c => c.id),
    baseline: {
      boxX: multiSelectBox.value.x,
      boxY: multiSelectBox.value.y,
      components: selectedComponents.map(c => ({
        id: c.id,
        x: c.x,
        y: c.y,
        width: c.width,
        height: c.height,
      })),
    },
  }
  emit('edit-start')
  document.addEventListener('mousemove', onMultiScaleMove)
  document.addEventListener('mouseup', onMultiScaleEnd)
}

function onMultiScaleMove(e: MouseEvent) {
  const s = multiScaleState.value
  if (!s) return
  const dx = (e.clientX - s.startX) / activeMmToPx.value
  const dy = (e.clientY - s.startY) / activeMmToPx.value
  const scaleX = Math.max(0.1, (s.boxW + dx) / s.boxW)
  const scaleY = Math.max(0.1, (s.boxH + dy) / s.boxH)
  emit('batch-scale', s.ids, scaleX, scaleY, s.baseline)
}

function onMultiScaleEnd() {
  multiScaleState.value = null
  emit('edit-end')
  document.removeEventListener('mousemove', onMultiScaleMove)
  document.removeEventListener('mouseup', onMultiScaleEnd)
}

onBeforeUnmount(() => {
  document.removeEventListener('mousemove', onDragMove)
  document.removeEventListener('mouseup', onDragEnd)
  document.removeEventListener('mousemove', onMarqueeMove)
  document.removeEventListener('mouseup', onMarqueeEnd)
  document.removeEventListener('mousemove', onResizeMove)
  document.removeEventListener('mouseup', onResizeEnd)
  document.removeEventListener('mousemove', onMultiScaleMove)
  document.removeEventListener('mouseup', onMultiScaleEnd)
})
</script>

<style scoped>
.canvas-area {
  flex: 1;
  /* flex 子项默认 min-width:auto，会被画布内容撑宽导致整个设计器横向滚动 */
  min-width: 0;
  overflow: auto;
  background: #e8e8e8;
  padding: 40px;
  display: flex;
  /* safe center：画布比可视区宽时不会被居中裁掉左侧 */
  justify-content: safe center;
  align-items: flex-start;
  position: relative;
}
.canvas-shell {
  display: grid;
  grid-template-columns: auto;
  grid-template-rows: auto;
}
.canvas-shell.with-rulers {
  grid-template-columns: 24px auto;
  grid-template-rows: 24px auto;
}
.canvas {
  background: #fff;
  box-shadow: 0 2px 12px rgba(0, 0, 0, 0.15);
  position: relative;
  flex-shrink: 0;
  grid-column: 1;
  grid-row: 1;
}
.canvas-shell.with-rulers .canvas {
  grid-column: 2;
  grid-row: 2;
}
.selection-marquee {
  position: absolute;
  z-index: 9999;
  border: 1px solid #409eff;
  background: rgba(64, 158, 255, 0.12);
  pointer-events: none;
}
.ruler {
  z-index: 20;
  background-color: #f8fafc;
  pointer-events: none;
}
.ruler-corner {
  grid-column: 1;
  grid-row: 1;
  background: #f8fafc;
  border-right: 1px solid #cbd5e1;
  border-bottom: 1px solid #cbd5e1;
}
.ruler-top {
  grid-column: 2;
  grid-row: 1;
  height: 24px;
  border-bottom: 1px solid #cbd5e1;
  background-image: repeating-linear-gradient(to right, #94a3b8 0 1px, transparent 1px 100%);
}
.ruler-left {
  grid-column: 1;
  grid-row: 2;
  width: 24px;
  border-right: 1px solid #cbd5e1;
  background-image: repeating-linear-gradient(to bottom, #94a3b8 0 1px, transparent 1px 100%);
}
.snap-guide {
  position: absolute;
  z-index: 9998;
  pointer-events: none;
  background: #ff4d4f;
}
.snap-guide.vertical {
  top: 0;
  bottom: 0;
  width: 1px;
}
.snap-guide.horizontal {
  left: 0;
  right: 0;
  height: 1px;
}
.multi-select-box {
  position: absolute;
  border: 1px dashed #409eff;
  pointer-events: none;
  z-index: 9999;
}
.multi-scale-handle {
  position: absolute;
  width: 10px;
  height: 10px;
  background: #409eff;
  border: 1px solid #fff;
  border-radius: 2px;
  pointer-events: auto;
  cursor: nwse-resize;
}
.multi-scale-handle.se {
  right: -5px;
  bottom: -5px;
}
</style>
