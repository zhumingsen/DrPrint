<template>
  <div class="ellipse-component" :style="componentStyle"></div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { RectOptions } from '@/core/types'

const props = withDefaults(defineProps<RectOptions>(), {
  backgroundColor: 'transparent',
  borderColor: '#000000',
  borderWidth: 1,
  borderStyle: 'solid',
})

const componentStyle = computed(() => ({
  backgroundColor: props.backgroundColor,
  border: `${props.borderWidth}px ${props.borderStyle || 'solid'} ${props.borderColor}`,
  borderRadius: '50%',
  width: '100%',
  height: '100%',
}))
</script>
