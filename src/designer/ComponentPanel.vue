<template>
  <aside class="component-panel">
    <div class="panel-header">
      <span class="panel-title">组件</span>
    </div>
    <div class="panel-body">
      <div class="component-group">
        <div class="group-title">基础组件</div>
        <div class="component-grid">
          <div
            v-for="item in baseComponents"
            :key="item.type"
            class="component-item"
            draggable="true"
            @dragstart="onDragStart($event, item.type)"
            @click="$emit('addComponent', item.type)"
          >
            <span class="item-icon">{{ item.icon }}</span>
            <span class="item-name">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <div class="component-group">
        <div class="group-title">数据组件</div>
        <div class="component-grid">
          <div
            v-for="item in dataComponents"
            :key="item.type"
            class="component-item"
            draggable="true"
            @dragstart="onDragStart($event, item.type)"
            @click="$emit('addComponent', item.type)"
          >
            <span class="item-icon">{{ item.icon }}</span>
            <span class="item-name">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <div class="component-group">
        <div class="group-title">条码组件</div>
        <div class="component-grid">
          <div
            v-for="item in barcodeComponents"
            :key="item.type"
            class="component-item"
            draggable="true"
            @dragstart="onDragStart($event, item.type)"
            @click="$emit('addComponent', item.type)"
          >
            <span class="item-icon">{{ item.icon }}</span>
            <span class="item-name">{{ item.name }}</span>
          </div>
        </div>
      </div>

      <div class="component-group">
        <div class="group-title">页面组件</div>
        <div class="component-grid">
          <div
            v-for="item in pageComponents"
            :key="item.type"
            class="component-item"
            draggable="true"
            @dragstart="onDragStart($event, item.type)"
            @click="$emit('addComponent', item.type)"
          >
            <span class="item-icon">{{ item.icon }}</span>
            <span class="item-name">{{ item.name }}</span>
          </div>
        </div>
      </div>
    </div>
  </aside>
</template>

<script setup lang="ts">
defineEmits<{
  (e: 'addComponent', type: string): void
}>()

const baseComponents = [
  { type: 'text', name: '文本', icon: '📝' },
  { type: 'line', name: '线条', icon: '─' },
  { type: 'rect', name: '矩形', icon: '▭' },
  { type: 'ellipse', name: '椭圆', icon: '◯' },
  { type: 'image', name: '图片', icon: '🖼' },
]

const dataComponents = [
  { type: 'table', name: '表格', icon: '📊' },
]

const barcodeComponents = [
  { type: 'qrcode', name: '二维码', icon: '⊞' },
  { type: 'barcode', name: '条码', icon: '▮' },
]

const pageComponents = [
  { type: 'page-header', name: '页眉', icon: '⌃' },
  { type: 'page-footer', name: '页脚', icon: '⌄' },
  { type: 'page-number', name: '页码', icon: '#' },
  { type: 'watermark', name: '水印', icon: '◇' },
]

function onDragStart(e: DragEvent, type: string) {
  e.dataTransfer?.setData('component-type', type)
  e.dataTransfer!.effectAllowed = 'copy'
}
</script>

<style scoped>
.component-panel {
  width: 200px;
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
  overflow-y: auto;
  padding: 12px;
}
.component-group {
  margin-bottom: 16px;
}
.group-title {
  font-size: 12px;
  color: #999;
  padding-left: 4px;
  margin-bottom: 8px;
}
.component-grid {
  display: grid;
  grid-template-columns: repeat(2, 1fr);
  gap: 8px;
}
.component-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 10px 8px;
  background: #f5f7fa;
  border: 1px solid #e8e8e8;
  border-radius: 4px;
  cursor: grab;
  transition: all 0.2s;
  user-select: none;
}
.component-item:hover {
  background: #ecf5ff;
  border-color: #409eff;
}
.component-item:active {
  cursor: grabbing;
}
.item-icon {
  font-size: 20px;
  margin-bottom: 4px;
}
.item-name {
  font-size: 12px;
  color: #666;
}
</style>
