<template>
  <DialogWrapper
    v-model="proxyGroupChainModalOpen"
    :title="proxyGroupChainTarget"
    :no-padding="true"
    box-class="max-w-160"
  >
    <div class="flex h-[70dvh] max-h-142 flex-col overflow-hidden">
      <div class="shrink-0 p-3 pb-0">
        <ProxyChainPath
          :proxy="proxyGroupChainTarget"
          :selected="selectedProxy"
          :show-now-node="true"
          :show-latency="true"
          :show-provider="true"
          @update:selected="selectedProxy = $event"
        />
        <div class="mt-2 flex items-center gap-2">
          <button
            class="btn btn-xs btn-ghost"
            @click="openRulesShortcut"
          >
            {{ $t('goToRules') }}
          </button>
        </div>
      </div>
      <div
        class="flex flex-1 flex-col overflow-y-auto"
        :class="PROXIES_PARENT_CLASS"
      >
        <ProxyGroupPanel :name="selectedProxy || proxyGroupChainTarget" />
      </div>
    </div>
  </DialogWrapper>
</template>

<script setup lang="ts">
import DialogWrapper from '@/components/common/DialogWrapper.vue'
import ProxyChainPath from '@/components/common/ProxyChainPath.vue'
import ProxyGroupPanel from '@/components/proxies/ProxyGroupPanel.vue'
import {
  closeProxyGroupChain,
  proxyGroupChainModalOpen,
  proxyGroupChainTarget,
} from '@/helper/proxy-group-chain'
import { PROXIES_PARENT_CLASS } from '@/helper/utils'
import { ref, watch } from 'vue'
import { proxyMap } from '@/assembly/proxies'
import { ROUTE_NAME, RULE_TAB_TYPE } from '@/constant'
import { rulesFilter, rulesTabShow } from '@/store/rules'
import { useRouter } from 'vue-router'

const router = useRouter()
const selectedProxy = ref('')

/**
 * NebulaDash: 从链路弹窗直接跳到规则页，并带入当前代理组名作为筛选词，
 * 便于从“这个组最终走哪”快速定位到“哪些规则指向它”。
 */
const openRulesShortcut = () => {
  rulesTabShow.value = RULE_TAB_TYPE.RULES
  rulesFilter.value = proxyGroupChainTarget.value
  closeProxyGroupChain()
  void router.push({ name: ROUTE_NAME.rules })
}

watch(
  () => proxyGroupChainModalOpen.value,
  (isOpen) => {
    if (!isOpen) {
      closeProxyGroupChain()
    } else {
      selectedProxy.value = proxyMap.value[proxyGroupChainTarget.value]?.now
    }
  },
)
</script>
