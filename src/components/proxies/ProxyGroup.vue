<template>
  <CollapseCard
    :name="proxyGroup.name"
    :data-group-name="proxyGroup.name"
    @contextmenu.prevent.stop="handlerLatencyTest"
  >
    <template v-slot:title>
      <div class="relative flex items-center gap-2">
        <div class="flex flex-1 items-center gap-1">
          <ProxyName
            :name="name"
            :icon-size="proxyGroupIconSize"
            :icon-margin="proxyGroupIconMargin"
            :highlight-query="proxiesFilter"
          />
          <span class="text-base-content/60 text-xs">
            : {{ proxyGroup.type }} ({{ proxiesCount }})
          </span>
          <button
            v-if="manageHiddenGroup"
            class="btn btn-circle btn-xs z-10 ml-1"
            @click.stop="handlerGroupToggle"
          >
            <EyeIcon
              v-if="!hiddenGroup"
              class="h-3 w-3"
            />
            <EyeSlashIcon
              v-else
              class="h-3 w-3"
            />
          </button>
        </div>
        <LatencyTag
          :class="twMerge('bg-base-200/50 hover:bg-base-200 z-10')"
          :loading="isLatencyTesting"
          :name="proxyGroup.now"
          :group-name="proxyGroup.name"
          @click.stop="handlerLatencyTest"
        />
      </div>
      <div class="text-base-content/80 mt-1.5 flex items-center gap-2">
        <div class="flex flex-1 items-center gap-2 truncate text-sm">
          <ProxyGroupNow :name="name" />
        </div>
        <button
          v-if="isStrategyGroup"
          class="btn btn-xs btn-ghost shrink-0"
          @click.stop="toggleRuleShortcut"
        >
          {{ $t('ruleShortcut') }}
        </button>
        <button
          v-if="isStrategyGroup"
          class="btn btn-xs btn-ghost shrink-0"
          @click.stop="openRulesShortcut"
        >
          {{ $t('goToRules') }}
        </button>
        <div class="min-w-12 shrink-0 text-right text-xs">
          {{ prettyBytesHelper(downloadTotal) }}/s
        </div>
      </div>
      <div
        v-if="isStrategyGroup && isRuleShortcutOpen"
        class="bg-base-200/40 mt-2 rounded-lg p-2"
      >
        <div class="text-base-content/70 mb-1 text-[11px]">
          {{ $t('fullChain') }}
        </div>
        <div class="flex flex-wrap items-center gap-1">
          <template
            v-for="(chain, index) in proxyChains"
            :key="`${proxyGroup.name}-${chain}-${index}`"
          >
            <span
              v-if="index > 0"
              class="text-base-content/50 text-xs"
            >
              →
            </span>
            <button
              class="badge badge-sm border-base-content/20"
              :class="chain === name ? 'badge-neutral text-neutral-content' : 'badge-ghost'"
              @click.stop="handleChainClick(chain)"
            >
              <HighlightedText
                :text="chain"
                :query="proxiesFilter"
                :mark-class="
                  chain === name
                    ? 'bg-primary-content/20 text-primary-content rounded-[4px] px-1 py-[1px] font-medium'
                    : 'bg-warning/20 text-warning-content rounded-[4px] px-1 py-[1px] font-medium'
                "
              />
            </button>
          </template>
          <template v-if="finalProviderName">
            <span
              v-if="proxyChains.length > 0"
              class="text-base-content/50 text-xs"
            >
              →
            </span>
            <span class="badge badge-sm badge-outline border-base-content/20">
              {{ $t('proxyProvider') }}:
              <span class="ml-1">
                <HighlightedText
                  :text="finalProviderName"
                  :query="proxiesFilter"
                />
              </span>
            </span>
          </template>
        </div>
      </div>
    </template>
    <template v-slot:preview>
      <ProxyPreview
        :nodes="renderProxies"
        :now="proxyGroup.now"
        :groupName="proxyGroup.name"
        @nodeclick="handlerProxySelect(name, $event)"
      />
    </template>
    <template v-slot:content>
      <Component
        :is="groupProxiesByProvider ? ProxiesByProvider : ProxiesContent"
        :name="name"
        :now="proxyGroup.now"
        :render-proxies="renderProxies"
      />
    </template>
  </CollapseCard>
</template>

<script setup lang="ts">
import { useBounceOnVisible } from '@/composables/bouncein'
import { skipNextProxiesTabRestore } from '@/composables/proxies'
import { useRenderProxies } from '@/composables/renderProxies'
import { PROXY_TAB_TYPE, ROUTE_NAME, RULE_TAB_TYPE } from '@/constant'
import { isHiddenGroup } from '@/helper'
import { prettyBytesHelper, scrollToGroup } from '@/helper/utils'
import { activeConnections } from '@/store/connections'
import {
  getNowProxyNodeName,
  getProxyGroupChains,
  handlerProxySelect,
  hiddenGroupMap,
  proxiesFilter,
  proxiesTabShow,
  proxyGroupLatencyTest,
  proxyGroupList,
  proxyMap,
  proxyNodeProviderMap,
} from '@/store/proxies'
import { rulesFilter, rulesTabShow } from '@/store/rules'
import {
  collapseGroupMap,
  groupProxiesByProvider,
  manageHiddenGroup,
  proxyGroupIconMargin,
  proxyGroupIconSize,
} from '@/store/settings'
import { EyeIcon, EyeSlashIcon } from '@heroicons/vue/24/outline'
import { twMerge } from 'tailwind-merge'
import { computed, nextTick, ref } from 'vue'
import { useRouter } from 'vue-router'
import CollapseCard from '../common/CollapseCard.vue'
import HighlightedText from '../common/HighlightedText.vue'
import LatencyTag from './LatencyTag.vue'
import ProxiesByProvider from './ProxiesByProvider.vue'
import ProxiesContent from './ProxiesContent.vue'
import ProxyGroupNow from './ProxyGroupNow.vue'
import ProxyName from './ProxyName.vue'
import ProxyPreview from './ProxyPreview.vue'

const props = defineProps<{
  name: string
}>()
const router = useRouter()
const proxyGroup = computed(() => proxyMap.value[props.name])
const allProxies = computed(() => proxyGroup.value.all ?? [])
const { proxiesCount, renderProxies } = useRenderProxies(allProxies, props.name)
const isLatencyTesting = ref(false)
const handlerLatencyTest = async () => {
  if (isLatencyTesting.value) return

  isLatencyTesting.value = true
  try {
    await proxyGroupLatencyTest(props.name)
    isLatencyTesting.value = false
  } catch {
    isLatencyTesting.value = false
  }
}
const downloadTotal = computed(() => {
  const speed = activeConnections.value
    .filter((conn) => conn.chains.includes(props.name))
    .reduce((total, conn) => total + conn.downloadSpeed, 0)

  return speed
})

const hiddenGroup = computed({
  get: () => isHiddenGroup(props.name),
  set: (value: boolean) => {
    hiddenGroupMap.value[props.name] = value
  },
})

const handlerGroupToggle = () => {
  hiddenGroup.value = !hiddenGroup.value
}

const STRATEGY_PROXY_TYPES = new Set(['selector', 'urltest', 'fallback', 'loadbalance', 'smart'])
const isRuleShortcutOpen = ref(false)
const isStrategyGroup = computed(() => {
  return STRATEGY_PROXY_TYPES.has(proxyGroup.value.type.toLowerCase())
})
const proxyChains = computed(() => {
  if (!isStrategyGroup.value) {
    return []
  }

  return getProxyGroupChains(props.name)
})
const finalProviderName = computed(() => {
  const finalNodeName = getNowProxyNodeName(props.name)
  const finalNode = proxyMap.value[finalNodeName]

  if (!finalNode) {
    return ''
  }

  if (finalNode['provider-name']) {
    return finalNode['provider-name']
  }

  return proxyNodeProviderMap.value[finalNode.name] ?? ''
})

const toggleRuleShortcut = () => {
  isRuleShortcutOpen.value = !isRuleShortcutOpen.value
}

const handleChainClick = async (chain: string) => {
  if (chain === props.name) {
    return
  }

  if (!proxyGroupList.value.includes(chain)) {
    return
  }

  collapseGroupMap.value[chain] = true
  skipNextProxiesTabRestore.value = true

  proxiesTabShow.value = PROXY_TAB_TYPE.NODE
  await nextTick()
  const nodeTarget = document.querySelector(`[data-group-name="${chain}"]`)

  if (nodeTarget) {
    scrollToGroup(chain)
    return
  }

  proxiesTabShow.value = PROXY_TAB_TYPE.STRATEGY
  await nextTick()
  scrollToGroup(chain)
}

const openRulesShortcut = () => {
  rulesTabShow.value = RULE_TAB_TYPE.RULES
  rulesFilter.value = props.name
  router.push({ name: ROUTE_NAME.rules })
}

useBounceOnVisible()
</script>
