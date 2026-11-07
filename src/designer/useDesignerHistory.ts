import { computed, ref } from 'vue'
import type { HPrintComponent, HPrintPaper } from '../core/types'

export interface DesignerHistoryState {
  paper: HPrintPaper
  components: HPrintComponent[]
  selectedId: string | null
  selectedIds?: string[]
}

const DEFAULT_LIMIT = 80

function cloneState(state: DesignerHistoryState): DesignerHistoryState {
  return JSON.parse(JSON.stringify(state))
}

function stateEquals(a: DesignerHistoryState, b: DesignerHistoryState): boolean {
  return JSON.stringify(a) === JSON.stringify(b)
}

export function useDesignerHistory(limit = DEFAULT_LIMIT) {
  const past = ref<DesignerHistoryState[]>([])
  const future = ref<DesignerHistoryState[]>([])
  const transactionStart = ref<DesignerHistoryState | null>(null)

  const canUndo = computed(() => past.value.length > 0)
  const canRedo = computed(() => future.value.length > 0)

  function pushPast(state: DesignerHistoryState) {
    const snapshot = cloneState(state)
    const previous = past.value[past.value.length - 1]
    if (previous && stateEquals(previous, snapshot)) return
    past.value.push(snapshot)
    if (past.value.length > limit) {
      past.value.shift()
    }
  }

  function record(current: DesignerHistoryState) {
    if (transactionStart.value) return
    pushPast(current)
    future.value = []
  }

  function beginTransaction(current: DesignerHistoryState) {
    if (transactionStart.value) return
    transactionStart.value = cloneState(current)
  }

  function commitTransaction(current: DesignerHistoryState) {
    if (!transactionStart.value) return
    if (!stateEquals(transactionStart.value, current)) {
      pushPast(transactionStart.value)
      future.value = []
    }
    transactionStart.value = null
  }

  function cancelTransaction() {
    transactionStart.value = null
  }

  function undo(current: DesignerHistoryState): DesignerHistoryState | null {
    const previous = past.value.pop()
    if (!previous) return null
    future.value.push(cloneState(current))
    return cloneState(previous)
  }

  function redo(current: DesignerHistoryState): DesignerHistoryState | null {
    const next = future.value.pop()
    if (!next) return null
    past.value.push(cloneState(current))
    return cloneState(next)
  }

  function reset() {
    past.value = []
    future.value = []
    transactionStart.value = null
  }

  return {
    canUndo,
    canRedo,
    record,
    beginTransaction,
    commitTransaction,
    cancelTransaction,
    undo,
    redo,
    reset,
  }
}
