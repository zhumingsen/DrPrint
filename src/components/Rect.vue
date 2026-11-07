<template>
  <div class="rect-component" :style="componentStyle"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RectOptions } from '@/core/types'

const props = withDefaults(defineProps<RectOptions>(), {
  backgroundColor: 'transparent',
  borderColor: '#000000',
  borderWidth: 1,
  borderStyle: 'solid',
  borderRadius: 0
})

const componentStyle = computed(() => ({
  backgroundColor: props.backgroundColor,
  border: `${props.borderWidth}px ${props.borderStyle || 'solid'} ${props.borderColor}`,
  borderRadius: `${props.borderRadius}px`,
  width: '100%',
  height: '100%'
}))
</script>
