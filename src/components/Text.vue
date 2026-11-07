<template>
  <div class="text-component" :style="componentStyle">
    {{ boundContent }}
  </div>
</template>

<script setup lang="ts">
import { computed } from 'vue'
import type { TextOptions } from '@/core/types'
import { bindTemplate } from '@/core/binding'

const props = withDefaults(defineProps<TextOptions>(), {
  content: '',
  fontSize: 14,
  color: '#000000',
  fontFamily: 'Arial',
  fontWeight: 'normal',
  textAlign: 'left',
  lineHeight: 18,
  whiteSpace: 'pre-wrap',
  overflow: 'hidden',
  maxLines: 0,
  data: () => ({})
})

const boundContent = computed(() => {
  return bindTemplate(props.content, props.data)
})

const componentStyle = computed<Record<string, string>>(() => ({
  fontSize: `${props.fontSize}px`,
  lineHeight: `${props.lineHeight || Math.round((props.fontSize || 14) * 1.2)}px`,
  color: props.color,
  fontFamily: props.fontFamily,
  fontWeight: props.fontWeight,
  textAlign: props.textAlign,
  width: '100%',
  height: '100%',
  display: props.maxLines && props.maxLines > 0 ? '-webkit-box' : 'block',
  WebkitLineClamp: props.maxLines && props.maxLines > 0 ? String(props.maxLines) : 'unset',
  WebkitBoxOrient: props.maxLines && props.maxLines > 0 ? 'vertical' : 'unset',
  whiteSpace: props.whiteSpace || 'pre-wrap',
  wordBreak: 'break-word',
  overflow: props.overflow === 'visible' ? 'visible' : 'hidden',
  textOverflow: props.overflow === 'ellipsis' ? 'ellipsis' : 'clip',
  padding: '2px',
  boxSizing: 'border-box'
}))
</script>
