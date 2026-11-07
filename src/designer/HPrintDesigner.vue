<template>
  <div class="hprint-designer">
    <div class="designer-toolbar">
      <button type="button" class="toolbar-btn" :disabled="!canUndo" title="Ctrl+Z" @click="undo">
        撤销
      </button>
      <button type="button" class="toolbar-btn" :disabled="!canRedo" title="Ctrl+Y / Ctrl+Shift+Z" @click="redo">
        重做
      </button>
      <span class="toolbar-separator"></span>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="Ctrl+C" @click="copySelectedComponent">
        复制
      </button>
      <button type="button" class="toolbar-btn" :disabled="!canPaste" title="Ctrl+V" @click="pasteComponents">
        粘贴
      </button>
      <button type="button" class="toolbar-btn danger" :disabled="!selectedComponent" title="Delete / Backspace" @click="deleteComponent">
        删除
      </button>
      <span class="toolbar-separator"></span>
      <span class="toolbar-group-label">纸张对齐</span>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="相对纸张居左（X=0）" @click="alignToPage('page-left')">
        靠左
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="相对纸张水平居中" @click="alignToPage('page-horizontal-center')">
        水平中
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="相对纸张居右" @click="alignToPage('page-right')">
        靠右
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="相对纸张顶部对齐（Y=0）" @click="alignToPage('page-top')">
        顶部
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="相对纸张垂直居中" @click="alignToPage('page-vertical-center')">
        垂直中
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="相对纸张底部对齐" @click="alignToPage('page-bottom')">
        底部
      </button>
      <span class="toolbar-separator"></span>
      <span class="toolbar-group-label">多选对齐</span>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 2" title="左对齐" @click="arrangeSelected('align-left')">
        左齐
      </button>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 2" title="右对齐" @click="arrangeSelected('align-right')">
        右齐
      </button>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 2" title="顶对齐" @click="arrangeSelected('align-top')">
        顶齐
      </button>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 2" title="底对齐" @click="arrangeSelected('align-bottom')">
        底齐
      </button>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 2" title="水平居中" @click="arrangeSelected('align-horizontal-center')">
        水平中
      </button>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 2" title="垂直居中" @click="arrangeSelected('align-vertical-center')">
        垂直中
      </button>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 3" title="横向等距分布" @click="arrangeSelected('distribute-horizontal')">
        横分布
      </button>
      <button type="button" class="toolbar-btn" :disabled="effectiveSelectedCount < 3" title="纵向等距分布" @click="arrangeSelected('distribute-vertical')">
        纵分布
      </button>
      <span class="toolbar-separator"></span>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="置顶" @click="arrangeLayer('bring-front')">
        置顶
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="置底" @click="arrangeLayer('send-back')">
        置底
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="上移一层" @click="arrangeLayer('move-forward')">
        上移
      </button>
      <button type="button" class="toolbar-btn" :disabled="!selectedComponent" title="下移一层" @click="arrangeLayer('move-backward')">
        下移
      </button>
      <span class="toolbar-separator"></span>
      <button type="button" class="toolbar-btn" title="缩小" @click="setZoom(zoom - 0.1)">
        -
      </button>
      <span class="zoom-label">{{ Math.round(zoom * 100) }}%</span>
      <button type="button" class="toolbar-btn" title="放大" @click="setZoom(zoom + 0.1)">
        +
      </button>
      <button type="button" class="toolbar-btn" title="重置缩放" @click="setZoom(1)">
        100%
      </button>
      <label class="toolbar-toggle">
        <input v-model="showRulers" type="checkbox" />
        标尺
      </label>
      <label class="toolbar-toggle">
        <input v-model="showGrid" type="checkbox" />
        网格
      </label>
      <label class="toolbar-toggle">
        <input v-model="snapToGrid" type="checkbox" />
        吸附
      </label>
      <label class="toolbar-toggle">
        <input v-model="showGuides" type="checkbox" />
        参考线
      </label>
    </div>
    <main class="designer-main">
      <ComponentPanel
        @add-component="addComponent"
      />

      <FieldPanel
        v-if="fields && fields.length > 0"
        :fields="fields"
        @drag-field="onDragField"
      />

      <Canvas
        :paper-width="paperWidth"
        :paper-height="paperHeight"
        :components="components"
        :selected-id="selectedId"
        :selected-ids="selectedIds"
        :preview-data="previewData"
        :zoom="zoom"
        :show-grid="showGrid"
        :show-rulers="showRulers"
        :snap-to-grid="snapToGrid"
        :show-guides="showGuides"
        @select="selectComponent"
        @select-many="selectComponents"
        @edit-start="beginHistoryTransaction"
        @edit-end="commitHistoryTransaction"
        @update-position="updateComponentPosition"
        @update-size="updateComponentSize"
        @drop-component="addComponentAt"
        @drop-field-component="addFieldComponent"
      />

      <PropertyPanel
        :selected-component="selectedComponent"
        :selected-components="selectedComponentsList"
        @update="updateComponent"
        @batch-update="batchUpdateComponents"
        @batch-scale="batchScaleComponents"
        @delete="deleteComponent"
      />
    </main>
  </div>
</template>

<script setup lang="ts">
import { ref, computed, watch, onMounted, onBeforeUnmount } from 'vue'
import ComponentPanel from './ComponentPanel.vue'
import FieldPanel from './FieldPanel.vue'
import Canvas from './Canvas.vue'
import PropertyPanel from './PropertyPanel.vue'
import type { HPrintComponent, HPrintTemplate, HPrintComponentType, HPrintField } from '../core/types'
import { getDefaultOptions, getDefaultSize, getDefaultPosition, getDefaultZIndex } from '../core/defaults'
import { useDesignerHistory, type DesignerHistoryState } from './useDesignerHistory'
import { useDesignerClipboard } from './useDesignerClipboard'
import { arrangeComponents, alignComponentsToPage, type DesignerArrangeAction, type DesignerPageAlignAction } from './useDesignerArrange'
import { arrangeComponentLayer, type DesignerLayerAction } from './useDesignerLayer'

const props = withDefaults(defineProps<{
  modelValue?: HPrintTemplate
  previewData?: Record<string, any>
  fields?: HPrintField[]
}>(), {
  previewData: () => ({}),
  fields: () => [],
})

const emit = defineEmits<{
  (e: 'update:modelValue', value: HPrintTemplate): void
}>()

// 纸张尺寸
const paperWidth = ref(210)
const paperHeight = ref(297)
const paperOrientation = ref<'portrait' | 'landscape'>('portrait')
const components = ref<HPrintComponent[]>([])
const selectedId = ref<string | null>(null)
const selectedIds = ref<string[]>([])
const zoom = ref(1)
const showRulers = ref(true)
const showGrid = ref(true)
const snapToGrid = ref(false)
const showGuides = ref(true)

const selectedComponent = computed(() => {
  if (!selectedId.value) return null
  return components.value.find(c => c.id === selectedId.value) || null
})
const selectedComponentsList = computed(() =>
  components.value.filter(c => selectedIds.value.includes(c.id))
)

/**
 * 保证 selectedIds 与 selectedId 始终一致：
 * - selectedIds 为空但有 selectedId 时，自动补成单元素数组。
 * - 任何只改 selectedId 的路径都不会再导致"有选中却按钮全灰"。
 * 放在 computed 里做纯派生，避免再加一份需要手动同步的状态。
 */
const effectiveSelectedIds = computed<string[]>(() => {
  if (selectedIds.value.length) return selectedIds.value
  return selectedId.value ? [selectedId.value] : []
})
const effectiveSelectedCount = computed(() => effectiveSelectedIds.value.length)

interface BatchScaleBaseline {
  boxX: number
  boxY: number
  components: Array<{ id: string; x: number; y: number; width: number; height: number }>
}

const history = useDesignerHistory()
const canUndo = history.canUndo
const canRedo = history.canRedo
const clipboard = useDesignerClipboard()
const canPaste = clipboard.canPaste

function currentHistoryState(): DesignerHistoryState {
  return {
    paper: {
      width: paperWidth.value,
      height: paperHeight.value,
      unit: props.modelValue?.paper?.unit || 'mm',
      orientation: paperOrientation.value,
    },
    components: components.value,
    selectedId: selectedId.value,
    selectedIds: selectedIds.value,
  }
}

function applyHistoryState(state: DesignerHistoryState) {
  paperWidth.value = state.paper.width
  paperHeight.value = state.paper.height
  paperOrientation.value = state.paper.orientation || 'portrait'
  components.value = state.components
  selectedId.value = state.selectedId
  // 注意空数组是 truthy：优先用快照里的多选，但为空时回落到主选中，避免"有选中却按钮全灰"
  const restoredIds = Array.isArray(state.selectedIds) && state.selectedIds.length
    ? state.selectedIds
    : (state.selectedId ? [state.selectedId] : [])
  selectedIds.value = restoredIds
  emitChange()
}

function recordHistory() {
  history.record(currentHistoryState())
}

function beginHistoryTransaction() {
  history.beginTransaction(currentHistoryState())
}

function commitHistoryTransaction() {
  history.commitTransaction(currentHistoryState())
}

function undo() {
  const previous = history.undo(currentHistoryState())
  if (previous) applyHistoryState(previous)
}

function redo() {
  const next = history.redo(currentHistoryState())
  if (next) applyHistoryState(next)
}

function copySelectedComponent() {
  const selected = components.value.filter(component => effectiveSelectedIds.value.includes(component.id))
  if (!selected.length && selectedComponent.value) {
    clipboard.copy([selectedComponent.value])
    return
  }
  clipboard.copy(selected)
}

function pasteComponents() {
  const pasted = clipboard.paste(generateId)
  if (!pasted.length) return
  recordHistory()
  components.value.push(...pasted)
  selectedIds.value = pasted.map(component => component.id)
  selectedId.value = pasted[pasted.length - 1].id
  emitChange()
}

function arrangeSelected(action: DesignerArrangeAction) {
  const editableIds = effectiveSelectedIds.value.filter(id => !components.value.find(component => component.id === id)?.locked)
  if (editableIds.length < 2) return
  if (action.startsWith('distribute') && editableIds.length < 3) return
  const next = arrangeComponents(components.value, editableIds, action)
  if (JSON.stringify(next) === JSON.stringify(components.value)) return
  recordHistory()
  components.value = next
  emitChange()
}

/** 单组件（或多选各自）相对纸张对齐 */
function alignToPage(action: DesignerPageAlignAction) {
  const ids = effectiveSelectedIds.value
  if (!ids.length) return
  const next = alignComponentsToPage(
    components.value,
    ids,
    action,
    paperWidth.value,
    paperHeight.value,
  )
  if (JSON.stringify(next) === JSON.stringify(components.value)) return
  recordHistory()
  components.value = next
  emitChange()
}

function arrangeLayer(action: DesignerLayerAction) {  const editableIds = effectiveSelectedIds.value.filter(id => !components.value.find(component => component.id === id)?.locked)
  if (!editableIds.length) return
  const next = arrangeComponentLayer(components.value, editableIds, action)
  if (JSON.stringify(next) === JSON.stringify(components.value)) return
  recordHistory()
  components.value = next
  emitChange()
}

function setZoom(value: number) {
  zoom.value = Math.min(2, Math.max(0.3, Number(value.toFixed(2))))
}

function isEditableTarget(target: EventTarget | null) {
  const element = target as HTMLElement | null
  if (!element) return false
  const tagName = element.tagName.toLowerCase()
  return tagName === 'input'
    || tagName === 'textarea'
    || tagName === 'select'
    || element.isContentEditable
}

function handleKeydown(event: KeyboardEvent) {
  if (isEditableTarget(event.target)) return
  const key = event.key.toLowerCase()
  if ((event.ctrlKey || event.metaKey) && key === 'z') {
    event.preventDefault()
    if (event.shiftKey) {
      redo()
    } else {
      undo()
    }
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 'y') {
    event.preventDefault()
    redo()
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 'c') {
    if (!selectedComponent.value) return
    event.preventDefault()
    copySelectedComponent()
    return
  }
  if ((event.ctrlKey || event.metaKey) && key === 'v') {
    if (!canPaste.value) return
    event.preventDefault()
    pasteComponents()
    return
  }
  if (key === 'delete' || key === 'backspace') {
    if (!selectedComponent.value) return
    event.preventDefault()
    deleteComponent()
  }
}

onMounted(() => {
  document.addEventListener('keydown', handleKeydown)
})

onBeforeUnmount(() => {
  document.removeEventListener('keydown', handleKeydown)
})

// 监听外部模板变化
watch(() => props.modelValue, (newVal) => {
  if (newVal) {
    paperWidth.value = newVal.paper.width
    paperHeight.value = newVal.paper.height
    if (newVal.paper.orientation) {
      paperOrientation.value = newVal.paper.orientation
    }
    if (JSON.stringify(newVal.components) !== JSON.stringify(components.value)) {
      components.value = [...newVal.components]
    }
  }
}, { deep: true, immediate: true })

let idCounter = 0
function generateId() {
  return `comp-${Date.now()}-${++idCounter}`
}

function addComponent(type: string) {
  recordHistory()
  const size = getDefaultSize(type as HPrintComponentType)
  const pos = getDefaultPosition(components.value.length)

  const newComp: HPrintComponent = {
    id: generateId(),
    type: type as HPrintComponentType,
    x: pos.x,
    y: pos.y,
    width: size.width,
    height: size.height,
    zIndex: getDefaultZIndex(type as HPrintComponentType),
    options: getDefaultOptions(type as HPrintComponentType)
  }

  components.value.push(newComp)
  selectedId.value = newComp.id
  selectedIds.value = [newComp.id]
  emitChange()
}

function addComponentAt(type: string, x: number, y: number) {
  recordHistory()
  const size = getDefaultSize(type as HPrintComponentType)

  const newComp: HPrintComponent = {
    id: generateId(),
    type: type as HPrintComponentType,
    x,
    y,
    width: size.width,
    height: size.height,
    zIndex: getDefaultZIndex(type as HPrintComponentType),
    options: getDefaultOptions(type as HPrintComponentType)
  }

  components.value.push(newComp)
  selectedId.value = newComp.id
  selectedIds.value = [newComp.id]
  emitChange()
}

function onDragField(_field: HPrintField) {
  // 字段拖拽到画布时，自动生成 text 组件
  // 实际位置由 drop 事件决定，这里只是预处理
}

/** 字段拖拽到画布时，自动生成带绑定的 text 组件 */
function addFieldComponent(fieldKey: string, _fieldLabel: string, x: number, y: number) {
  recordHistory()
  const newComp: HPrintComponent = {
    id: generateId(),
    type: 'text',
    x,
    y,
    width: 60,
    height: 10,
    options: {
      content: `{{${fieldKey}}}`,
      fontSize: 14,
      color: '#000000',
      fontFamily: 'Arial',
      fontWeight: 'normal',
      textAlign: 'left',
    }
  }

  components.value.push(newComp)
  selectedId.value = newComp.id
  selectedIds.value = [newComp.id]
  emitChange()
}

function selectComponent(id: string | null, additive = false) {
  if (!id) {
    selectedId.value = null
    selectedIds.value = []
    return
  }

  if (additive) {
    if (selectedIds.value.includes(id)) {
      selectedIds.value = selectedIds.value.filter(selected => selected !== id)
      selectedId.value = selectedIds.value[selectedIds.value.length - 1] || null
    } else {
      selectedIds.value = [...selectedIds.value, id]
      selectedId.value = id
    }
    return
  }

  selectedId.value = id
  selectedIds.value = [id]
}

function selectComponents(ids: string[]) {
  selectedIds.value = ids
  selectedId.value = ids[ids.length - 1] || null
}

function updateComponentPosition(id: string, x: number, y: number) {
  const comp = components.value.find(c => c.id === id)
  if (comp) {
    if (comp.locked) return
    if (comp.x === x && comp.y === y) return
    recordHistory()
    comp.x = x
    comp.y = y
    emitChange()
  }
}

function updateComponentSize(id: string, width: number, height: number) {
  const comp = components.value.find(c => c.id === id)
  if (comp) {
    if (comp.locked) return
    if (comp.width === width && comp.height === height) return
    recordHistory()
    comp.width = width
    comp.height = height
    emitChange()
  }
}

function isOnlyLockStateUpdate(updates: Partial<HPrintComponent>) {
  const updateKeys = Object.keys(updates)
  return updateKeys.length === 1 && updateKeys[0] === 'locked'
}

function updateComponent(id: string, updates: Partial<HPrintComponent>) {
  const comp = components.value.find(c => c.id === id)
  if (comp) {
    if (comp.locked && !isOnlyLockStateUpdate(updates)) return
    recordHistory()
    Object.assign(comp, updates)
    emitChange()
  }
}

function batchUpdateComponents(ids: string[], updates: Partial<HPrintComponent>) {
  if (!ids.length) return
  const onlyLockState = isOnlyLockStateUpdate(updates)
  const targetIds = onlyLockState
    ? ids
    : ids.filter(id => !components.value.find(component => component.id === id)?.locked)
  if (!targetIds.length) return
  recordHistory()
  for (const comp of components.value) {
    if (targetIds.includes(comp.id)) {
      const { options, ...rest } = updates
      Object.assign(comp, rest)
      if (options) {
        comp.options = {
          ...(comp.options || {}),
          ...options,
        }
      }
    }
  }
  emitChange()
}

function batchScaleComponents(ids: string[], scaleX: number, scaleY: number, baseline?: BatchScaleBaseline) {
  if (!ids.length) return
  const targetIds = ids.filter(id => !components.value.find(component => component.id === id)?.locked)
  if (!targetIds.length) return
  recordHistory()
  for (const comp of components.value) {
    if (targetIds.includes(comp.id)) {
      const base = baseline?.components.find(item => item.id === comp.id)
      if (base) {
        comp.x = Math.round((baseline!.boxX + (base.x - baseline!.boxX) * scaleX) * 10) / 10
        comp.y = Math.round((baseline!.boxY + (base.y - baseline!.boxY) * scaleY) * 10) / 10
        comp.width = Math.max(1, Math.round(base.width * scaleX * 10) / 10)
        comp.height = Math.max(1, Math.round(base.height * scaleY * 10) / 10)
      } else {
        comp.width = Math.max(1, Math.round(comp.width * scaleX * 10) / 10)
        comp.height = Math.max(1, Math.round(comp.height * scaleY * 10) / 10)
      }
    }
  }
  emitChange()
}

function deleteComponent() {
  const ids = effectiveSelectedIds.value
  const editableIds = ids.filter(id => !components.value.find(component => component.id === id)?.locked)
  if (!editableIds.length) return
  recordHistory()
  components.value = components.value.filter(c => !editableIds.includes(c.id))
  selectedIds.value = selectedIds.value.filter(id => !editableIds.includes(id))
  selectedId.value = selectedIds.value[selectedIds.value.length - 1] || null
  emitChange()
}

function emitChange() {
  const template: HPrintTemplate = {
    ...props.modelValue,
    schemaVersion: props.modelValue?.schemaVersion || '2026-06',
    name: props.modelValue?.name,
    paper: {
      ...props.modelValue?.paper,
      width: paperWidth.value,
      height: paperHeight.value,
      unit: props.modelValue?.paper?.unit || 'mm',
      orientation: paperOrientation.value,
    },
    components: components.value,
    fields: props.fields?.length ? props.fields : props.modelValue?.fields,
    printOptions: props.modelValue?.printOptions,
  }
  emit('update:modelValue', template)
}

/**
 * 外部设置纸张尺寸与方向（一次 emit，避免宽高和方向互相覆盖）
 * @param width 宽（mm）
 * @param height 高（mm）
 * @param orientation 纸张方向，不传则保持当前方向
 */
function setPaperSize(width: number, height: number, orientation?: 'portrait' | 'landscape') {
  recordHistory()
  paperWidth.value = width
  paperHeight.value = height
  if (orientation) {
    paperOrientation.value = orientation
  }
  emitChange()
}

/** 获取当前模板（保留完整字段） */
function getTemplate(): HPrintTemplate {
  return {
    ...props.modelValue,
    schemaVersion: props.modelValue?.schemaVersion || '2026-06',
    name: props.modelValue?.name,
    paper: {
      ...props.modelValue?.paper,
      width: paperWidth.value,
      height: paperHeight.value,
      unit: props.modelValue?.paper?.unit || 'mm',
      orientation: paperOrientation.value,
    },
    components: components.value,
    fields: props.fields?.length ? props.fields : props.modelValue?.fields,
    printOptions: props.modelValue?.printOptions,
  }
}

/** 应用完整模板（原子操作，避免中间状态覆盖） */
function applyTemplate(t: HPrintTemplate) {
  recordHistory()
  paperWidth.value = t.paper.width
  paperHeight.value = t.paper.height
  paperOrientation.value = t.paper.orientation || 'portrait'
  components.value = [...(t.components || [])]
  selectedId.value = null
  selectedIds.value = []
  emit('update:modelValue', {
    ...t,
    paper: { ...t.paper, width: t.paper.width, height: t.paper.height, unit: t.paper.unit || 'mm', orientation: paperOrientation.value },
    components: components.value,
  })
}

defineExpose({
  getTemplate,
  setPaperSize,
  applyTemplate,
  addComponent,
  deleteComponent,
  copySelectedComponent,
  pasteComponents,
  arrangeSelected,
  arrangeLayer,
  setZoom,
  undo,
  redo,
  selectComponent,
  clear: () => {
    recordHistory()
    components.value = []
    selectedId.value = null
    selectedIds.value = []
    emitChange()
  }
})
</script>

<style scoped>
.hprint-designer {
  display: flex;
  flex-direction: column;
  height: 100%;
  border: 1px solid #ddd;
  border-radius: 4px;
  overflow: hidden;
}
.designer-toolbar {
  display: flex;
  align-items: center;
  flex-wrap: wrap;
  gap: 8px;
  min-height: 40px;
  padding: 6px 10px;
  border-bottom: 1px solid #ddd;
  background: #f8fafc;
}
.toolbar-btn {
  height: 28px;
  padding: 0 12px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #334155;
  cursor: pointer;
  font-size: 13px;
}
.toolbar-btn {
  min-width: 32px;
}
.toolbar-btn:hover:not(:disabled) {
  border-color: #409eff;
  color: #409eff;
}
.toolbar-btn.danger:hover:not(:disabled) {
  border-color: #f56c6c;
  color: #f56c6c;
}
.toolbar-btn:disabled {
  opacity: 0.45;
  cursor: not-allowed;
}
.toolbar-separator {
  width: 1px;
  height: 20px;
  background: #cbd5e1;
}
.toolbar-group-label {
  font-size: 11px;
  color: #94a3b8;
  white-space: nowrap;
  padding: 0 2px;
  user-select: none;
}
.zoom-label {
  min-width: 44px;
  color: #334155;
  font-size: 13px;
  text-align: center;
}
.toolbar-toggle {
  display: inline-flex;
  align-items: center;
  gap: 4px;
  color: #334155;
  font-size: 13px;
  user-select: none;
}
.designer-main {
  display: flex;
  flex: 1;
  overflow: hidden;
}
</style>
