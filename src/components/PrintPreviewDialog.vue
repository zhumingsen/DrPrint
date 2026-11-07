<template>
  <div v-if="modelValue" class="preview-mask" @click.self="close">
    <section class="preview-dialog" role="dialog" aria-modal="true">
      <header class="preview-header">
        <h2>打印预览</h2>
        <button class="icon-button" type="button" @click="close" aria-label="关闭">×</button>
      </header>

      <div class="preview-body">
        <div class="preview-toolbar">
          <div class="preview-meta">
            <span>{{ template?.name || '未命名模板' }}</span>
            <span>{{ renderResult.widthMm }}×{{ renderResult.heightMm }}mm · {{ orientationLabel }}</span>
            <span v-if="renderResult.diagnostics.length" class="diagnostic-count">
              诊断 {{ renderResult.diagnostics.length }}
            </span>
          </div>
          <div class="preview-controls">
            <button type="button" class="tool-button" :disabled="pageIndex === 0" @click="pageIndex--">上一页</button>
            <span>{{ pageIndex + 1 }} / {{ pages.length }}</span>
            <button type="button" class="tool-button" :disabled="pageIndex >= pages.length - 1" @click="pageIndex++">下一页</button>
            <button type="button" class="tool-button" @click="zoomOut">-</button>
            <span>{{ Math.round(zoom * 100) }}%</span>
            <button type="button" class="tool-button" @click="zoomIn">+</button>
            <button type="button" class="tool-button" @click="resetZoom">适应</button>
          </div>
        </div>
        <div v-if="currentDiagnostics.length" class="preview-diagnostics">
          <div
            v-for="(item, index) in currentDiagnostics"
            :key="`${item.code}-${item.componentId || index}`"
            :class="['diagnostic-item', item.level]"
          >
            <span class="diagnostic-msg">{{ item.message }}</span>
            <span v-if="item.componentId" class="diagnostic-actions">
              <button type="button" class="diag-btn" @click="emit('locate-component', item.componentId!)">定位</button>
              <button v-if="item.level === 'warning'" type="button" class="diag-btn fix" @click="emit('fix-overflow', item.componentId!)">移入页内</button>
            </span>
          </div>
          <div v-if="hasOverflowWarnings" class="diagnostic-fix-all">
            <button type="button" class="diag-btn fix-all" @click="emit('fit-to-paper')">一键修正所有越界组件</button>
          </div>
        </div>
        <div class="preview-stage">
          <div class="preview-paper-shell" :style="paperShellStyle">
            <iframe
              class="preview-frame"
              :style="paperFrameStyle"
              :srcdoc="pages[pageIndex]?.html || ''"
              title="打印预览"
            />
          </div>
        </div>
      </div>

      <footer class="preview-footer">
        <button type="button" class="button" @click="close">取消</button>
        <button type="button" class="button primary" @click="confirmPrint">打印</button>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import type { HPrintTemplate } from '../core/types'
import { renderTemplateToPages } from '../core/visualRenderer'

const props = withDefaults(defineProps<{
  modelValue: boolean
  template: HPrintTemplate | null
  data?: Record<string, unknown>
}>(), {
  data: () => ({}),
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'print'): void
  (event: 'locate-component', componentId: string): void
  (event: 'fix-overflow', componentId: string): void
  (event: 'fit-to-paper'): void
}>()

const fallbackTemplate: HPrintTemplate = {
  schemaVersion: '2026-06',
  name: '打印预览',
  paper: { width: 80, height: 60, unit: 'mm' },
  components: [],
}

const renderResult = computed(() => renderTemplateToPages(props.template || fallbackTemplate, props.data))
const zoom = ref(1)
const pageIndex = ref(0)
const pages = computed(() => renderResult.value.pages)
const orientationLabel = computed(() => renderResult.value.orientation === 'landscape' ? '横向' : '纵向')
const currentDiagnostics = computed(() => {
  const currentPageNumber = pageIndex.value + 1
  return renderResult.value.diagnostics.filter((item) => {
    return item.level !== 'info' || item.pageNumber === currentPageNumber
  }).filter((item) => !item.pageNumber || item.pageNumber === currentPageNumber)
})

const hasOverflowWarnings = computed(() =>
  currentDiagnostics.value.some(d => d.level === 'warning' && d.componentId)
)

const paperShellStyle = computed(() => ({
  width: `${renderResult.value.widthPx * zoom.value}px`,
  height: `${renderResult.value.heightPx * zoom.value}px`,
}))

const paperFrameStyle = computed(() => ({
  width: `${renderResult.value.widthPx}px`,
  height: `${renderResult.value.heightPx}px`,
  transform: `scale(${zoom.value})`,
}))

watch(
  () => props.modelValue,
  (visible) => {
    if (visible) {
      pageIndex.value = 0
      resetZoom()
    }
  },
)

watch(pages, () => {
  pageIndex.value = Math.min(pageIndex.value, pages.value.length - 1)
})

function close() {
  emit('update:modelValue', false)
}

function confirmPrint() {
  emit('print')
}

function zoomIn() {
  zoom.value = Math.min(2, Number((zoom.value + 0.1).toFixed(2)))
}

function zoomOut() {
  zoom.value = Math.max(0.3, Number((zoom.value - 0.1).toFixed(2)))
}

function resetZoom() {
  zoom.value = 1
}
</script>

<style scoped>
.preview-mask {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  background: rgba(0, 0, 0, 0.48);
}
.preview-dialog {
  width: min(920px, calc(100vw - 32px));
  height: min(760px, calc(100vh - 32px));
  display: flex;
  flex-direction: column;
  background: #fff;
  border-radius: 6px;
  overflow: hidden;
  box-shadow: 0 14px 44px rgba(0, 0, 0, 0.3);
}
.preview-header,
.preview-footer {
  display: flex;
  align-items: center;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}
.preview-header h2 {
  flex: 1;
  margin: 0;
  text-align: center;
  font-size: 18px;
  font-weight: 600;
}
.preview-footer {
  justify-content: flex-end;
  gap: 10px;
  border-top: 1px solid #e5e7eb;
  border-bottom: 0;
}
.preview-body {
  flex: 1;
  display: flex;
  flex-direction: column;
  min-height: 0;
  background: #f3f4f6;
}
.preview-toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 14px;
  padding: 8px 14px;
  color: #475569;
  font-size: 12px;
  background: #fff;
  border-bottom: 1px solid #e5e7eb;
}
.preview-meta,
.preview-controls {
  display: flex;
  align-items: center;
  gap: 8px;
}
.preview-meta {
  min-width: 0;
}
.preview-meta span:first-child {
  max-width: 220px;
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.preview-controls {
  flex-shrink: 0;
}
.diagnostic-count {
  color: #b45309;
}
.preview-diagnostics {
  display: grid;
  gap: 4px;
  max-height: 96px;
  padding: 8px 14px;
  overflow: auto;
  background: #fff7ed;
  border-bottom: 1px solid #fed7aa;
}
.diagnostic-item {
  font-size: 12px;
  line-height: 1.4;
  color: #9a3412;
}
.diagnostic-item.info {
  color: #1d4ed8;
}
.diagnostic-item.error {
  color: #b91c1c;
}
.diagnostic-msg {
  flex: 1;
  min-width: 0;
}
.diagnostic-actions {
  display: flex;
  gap: 4px;
  flex-shrink: 0;
  margin-left: 8px;
}
.diag-btn {
  padding: 1px 6px;
  border: 1px solid #dcdfe6;
  border-radius: 3px;
  background: #fff;
  color: #606266;
  font-size: 10px;
  cursor: pointer;
  white-space: nowrap;
}
.diag-btn:hover { color: #409eff; border-color: #409eff; }
.diag-btn.fix { color: #e6a23c; border-color: #e6a23c; }
.diag-btn.fix:hover { background: #e6a23c; color: #fff; }
.diagnostic-fix-all {
  margin-top: 6px;
}
.diag-btn.fix-all {
  padding: 3px 10px;
  border: 1px solid #e6a23c;
  border-radius: 4px;
  background: #fdf6ec;
  color: #e6a23c;
  font-size: 11px;
  cursor: pointer;
}
.diag-btn.fix-all:hover { background: #e6a23c; color: #fff; }
.preview-stage {
  flex: 1;
  display: flex;
  align-items: flex-start;
  justify-content: center;
  padding: 18px;
  overflow: auto;
}
.preview-paper-shell {
  flex: 0 0 auto;
  position: relative;
  background: #fff;
  box-shadow: 0 2px 12px rgba(15, 23, 42, 0.18);
}
.preview-frame {
  display: block;
  position: absolute;
  top: 0;
  left: 0;
  border: none;
  background: #fff;
  transform-origin: top left;
}
.icon-button {
  width: 28px;
  height: 28px;
  border: 0;
  background: transparent;
  font-size: 20px;
  line-height: 1;
  cursor: pointer;
}
.button {
  min-width: 72px;
  height: 34px;
  border: 1px solid #d1d5db;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
}
.button.primary {
  border-color: #2563eb;
  color: #fff;
  background: #2563eb;
}
.tool-button {
  height: 26px;
  padding: 0 8px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #334155;
  cursor: pointer;
  font-size: 12px;
}
.tool-button:disabled {
  cursor: not-allowed;
  opacity: 0.45;
}
</style>
