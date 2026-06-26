<template>
  <div class="flex shrink-0 items-center">
    <ProxyIcon
      v-if="icon"
      :icon="icon"
      :margin="iconMargin"
      :size="iconSize"
    />
    <HighlightedText
      :text="name"
      :query="highlightQuery"
    />
    <template v-if="dialerProxy"> ({{ dialerProxy }}) </template>
  </div>
</template>

<script setup lang="ts">
import { proxyMap } from '@/store/proxies'
import { computed } from 'vue'
import HighlightedText from '../common/HighlightedText.vue'
import ProxyIcon from './ProxyIcon.vue'

const props = withDefaults(
  defineProps<{
    name: string
    iconSize?: number
    iconMargin?: number
    highlightQuery?: string
  }>(),
  {
    iconSize: 16,
    iconMargin: 4,
    highlightQuery: '',
  },
)

const node = computed(() => proxyMap.value[props.name])
const icon = computed(() => {
  return node.value?.icon
})
const dialerProxy = computed(() => {
  return node.value?.['dialer-proxy']
})
</script>
