<template>
  <aside class="field-panel">
    <div class="panel-header">
      <span class="panel-title">字段</span>
    </div>
    <div class="panel-body">
      <p v-if="!fields || fields.length === 0" class="empty-text">暂无字段配置</p>
      <div v-else class="field-list">
        <template v-for="field in fields" :key="field.key">
          <!-- 数组 / 对象字段：渲染成可折叠分组，子字段缩进展示 -->
          <div v-if="hasChildren(field)" class="field-group">
            <div
              class="field-group__header"
              :title="`点击复制 {{${field.key}}}，点击箭头折叠`"
              draggable="true"
              @dragstart="onDragStart($event, field)"
              @click="onGroupHeaderClick(field, $event)"
            >
              <span class="field-group__caret">{{
                isCollapsed(field.key) ? '▸' : '▾'
              }}</span>
              <span class="field-type-badge">{{ typeIcon(field.type) }}</span>
              <span class="field-text">
                <span class="field-label">{{ field.label }}</span>
                <span class="field-key">{{ field.key }}</span>
              </span>
            </div>
            <div v-show="!isCollapsed(field.key)" class="field-group__body">
              <div
                v-for="child in field.children"
                :key="child.key"
                class="field-item field-item--child"
                draggable="true"
                :title="`${child.label} (${child.key})　点击复制 {{${child.key}}}`"
                @dragstart="onDragStart($event, child)"
                @click="copyField(child)"
              >
                <span class="field-type-badge">{{ typeIcon(child.type) }}</span>
                <span class="field-text">
                  <span class="field-label">{{ child.label }}</span>
                  <span class="field-key">{{ child.key }}</span>
                </span>
              </div>
            </div>
          </div>
          <!-- 普通字段 -->
          <div
            v-else
            class="field-item"
            draggable="true"
            :title="`${field.label} (${field.key})　点击复制 {{${field.key}}}`"
            @dragstart="onDragStart($event, field)"
            @click="copyField(field)"
          >
            <span class="field-type-badge">{{ typeIcon(field.type) }}</span>
            <span class="field-text">
              <span class="field-label">{{ field.label }}</span>
              <span class="field-key">{{ field.key }}</span>
            </span>
          </div>
        </template>
      </div>
      <div class="field-hint">
        💡 点击复制字段，拖拽到画布生成组件<br />
        📦 带 <code>[]</code> 的分组是明细数组，表格「数据源」填它，列里填它的子字段
      </div>
    </div>
    <div v-if="copiedText" class="copied-toast">已复制 {{ copiedText }}</div>
      <div v-else-if="copyFailed" class="copied-toast copied-toast--error">
        复制失败，请手动选中字段名复制
      </div>
  </aside>
</template>

<script setup lang="ts">
import { ref } from 'vue'
import { copyText } from '../core/clipboard'
import type { HPrintField } from '../core/types'

defineProps<{
  fields?: HPrintField[]
}>()

const emit = defineEmits<{
  (e: 'drag-field', field: HPrintField): void
}>()

/** 折叠状态，key 为字段 key；存起来刷新后保持 */
const COLLAPSE_STORAGE_KEY = 'hprint-field-panel-collapsed'
const collapsed = ref<Record<string, boolean>>(readCollapsed())

const copiedText = ref('')
const copyFailed = ref(false)
let copyTimer: ReturnType<typeof setTimeout> | null = null

function readCollapsed(): Record<string, boolean> {
  try {
    const raw = localStorage.getItem(COLLAPSE_STORAGE_KEY)
    return raw ? (JSON.parse(raw) as Record<string, boolean>) : {}
  } catch {
    return {}
  }
}

function persistCollapsed() {
  try {
    localStorage.setItem(COLLAPSE_STORAGE_KEY, JSON.stringify(collapsed.value))
  } catch {
    // 隐私模式等场景写不进去，忽略即可
  }
}

/** 是否是可展开的分组（数组/对象且有子字段） */
function hasChildren(field: HPrintField): boolean {
  return Array.isArray(field.children) && field.children.length > 0
}

/** 分组是否折叠；默认展开 */
function isCollapsed(key: string): boolean {
  return collapsed.value[key] === true
}

/** 切换分组折叠状态 */
function toggleCollapsed(key: string) {
  collapsed.value = { ...collapsed.value, [key]: !isCollapsed(key) }
  persistCollapsed()
}

function typeIcon(type: string): string {
  const icons: Record<string, string> = {
    string: 'Aa', number: '#', money: '¥', date: '📅',
    datetime: '🕐', boolean: '✓', image: '🖼',
    qrcode: '⊞', barcode: '▮', array: '[]', object: '{}',
  }
  return icons[type] || '?'
}

/** 分组标题点击：复制 {{key}}；分组头同时支持折叠，交给 caret 处理 */
function onGroupHeaderClick(field: HPrintField, event: MouseEvent) {
  const target = event.target as HTMLElement | null
  if (target?.closest('.field-group__caret')) {
    toggleCollapsed(field.key)
    return
  }
  copyField(field)
}

async function copyField(field: HPrintField) {
  const text = `{{${field.key}}}`
  const ok = await copyText(text)
  copiedText.value = ok ? text : ''
  copyFailed.value = !ok
  if (copyTimer) clearTimeout(copyTimer)
  copyTimer = setTimeout(() => {
    copiedText.value = ''
    copyFailed.value = false
  }, 1500)
}

function onDragStart(e: DragEvent, field: HPrintField) {
  e.dataTransfer?.setData('field-key', field.key)
  e.dataTransfer?.setData('field-label', field.label)
  e.dataTransfer?.setData('field-type', field.type)
  e.dataTransfer!.effectAllowed = 'copy'
  emit('drag-field', field)
}
</script>

<style scoped>
.field-panel {
  width: 240px;
  background: #fff;
  border-right: 1px solid #e8e8e8;
  display: flex;
  flex-direction: column;
  flex-shrink: 0;
}
.panel-header {
  padding: 12px 16px;
  background: #fafafa;
  border-bottom: 1px solid #e8e8e8;
}
.panel-title {
  font-size: 14px;
  font-weight: 500;
  color: #333;
}
.panel-body {
  flex: 1;
  min-width: 0;
  overflow-y: auto;
  padding: 12px;
}
.empty-text {
  text-align: center;
  color: #999;
  padding: 40px 0;
}
.field-list {
  display: flex;
  flex-direction: column;
  gap: 4px;
}
.field-item {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  background: #f5f7fa;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  user-select: none;
}
.field-item:hover {
  background: #ecf5ff;
  border-color: #409eff;
}
.field-item:active { cursor: grabbing; }

/* 明细子字段：左侧缩进 + 浅色背景，和顶层字段区分开 */
.field-item--child {
  padding: 5px 8px 5px 12px;
  background: #fbfcfd;
  border-left: 2px solid #dcdfe6;
  border-radius: 0 4px 4px 0;
}
.field-item--child:hover {
  border-left-color: #409eff;
}

.field-group {
  display: flex;
  flex-direction: column;
  gap: 3px;
}
.field-group__header {
  display: flex;
  align-items: center;
  gap: 6px;
  padding: 6px 8px;
  font-weight: 500;
  background: #eef2f7;
  border: 1px solid #dfe4ec;
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  user-select: none;
}
.field-group__header:hover {
  background: #e3edfa;
  border-color: #409eff;
}
.field-group__header:active { cursor: grabbing; }
.field-group__caret {
  width: 12px;
  font-size: 10px;
  color: #606266;
  text-align: center;
  cursor: pointer;
}
.field-group__body {
  display: flex;
  flex-direction: column;
  gap: 3px;
  padding-left: 6px;
}

.field-type-badge {
  font-size: 10px;
  background: #fff;
  padding: 1px 4px;
  border-radius: 3px;
  font-family: monospace;
  color: #666;
  border: 1px solid #e8e8e8;
  flex-shrink: 0;
}
/* 名称 + key 上下两行，避免长字段名被省略号截断 */
.field-text {
  display: flex;
  flex: 1;
  flex-direction: column;
  gap: 1px;
  min-width: 0;
}
.field-label {
  font-size: 12px;
  line-height: 1.35;
  color: #303133;
  overflow-wrap: anywhere;
}
.field-key {
  font-size: 10px;
  line-height: 1.2;
  color: #a8abb2;
  font-family: monospace;
  overflow-wrap: anywhere;
}
.field-hint {
  margin-top: 12px;
  padding: 8px;
  background: #f5f7fa;
  border-radius: 4px;
  font-size: 11px;
  color: #909399;
  line-height: 1.4;
}
.field-hint code {
  padding: 0 2px;
  font-family: monospace;
  background: #fff;
  border-radius: 2px;
}
.copied-toast--error {
  color: #f56c6c;
}

.copied-toast {
  position: fixed;
  top: 60px;
  left: 50%;
  transform: translateX(-50%);
  background: #67c23a;
  color: #fff;
  padding: 6px 16px;
  border-radius: 4px;
  font-size: 12px;
  z-index: 1000;
  animation: slideIn 0.3s ease;
}
@keyframes slideIn {
  from { opacity: 0; transform: translateX(-50%) translateY(-10px); }
  to { opacity: 1; transform: translateX(-50%) translateY(0); }
}
</style>
