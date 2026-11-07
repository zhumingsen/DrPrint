<template>
  <div class="line-component" :style="componentStyle"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { LineOptions } from '@/core/types'

const props = withDefaults(defineProps<LineOptions>(), {
  color: '#000000',
  lineWidth: 1,
  lineStyle: 'solid',
  direction: 'horizontal'
})

const componentStyle = computed(() => ({
  width: '100%',
  height: '100%',
  borderBottom: props.direction === 'horizontal' ? `${props.lineWidth}px ${props.lineStyle || 'solid'} ${props.color}` : 'none',
  borderRight: props.direction === 'vertical' ? `${props.lineWidth}px ${props.lineStyle || 'solid'} ${props.color}` : 'none'
}))
</script>
