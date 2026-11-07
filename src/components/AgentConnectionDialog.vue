<template>
  <div v-if="modelValue" class="agent-mask" @click.self="close">
    <section class="agent-dialog" role="dialog" aria-modal="true">
      <header class="dialog-header">
        <h2>连接 HPrint Agent</h2>
        <button class="icon-button" type="button" aria-label="关闭" @click="close">×</button>
      </header>

      <div class="dialog-body">
        <div class="status-card" :class="status">
          <span class="status-dot"></span>
          <div>
            <strong>{{ statusTitle }}</strong>
            <p>{{ statusMessage }}</p>
          </div>
        </div>

        <dl class="info-list">
          <div>
            <dt>连接地址</dt>
            <dd>{{ agentUrl }}</dd>
          </div>
          <div>
            <dt>启动协议</dt>
            <dd>{{ launchProtocol }}</dd>
          </div>
        </dl>

        <div v-if="lastError" class="alert">{{ lastError }}</div>

        <div class="actions">
          <a class="button" :href="downloadUrl" target="_blank" rel="noreferrer">
            下载 Agent
          </a>
          <button class="button" type="button" @click="launchAgent">
            启动 Agent
          </button>
          <button class="button primary" type="button" :disabled="checking" @click="check">
            {{ checking ? '检测中...' : '重新检测' }}
          </button>
        </div>
      </div>

      <footer class="dialog-footer">
        <p>Agent 启动后会在本机提供打印能力，业务页面只通过本地地址提交打印任务。</p>
      </footer>
    </section>
  </div>
</template>

<script setup lang="ts">
import { computed, ref, watch } from 'vue'
import { createAgentClient } from '../client/agentClient'
import { describeAgentError } from '../client/errors'
import type { HealthResponse } from '../client/agentClient'

const props = withDefaults(defineProps<{
  modelValue: boolean
  agentUrl?: string
  agentToken?: string
  downloadUrl?: string
  launchProtocol?: string
  autoCheck?: boolean
}>(), {
  agentUrl: 'http://127.0.0.1:17878',
  agentToken: '',
  downloadUrl: '#',
  launchProtocol: 'hprint-v2://start',
  autoCheck: true,
})

const emit = defineEmits<{
  (event: 'update:modelValue', value: boolean): void
  (event: 'online', value: HealthResponse): void
  (event: 'offline', value: string): void
  (event: 'launch'): void
}>()

const checking = ref(false)
const online = ref(false)
const lastError = ref('')

const status = computed(() => {
  if (checking.value) return 'checking'
  return online.value ? 'online' : 'offline'
})

const statusTitle = computed(() => {
  if (status.value === 'checking') return '正在检测 Agent'
  if (status.value === 'online') return 'Agent 已连接'
  return 'Agent 未连接'
})

const statusMessage = computed(() => {
  if (status.value === 'checking') return '正在检查本机 Agent 服务是否可用。'
  if (status.value === 'online') return '本机 Agent 已就绪，可以继续打印。'
  return '请先安装并启动 HPrint Agent，然后重新检测。'
})

watch(
  () => props.modelValue,
  (visible) => {
    if (visible && props.autoCheck) {
      check()
    }
  },
)

function close() {
  emit('update:modelValue', false)
}

async function check() {
  checking.value = true
  lastError.value = ''
  try {
    const client = createAgentClient({ agentUrl: props.agentUrl, token: props.agentToken || undefined })
    const result = await client.health()
    online.value = true
    emit('online', result)
  } catch (err) {
    online.value = false
    lastError.value = describeAgentError(err, props.agentUrl)
    emit('offline', lastError.value)
  } finally {
    checking.value = false
  }
}

function launchAgent() {
  emit('launch')
  if (typeof window !== 'undefined') {
    window.location.href = props.launchProtocol
  }
}
</script>

<style scoped>
.agent-mask {
  position: fixed;
  inset: 0;
  z-index: 2100;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 24px;
  background: rgba(15, 23, 42, 0.45);
}

.agent-dialog {
  width: min(520px, 100%);
  overflow: hidden;
  border-radius: 8px;
  background: #fff;
  box-shadow: 0 18px 48px rgba(15, 23, 42, 0.22);
}

.dialog-header,
.dialog-footer {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 14px 18px;
  border-bottom: 1px solid #e5e7eb;
}

.dialog-footer {
  border-top: 1px solid #e5e7eb;
  border-bottom: none;
}

.dialog-footer p,
.status-card p {
  margin: 0;
  color: #64748b;
  line-height: 1.5;
}

.dialog-header h2 {
  margin: 0;
  font-size: 16px;
}

.icon-button {
  width: 30px;
  height: 30px;
  border: none;
  border-radius: 4px;
  background: transparent;
  cursor: pointer;
  font-size: 20px;
}

.icon-button:hover {
  background: #f1f5f9;
}

.dialog-body {
  display: grid;
  gap: 14px;
  padding: 18px;
}

.status-card {
  display: flex;
  gap: 10px;
  padding: 12px;
  border: 1px solid #fde68a;
  border-radius: 6px;
  background: #fffbeb;
}

.status-card.online {
  border-color: #bbf7d0;
  background: #f0fdf4;
}

.status-card.checking {
  border-color: #bfdbfe;
  background: #eff6ff;
}

.status-dot {
  width: 10px;
  height: 10px;
  margin-top: 5px;
  border-radius: 50%;
  background: #f59e0b;
}

.online .status-dot {
  background: #22c55e;
}

.checking .status-dot {
  background: #3b82f6;
}

.info-list {
  display: grid;
  gap: 8px;
  margin: 0;
}

.info-list div {
  display: grid;
  grid-template-columns: 76px 1fr;
  gap: 10px;
}

.info-list dt {
  color: #64748b;
}

.info-list dd {
  margin: 0;
  font-family: Consolas, Monaco, monospace;
  word-break: break-all;
}

.alert {
  padding: 10px 12px;
  border: 1px solid #fecaca;
  border-radius: 6px;
  background: #fef2f2;
  color: #b91c1c;
}

.actions {
  display: flex;
  justify-content: flex-end;
  gap: 8px;
}

.button {
  height: 34px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  padding: 0 14px;
  border: 1px solid #cbd5e1;
  border-radius: 4px;
  background: #fff;
  color: #1f2937;
  cursor: pointer;
  text-decoration: none;
}

.button.primary {
  border-color: #2563eb;
  background: #2563eb;
  color: #fff;
}

.button:disabled {
  cursor: not-allowed;
  opacity: 0.6;
}
</style>
