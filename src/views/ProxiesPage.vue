<template>
  <div
    class="max-md:scrollbar-hidden h-full"
    :class="disableProxiesPageScroll ? 'overflow-y-hidden' : 'overflow-y-scroll'"
    :style="padding"
    :id="PROXIES_PAGE"
    ref="proxiesRef"
    @scroll.passive="handleScroll"
  >
    <ProxiesCtrl />
    <div
      v-if="isProxyLoading && proxySections.length === 0"
      class="text-base-content/60 flex h-40 items-center justify-center p-4 text-sm"
    >
      {{ $t('loading') }}
    </div>
    <div
      v-else
      class="grid grid-cols-1 gap-1 p-2 md:pr-1"
    >
      <section
        v-for="section in proxySections"
        :key="section.key"
        class="bg-base-100/40 border-base-content/10 space-y-1 rounded-xl border p-1.5"
      >
        <div class="text-base-content/70 px-1 pb-1 text-xs font-semibold tracking-wide uppercase">
          {{ $t(section.title) }}
        </div>
        <template v-if="displayTwoColumnsForSection(section.items)">
          <div class="grid grid-cols-2 gap-1">
            <div
              v-for="idx in [0, 1]"
              :key="`${section.key}-${idx}`"
              class="flex flex-1 flex-col gap-1"
            >
              <component
                v-for="name in filterContent(section.items, idx)"
                :is="renderComponentBySection(section.key)"
                :key="name"
                :name="name"
              />
            </div>
          </div>
        </template>
        <template v-else>
          <component
            v-for="name in section.items"
            :is="renderComponentBySection(section.key)"
            :key="name"
            :name="name"
          />
        </template>
      </section>
    </div>
  </div>
</template>

<script setup lang="ts">
import ProxyGroup from '@/components/proxies/ProxyGroup.vue'
import ProxyGroupForMobile from '@/components/proxies/ProxyGroupForMobile.vue'
import ProxyProvider from '@/components/proxies/ProxyProvider.vue'
import ProxiesCtrl from '@/components/sidebar/ProxiesCtrl.tsx'
import { usePaddingForViews } from '@/composables/paddingViews'
import {
  disableProxiesPageScroll,
  isProxiesPageMounted,
  proxySections,
  skipNextProxiesTabRestore,
  type ProxySectionType,
} from '@/composables/proxies'
import { PROXY_TAB_TYPE } from '@/constant'
import { isMiddleScreen, PROXIES_PAGE } from '@/helper/utils'
import { shouldRestoreProxyScroll } from '@/helper/viewport'
import { fetchProxies, fetchProxyProviders, isProxyLoading, proxiesTabShow } from '@/store/proxies'
import { twoColumnProxyGroup } from '@/store/settings'
import { useSessionStorage } from '@vueuse/core'
import { computed, nextTick, onMounted, ref, watch } from 'vue'

const { padding } = usePaddingForViews({
  offsetTop: 0,
  offsetBottom: 0,
})
const proxiesRef = ref()
const scrollStatus = useSessionStorage('cache/proxies-scroll-status', {
  [PROXY_TAB_TYPE.STRATEGY]: 0,
  [PROXY_TAB_TYPE.NODE]: 0,
  [PROXY_TAB_TYPE.PROVIDER]: 0,
})

const handleScroll = () => {
  if (!proxiesRef.value) return

  scrollStatus.value[proxiesTabShow.value] = proxiesRef.value.scrollTop
}

const waitTickUntilReady = (startTime = performance.now()) => {
  const proxiesEl = proxiesRef.value
  const targetScrollTop = scrollStatus.value[proxiesTabShow.value]
  const isTimedOut = performance.now() - startTime > 300

  if (shouldRestoreProxyScroll(proxiesEl?.scrollHeight ?? null, targetScrollTop, isTimedOut)) {
    if (!proxiesEl) return

    proxiesEl.scrollTo({
      top: scrollStatus.value[proxiesTabShow.value],
      behavior: 'smooth',
    })
  } else {
    requestAnimationFrame(() => {
      waitTickUntilReady(startTime)
    })
  }
}

watch(proxiesTabShow, () =>
  nextTick(() => {
    if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
      void fetchProxyProviders()
    }

    if (skipNextProxiesTabRestore.value) {
      skipNextProxiesTabRestore.value = false
      return
    }

    waitTickUntilReady()
  }),
)

isProxiesPageMounted.value = false

onMounted(() => {
  setTimeout(() => {
    isProxiesPageMounted.value = true
    nextTick(() => {
      waitTickUntilReady()
      fetchProxies()
      if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
        void fetchProxyProviders()
      }
    })
  })
})

const renderComponentBySection = (sectionKey: ProxySectionType) => {
  if (sectionKey === 'provider') {
    return ProxyProvider
  }

  if (isMiddleScreen.value && displayTwoColumns.value) {
    return ProxyGroupForMobile
  }

  return ProxyGroup
}

const displayTwoColumns = computed(() => {
  if (isMiddleScreen.value) {
    return false
  }

  return twoColumnProxyGroup.value
})

const displayTwoColumnsForSection = (items: string[]) => {
  return displayTwoColumns.value && items.length > 1
}

const filterContent: <T>(all: T[], target: number) => T[] = (all, target) => {
  return all.filter((_, index: number) => index % 2 === target)
}
</script>
