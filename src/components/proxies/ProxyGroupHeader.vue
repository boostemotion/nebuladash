<template>
  <div class="relative flex w-full items-center gap-2.5 overflow-hidden">
    <ProxyName
      :name="name"
      :icon-size="proxyGroupIconSize"
      :icon-margin="proxyGroupIconMargin"
      class="text-base-content"
    />
    <span
      class="text-base-content/40 min-w-0 flex-1 truncate text-[11px] tracking-wider uppercase tabular-nums"
      @mouseenter="checkTruncation"
    >
      {{ proxyGroup.type }} · {{ proxiesCount }}
    </span>
    <!-- NebulaDash: 规则直通——展开完整链路（含最终代理商）并提供跳转规则 -->
    <button
      v-if="isStrategyGroup"
      class="btn btn-xs btn-ghost shrink-0"
      data-proxy-rule-shortcut
      @click.stop="openChain"
    >
      {{ $t('ruleShortcut') }}
    </button>
    <ProxyGroupFilter :group-name="name" />
    <VisibilityToggle
      v-if="manageHiddenGroup"
      :hidden="hiddenGroup"
      @mouseenter="showVisibilityTip"
      @toggle="handlerGroupToggle"
    />
    <LatencyTag
      :class="twMerge('bg-base-200/40 hover:bg-base-200/70')"
      :loading="isLatencyTesting"
      :name="proxyGroup.now"
      :group-name="proxyGroup.name"
      @click.stop="emit('latency-test')"
    />
  </div>
  <div class="text-base-content/70 mt-2 flex items-center gap-2">
    <div class="flex flex-1 items-center gap-2 truncate text-sm">
      <ProxyGroupNow :name="name" />
    </div>
    <div class="text-base-content/40 min-w-12 shrink-0 text-right text-xs tabular-nums">
      {{ prettyBytesHelper(downloadTotal) }}/s
    </div>
  </div>
</template>

<script setup lang="ts">
import { hiddenGroupMap } from '@/store/proxies'
import { useKeyboardShortcuts } from '@/composables/use-keyboard'
import { KEYBOARD_SHORTCUT_ACTION } from '@/helper/keyboard'
import { getDownloadSpeedByProxyGroup } from '@/helper/proxy-group-traffic'
import { isHiddenGroup } from '@/helper'
import { checkTruncation } from '@/helper/tooltip'
import { useTooltip } from '@/composables/use-tooltip'
import { prettyBytesHelper } from '@/helper/utils'
import { proxyMap } from '@/assembly/proxies'
import {
  manageHiddenGroup,
  proxyGroupIconMargin,
  proxyGroupIconSize,
} from '@/store/settings'
import { openProxyGroupChain } from '@/helper/proxy-group-chain'
import { twMerge } from 'tailwind-merge'
import { computed } from 'vue'
import { isProxyStrategyGroup } from '@/helper/node-group-cluster'
import { useI18n } from 'vue-i18n'
import VisibilityToggle from '../common/VisibilityToggle.vue'
import LatencyTag from './LatencyTag.vue'
import ProxyGroupFilter from './ProxyGroupFilter.vue'
import ProxyGroupNow from './ProxyGroupNow.vue'
import ProxyName from './ProxyName.vue'

const props = defineProps<{
  name: string
  proxiesCount: string
  isLatencyTesting: boolean
}>()

const emit = defineEmits<{
  'latency-test': []
}>()

const { t } = useI18n()
const { getShortcutKey } = useKeyboardShortcuts()
const { showTip } = useTooltip()

/** NebulaDash: 只有策略组卡片才提供“规则直通”。 */
const isStrategyGroup = computed(() => isProxyStrategyGroup(proxyMap.value[props.name]?.type))
const openChain = () => openProxyGroupChain(props.name)
const proxyGroup = computed(() => proxyMap.value[props.name])

const downloadTotal = computed(() => getDownloadSpeedByProxyGroup(props.name))

const hiddenGroup = computed({
  get: () => Boolean(isHiddenGroup(props.name)),
  set: (value: boolean) => {
    hiddenGroupMap.value[props.name] = value
  },
})

const visibilityToggleTip = computed(() => {
  const title = t(hiddenGroup.value ? 'showProxyGroup' : 'hideProxyGroup')
  const shortcut = getShortcutKey(KEYBOARD_SHORTCUT_ACTION.TOGGLE_MANAGE_HIDDEN_GROUP)

  return shortcut ? `${title}\n${t('manageHiddenGroupShortcutTip', { shortcut })}` : title
})

const showVisibilityTip = (e: Event) => {
  showTip(e, visibilityToggleTip.value, {
    delay: [500, 0],
    trigger: 'mouseenter',
    touch: ['hold', 500],
  })
}

const handlerGroupToggle = () => {
  hiddenGroup.value = !hiddenGroup.value
}
</script>
