<template>
  <div
    class="component-renderer"
    :class="{ 'is-selected': isSelected }"
    :style="wrapperStyle"
    @mousedown="$emit('startDrag', $event, component.id)"
  >
    <Text v-if="component.type === 'text'" v-bind="component.options" :data="data" />
    <Text v-else-if="component.type === 'page-header'" v-bind="component.options" :data="data" />
    <Text v-else-if="component.type === 'page-footer'" v-bind="component.options" :data="data" />
    <Text v-else-if="component.type === 'page-number'" v-bind="pageNumberOptions(component.options)" :data="data" />
    <div v-else-if="component.type === 'watermark'" class="visual-preview" v-html="visualHtml"></div>
    <Line v-else-if="component.type === 'line'" v-bind="component.options" />
    <Rect v-else-if="component.type === 'rect'" v-bind="component.options" />
    <Ellipse v-else-if="component.type === 'ellipse'" v-bind="component.options" />
    <div v-else-if="component.type === 'qrcode'" class="visual-preview" v-html="visualHtml"></div>
    <div v-else-if="component.type === 'barcode'" class="visual-preview" v-html="visualHtml"></div>
    <div v-else-if="component.type === 'table'" class="visual-preview" v-html="visualHtml"></div>
    <div v-else-if="component.type === 'image'" class="visual-preview" v-html="visualHtml"></div>

    <Text v-else-if="component.type === 'receipt-title'" v-bind="mapReceiptTitle(component.options)" :data="data" />
    <Text v-else-if="component.type === 'receipt-text'" v-bind="mapReceiptText(component.options)" :data="data" />
    <Line v-else-if="component.type === 'receipt-divider'" v-bind="component.options" />
    <Text v-else-if="component.type === 'receipt-total'" v-bind="mapReceiptTotal(component.options)" :data="data" />
    <div v-else-if="component.type === 'receipt-qrcode'" class="visual-preview" v-html="visualHtml"></div>
    <div v-else-if="component.type === 'receipt-barcode'" class="visual-preview" v-html="visualHtml"></div>
    <div v-else class="unknown-component">Unknown: {{ component.type }}</div>

    <template v-if="isSelected && !component.locked">
      <div class="resize-handle nw" @mousedown.stop="startResize($event, 'nw')"></div>
      <div class="resize-handle ne" @mousedown.stop="startResize($event, 'ne')"></div>
      <div class="resize-handle sw" @mousedown.stop="startResize($event, 'sw')"></div>
      <div class="resize-handle se" @mousedown.stop="startResize($event, 'se')"></div>
      <div class="resize-handle n" @mousedown.stop="startResize($event, 'n')"></div>
      <div class="resize-handle s" @mousedown.stop="startResize($event, 's')"></div>
      <div class="resize-handle w" @mousedown.stop="startResize($event, 'w')"></div>
      <div class="resize-handle e" @mousedown.stop="startResize($event, 'e')"></div>
    </template>
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import Text from './Text.vue'
import Line from './Line.vue'
import Rect from './Rect.vue'
import Ellipse from './Ellipse.vue'
import { renderComponentToHtml } from '@/core/visualRenderer'
import type { HPrintComponent } from '@/core/types'

const props = withDefaults(defineProps<{
  component: HPrintComponent
  data?: Record<string, any>
  mmToPx?: number
  isSelected?: boolean
}>(), {
  data: () => ({}),
  mmToPx: 3.7795,
  isSelected: false,
})

const emit = defineEmits<{
  (e: 'startDrag', event: MouseEvent, id: string): void
  (e: 'startResize', event: MouseEvent, id: string, direction: string): void
}>()

const wrapperStyle = computed(() => ({
  position: 'absolute' as const,
  left: `${props.component.x * props.mmToPx}px`,
  top: `${props.component.y * props.mmToPx}px`,
  width: `${props.component.width * props.mmToPx}px`,
  height: `${props.component.height * props.mmToPx}px`,
  transform: `rotate(${props.component.rotate || 0}deg)`,
  opacity: props.component.hidden ? 0.25 : (props.component.opacity ?? 1),
  zIndex: Math.max(0, props.component.zIndex ?? 0),
  cursor: props.component.locked ? 'not-allowed' : 'move',
  border: props.component.hidden ? '1px dashed #909399' : undefined,
}))

const visualHtml = computed(() => renderComponentToHtml(props.component, props.data, undefined, props.mmToPx))

function mapReceiptTitle(opts: Record<string, any>) {
  return {
    content: opts.content,
    fontSize: opts.fontSize || 20,
    fontWeight: opts.fontWeight || 'bold',
    textAlign: opts.textAlign || 'center',
    color: '#000',
    fontFamily: 'Arial',
  }
}

function mapReceiptText(opts: Record<string, any>) {
  return {
    content: opts.content,
    fontSize: opts.fontSize || 14,
    textAlign: opts.textAlign || 'left',
    color: '#000',
    fontFamily: 'Arial',
    fontWeight: 'normal',
  }
}

function mapReceiptTotal(opts: Record<string, any>) {
  return {
    content: `${opts.label || 'Total'}: ${opts.value || '0.00'}`,
    fontSize: opts.valueFontSize || 16,
    fontWeight: 'bold',
    textAlign: 'right',
    color: '#000',
    fontFamily: 'Arial',
  }
}

function pageNumberOptions(opts: Record<string, any>) {
  const content = String(opts.content || '第 {page} / {total} 页')
    .replace(/\{page\}/g, '1')
    .replace(/\{total\}/g, '1')
  return {
    ...opts,
    content,
  }
}

function startResize(e: MouseEvent, direction: string) {
  emit('startResize', e, props.component.id, direction)
}
</script>

<style scoped>
.component-renderer {
  border: 1px solid transparent;
  box-sizing: border-box;
  transition: border-color 0.15s;
}
.component-renderer:hover {
  border-color: #409eff;
}
.component-renderer.is-selected {
  border: 2px solid #409eff;
}
.placeholder {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
  box-sizing: border-box;
}
.visual-preview {
  width: 100%;
  height: 100%;
}
.visual-preview :deep(svg) {
  width: 100%;
  height: 100%;
  display: block;
}
.visual-preview :deep(.hprint-image) {
  width: 100%;
  height: 100%;
  object-fit: contain;
  display: block;
}
.visual-preview :deep(.hprint-table) {
  width: 100%;
  height: 100%;
  border-collapse: collapse;
  table-layout: fixed;
  font-size: 12px;
}
.visual-preview :deep(.hprint-table th),
.visual-preview :deep(.hprint-table td) {
  overflow: hidden;
  box-sizing: border-box;
  white-space: nowrap;
  text-overflow: ellipsis;
}
.visual-preview :deep(.hprint-code-placeholder),
.visual-preview :deep(.hprint-placeholder) {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: #f5f7fa;
  border: 1px dashed #dcdfe6;
  border-radius: 4px;
  font-size: 12px;
  color: #909399;
  box-sizing: border-box;
}
.unknown-component {
  color: #999;
  font-size: 12px;
  padding: 4px;
}

.resize-handle {
  position: absolute;
  width: 8px;
  height: 8px;
  background: #409eff;
  border: 1px solid #fff;
  border-radius: 2px;
  z-index: 10;
}
.resize-handle.nw { top: -4px; left: -4px; cursor: nw-resize; }
.resize-handle.ne { top: -4px; right: -4px; cursor: ne-resize; }
.resize-handle.sw { bottom: -4px; left: -4px; cursor: sw-resize; }
.resize-handle.se { bottom: -4px; right: -4px; cursor: se-resize; }
.resize-handle.n { top: -4px; left: 50%; margin-left: -4px; cursor: n-resize; }
.resize-handle.s { bottom: -4px; left: 50%; margin-left: -4px; cursor: s-resize; }
.resize-handle.w { top: 50%; margin-top: -4px; left: -4px; cursor: w-resize; }
.resize-handle.e { top: 50%; margin-top: -4px; right: -4px; cursor: e-resize; }
</style>
