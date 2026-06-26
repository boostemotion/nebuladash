<template>
  <span>
    <template
      v-for="(part, index) in parts"
      :key="`${part.text}-${index}-${part.matched ? '1' : '0'}`"
    >
      <mark
        v-if="part.matched"
        :class="markClass"
      >
        {{ part.text }}
      </mark>
      <template v-else>{{ part.text }}</template>
    </template>
  </span>
</template>

<script setup lang="ts">
import { buildHighlightedParts } from '@/helper/search'
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    text: string
    query?: string
    markClass?: string
  }>(),
  {
    query: '',
    markClass:
      'bg-warning/20 text-warning-content rounded-[4px] px-1 py-[1px] font-medium decoration-transparent',
  },
)

const parts = computed(() => buildHighlightedParts(props.text, props.query))
</script>
