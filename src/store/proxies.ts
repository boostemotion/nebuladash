import { useStorage } from '@/composables/use-storage'
import { PROXY_TAB_TYPE } from '@/constant'
import { ref, watch } from 'vue'
import { activeBackend } from './setup'

export const proxiesFilter = ref('')

/**
 * NebulaDash: 三段视图。
 * 兼容旧版本持久化的 `proxies` 值（上游两段视图时代），映射到策略组。
 */
const normalizeProxyTab = (value: unknown): PROXY_TAB_TYPE => {
  if (value === 'proxies') return PROXY_TAB_TYPE.STRATEGY

  return Object.values(PROXY_TAB_TYPE).includes(value as PROXY_TAB_TYPE)
    ? (value as PROXY_TAB_TYPE)
    : PROXY_TAB_TYPE.STRATEGY
}

const storedTab = useStorage<string>('cache/proxy-tab-show', PROXY_TAB_TYPE.STRATEGY)

export const proxiesTabShow = ref(normalizeProxyTab(storedTab.value))

watch(proxiesTabShow, (value) => {
  storedTab.value = value
})
export const hiddenGroupMap = useStorage<Record<string, boolean>>('config/hidden-group-map', {})

watch(activeBackend, (backend) => {
  if (backend) proxiesTabShow.value = PROXY_TAB_TYPE.STRATEGY
})
