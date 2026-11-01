import { proxyMap, proxyProviederList } from '@/assembly/proxies'
import { PROXY_SEARCH_MODE, PROXY_TAB_TYPE } from '@/constant'
import { getProviderSearchTargets } from '@/helper/proxy-provider-search'
import { toSmartSearchMatcher } from '@/helper/search'
import { proxiesFilter, proxiesTabShow } from '@/store/proxies'
import { proxyProviderSearchMode, proxySearchMode } from '@/store/settings'
import { computed } from 'vue'

export const proxySearchKeyword = computed(() => proxiesFilter.value.trim())

const getCurrentSearchMode = () =>
  proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER ? proxyProviderSearchMode : proxySearchMode

export const isProxyNodeSearchMode = computed(
  () => getCurrentSearchMode().value === PROXY_SEARCH_MODE.GLOBAL,
)

export const toggleProxySearchMode = () => {
  const mode = getCurrentSearchMode()
  mode.value =
    mode.value === PROXY_SEARCH_MODE.GLOBAL ? PROXY_SEARCH_MODE.GROUP : PROXY_SEARCH_MODE.GLOBAL
}

export const matchProxySearchKeyword = (name: string, keyword = proxySearchKeyword.value) => {
  const normalizedKeyword = keyword.trim()

  if (!normalizedKeyword) {
    return true
  }

  return toSmartSearchMatcher(normalizedKeyword)?.test(name) ?? true
}

export const proxyGroupContainsMatchingNode = (groupName: string) => {
  return proxyMap.value[groupName]?.all?.some((name) => matchProxySearchKeyword(name)) ?? false
}

export const proxyProviderContainsMatchingNode = (providerName: string) => {
  const provider = proxyProviederList.value.find((p) => p.name === providerName)
  return provider?.proxies.some((node) => matchProxySearchKeyword(node.name)) ?? false
}

/**
 * NebulaDash: “代理商”标签在组名搜索模式下，除了 Provider 名，还能匹配
 * 测试 URL、更新时间、Provider 类型与订阅信息（只读已加载数据，不发请求）。
 */
export const proxyProviderMatchesSearch = (providerName: string) => {
  const keyword = proxySearchKeyword.value

  if (!keyword) {
    return true
  }

  const provider = proxyProviederList.value.find((p) => p.name === providerName)

  if (!provider) {
    return false
  }

  return getProviderSearchTargets(provider).some(
    (target) => matchProxySearchKeyword(target, keyword),
  )
}
