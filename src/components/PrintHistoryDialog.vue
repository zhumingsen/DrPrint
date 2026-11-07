<template>
  <div v-if="modelValue" class="history-mask" @click.self="close">
    <div class="history-dialog">
      <header class="dialog-header">
        <h3>打印历史</h3>
        <button class="close-btn" @click="close">✕</button>
      </header>

      <div class="dialog-body">
        <div class="toolbar">
          <div class="filter-group">
            <button class="filter-btn" :class="{ active: filter === 'all' }" @click="filter = 'all'">全部</button>
            <button class="filter-btn" :class="{ active: filter === 'printed' }" @click="filter = 'printed'">成功</button>
            <button class="filter-btn" :class="{ active: filter === 'failed' }" @click="filter = 'failed'">失败</button>
          </div>
          <div class="toolbar-right">
            <span class="count-text">{{ filteredHistory.length }} 条</span>
            <button class="btn btn-sm" :disabled="loading" @click="loadHistory">刷新</button>
            <button class="btn btn-sm danger" :disabled="loading || history.length === 0" @click="clearAll">清空</button>
          </div>
        </div>

        <div v-if="loading" class="state-text">加载中…</div>
        <div v-else-if="error" class="state-text error">{{ error }}</div>
        <div v-else-if="filteredHistory.length === 0" class="state-text">暂无打印历史</div>

        <div v-else class="history-list">
          <div class="history-head">
            <span class="col-time">时间</span>
            <span class="col-name">模板 / 文档</span>
            <span class="col-printer">打印机</span>
            <span class="col-mode">模式</span>
            <span class="col-status">状态</span>
            <span class="col-actions">操作</span>
          </div>
          <div v-for="item in filteredHistory" :key="item.id" class="history-row" :class="{ expanded: expandedId === item.id }">
            <div class="row-main" @click="toggleExpand(item.id)">
              <span class="col-time">{{ formatTime(item.createdAt) }}</span>
              <span class="col-name" :title="item.documentName">{{ item.templateName || item.documentName }}</span>
              <span class="col-printer" :title="item.printerName">{{ item.printerName }}</span>
              <span class="col-mode">{{ formatMode(item) }}</span>
              <span class="col-status">
                <span class="status-badge" :class="item.status">{{ item.status === 'printed' ? '成功' : '失败' }}</span>
              </span>
              <span class="col-actions" @click.stop>
                <button class="link-btn" :disabled="reprintingId === item.id" :title="item.snapshotTruncated ? '快照可能不完整，重打可能失败' : '重新打印这条记录'" @click="reprint(item)">
                  {{ reprintingId === item.id ? '打印中…' : '重打' }}
                </button>
                <button class="link-btn danger" :disabled="deletingId === item.id" @click="removeItem(item.id)">删除</button>
              </span>
            </div>
            <div v-if="expandedId === item.id" class="row-detail">
              <div class="detail-grid">
                <span>任务 ID：{{ item.id }}</span>
                <span>份数：{{ item.copies }}</span>
                <span v-if="item.renderMode">渲染：{{ item.renderMode }}</span>
                <span v-if="item.bytesWritten != null">字节：{{ item.bytesWritten }}</span>
                <span v-if="item.errorCode">错误码：{{ item.errorCode }}</span>
                <span v-if="item.snapshotTruncated">快照已截断（体积超限）</span>
              </div>
              <div v-if="item.message" class="detail-message">{{ item.message }}</div>
            </div>
          </div>
        </div>

        <div v-if="reprintResult" class="reprint-result" :class="reprintResult.ok ? 'ok' : 'error'">
          {{ reprintResult.message }}
        </div>
      </div>

      <footer class="dialog-footer">
        <button class="btn" @click="close">关闭</button>
      </footer>
    </div>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createAgentClient } from '../client/agentClient'
import type { HPrintHistoryDetail, HPrintHistoryEntry, HPrintPrintUsage } from '../core/types'

const props = withDefaults(defineProps<{
  modelValue: boolean
  agentUrl?: string
  agentToken?: string
}>(), {
  agentUrl: '',
  agentToken: '',
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'reprinted', item: HPrintHistoryEntry): void
}>()

const loading = ref(false)
const error = ref('')
const history = ref<HPrintHistoryEntry[]>([])
const filter = ref<'all' | 'printed' | 'failed'>('all')
const expandedId = ref('')
const reprintingId = ref('')
const deletingId = ref('')
const reprintResult = ref<{ ok: boolean; message: string } | null>(null)

const filteredHistory = computed(() => {
  if (filter.value === 'all') return history.value
  return history.value.filter((item) => item.status === filter.value)
})

function getClient() {
  return createAgentClient({
    agentUrl: props.agentUrl || undefined,
    token: props.agentToken || undefined,
  })
}

async function loadHistory() {
  loading.value = true
  error.value = ''
  try {
    const result = await getClient().getPrintHistory(200)
    history.value = result.history || []
  } catch (err) {
    error.value = (err as Error).message || '加载打印历史失败'
  } finally {
    loading.value = false
  }
}

function toggleExpand(id: string) {
  expandedId.value = expandedId.value === id ? '' : id
}

async function reprint(item: HPrintHistoryEntry) {
  if (reprintingId.value) return
  reprintingId.value = item.id
  reprintResult.value = null
  try {
    const client = getClient()
    const detail: HPrintHistoryDetail = await client.getPrintHistoryItem(item.id)
    if (!detail.template) {
      throw new Error('该记录没有模板快照，无法重打')
    }
    const result = await client.printAndWait({
      template: detail.template,
      data: detail.data || {},
      printerName: detail.printerName || undefined,
      copies: detail.copies || 1,
      usage: (detail.usage || undefined) as HPrintPrintUsage | undefined,
    })
    const ok = result.status === 'printed'
    reprintResult.value = {
      ok,
      message: ok
        ? `重打成功：${detail.templateName || detail.documentName} → ${detail.printerName}`
        : `重打失败：${result.message || result.status}`,
    }
    emit('reprinted', item)
    await loadHistory()
  } catch (err) {
    reprintResult.value = { ok: false, message: `重打失败：${(err as Error).message}` }
  } finally {
    reprintingId.value = ''
  }
}

async function removeItem(id: string) {
  if (deletingId.value) return
  deletingId.value = id
  try {
    await getClient().deletePrintHistoryItem(id)
    await loadHistory()
  } catch (err) {
    error.value = (err as Error).message || '删除失败'
  } finally {
    deletingId.value = ''
  }
}

async function clearAll() {
  if (!window.confirm('确定清空全部打印历史？（含模板/数据快照，不可恢复）')) return
  try {
    await getClient().clearPrintHistory()
    await loadHistory()
  } catch (err) {
    error.value = (err as Error).message || '清空失败'
  }
}

function formatTime(iso: string): string {
  const date = new Date(iso)
  if (Number.isNaN(date.getTime())) return iso
  const pad = (n: number) => String(n).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function formatMode(item: HPrintHistoryEntry): string {
  const parts = [item.usage, item.renderMode].filter(Boolean)
  return parts.length ? parts.join(' · ') : '-'
}

function close() {
  emit('update:modelValue', false)
}

watch(
  () => props.modelValue,
  (open) => {
    if (open) {
      reprintResult.value = null
      expandedId.value = ''
      loadHistory()
    }
  },
)
</script>

<style scoped>
.history-mask {
  position: fixed;
  inset: 0;
  background: rgba(0, 0, 0, 0.35);
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 2000;
}
.history-dialog {
  width: 860px;
  max-width: calc(100vw - 40px);
  max-height: calc(100vh - 80px);
  background: #fff;
  border-radius: 8px;
  display: flex;
  flex-direction: column;
  overflow: hidden;
  box-shadow: 0 12px 40px rgba(0, 0, 0, 0.18);
}
.dialog-header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}
.dialog-header h3 {
  margin: 0;
  font-size: 16px;
}
.close-btn {
  border: none;
  background: transparent;
  font-size: 15px;
  cursor: pointer;
  color: #666;
}
.dialog-body {
  flex: 1;
  overflow-y: auto;
  padding: 14px 18px;
}
.dialog-footer {
  padding: 12px 18px;
  border-top: 1px solid #e5e7eb;
  display: flex;
  justify-content: flex-end;
}
.toolbar {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 10px;
}
.filter-group {
  display: flex;
  gap: 6px;
}
.filter-btn {
  padding: 4px 12px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 12px;
}
.filter-btn.active {
  background: #409eff;
  border-color: #409eff;
  color: #fff;
}
.toolbar-right {
  display: flex;
  align-items: center;
  gap: 8px;
}
.count-text {
  font-size: 12px;
  color: #909399;
}
.btn {
  padding: 6px 16px;
  border: 1px solid #dcdfe6;
  border-radius: 4px;
  background: #fff;
  cursor: pointer;
  font-size: 13px;
}
.btn:disabled {
  opacity: 0.5;
  cursor: not-allowed;
}
.btn-sm {
  padding: 4px 10px;
  font-size: 12px;
}
.btn.danger,
.link-btn.danger {
  color: #d0021b;
}
.state-text {
  padding: 30px 0;
  text-align: center;
  color: #909399;
  font-size: 13px;
}
.state-text.error {
  color: #d0021b;
}
.history-list {
  border: 1px solid #e5e7eb;
  border-radius: 6px;
  overflow: hidden;
}
.history-head,
.row-main {
  display: grid;
  grid-template-columns: 110px 1.4fr 1.4fr 110px 64px 110px;
  gap: 8px;
  align-items: center;
  padding: 8px 12px;
  font-size: 12px;
}
.history-head {
  background: #f5f7fa;
  color: #606266;
  font-weight: bold;
}
.history-row {
  border-top: 1px solid #eef1f6;
}
.history-row:first-child {
  border-top: none;
}
.row-main {
  cursor: pointer;
}
.history-row.expanded .row-main {
  background: #f0f7ff;
}
.row-main > span {
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
}
.status-badge {
  display: inline-block;
  padding: 2px 8px;
  border-radius: 10px;
  font-size: 11px;
}
.status-badge.printed {
  background: #e8f7ee;
  color: #1a9e55;
}
.status-badge.failed {
  background: #fdecec;
  color: #d0021b;
}
.link-btn {
  border: none;
  background: transparent;
  color: #409eff;
  cursor: pointer;
  font-size: 12px;
  padding: 2px 4px;
}
.link-btn:disabled {
  color: #c0c4cc;
  cursor: not-allowed;
}
.row-detail {
  padding: 10px 12px 12px;
  background: #fafbfd;
  border-top: 1px dashed #e5e7eb;
  font-size: 12px;
  color: #606266;
}
.detail-grid {
  display: flex;
  flex-wrap: wrap;
  gap: 6px 18px;
}
.detail-message {
  margin-top: 6px;
  color: #d0021b;
}
.reprint-result {
  margin-top: 10px;
  padding: 8px 12px;
  border-radius: 4px;
  font-size: 12px;
}
.reprint-result.ok {
  background: #e8f7ee;
  color: #1a9e55;
}
.reprint-result.error {
  background: #fdecec;
  color: #d0021b;
}
</style>
