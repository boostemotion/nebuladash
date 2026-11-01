import { configs } from '@/assembly/config'
import {
  getProxyGroupChains,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/assembly/proxies'
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant'
import { isHiddenGroup } from '@/helper'
import { fetchRules, rules } from '@/assembly/rules'
import { proxiesTabShow } from '@/store/proxies'
import { groupsInActiveFolder, isProxyFolderModeActive } from '@/store/proxy-folders'
import { displayGlobalByMode, manageHiddenGroup, nodeClusterVariants } from '@/store/settings'
import { toSmartSearchMatcher, type SearchMatcher } from './search'
import { sortNodeGroupsByVariantCluster, splitProxyGroupsByRole } from './node-group-cluster'
import { isEmpty } from 'lodash'
import { computed, ref } from 'vue'
import {
  isProxyNodeSearchMode,
  matchProxySearchKeyword,
  proxyGroupContainsMatchingNode,
  proxyProviderContainsMatchingNode,
  proxySearchKeyword,
} from './proxy-search'

let rulesRequestedForSearch = false

/**
 * NebulaDash: 代理页首次出现有效搜索词时补拉 `/rules`。
 *
 * 反向映射依赖规则数据，但规则接口可能因后端刚连接完成、或用户在代理页停留较久
 * 而尚未就绪。这里只在需要时补一次，失败后允许下次搜索重试；不会阻塞首屏。
 */
export const ensureRulesLoadedForProxySearch = () => {
  if (rulesRequestedForSearch || rules.value.length > 0) {
    return
  }

  rulesRequestedForSearch = true

  fetchRules().catch(() => {
    rulesRequestedForSearch = false
  })
}

/**
 * NebulaDash: 域名 / 规则关键词 → 规则 → 代理组的反向映射。
 *
 * 在代理页搜索 `google.com` 时，先看哪些规则命中，再把这些规则指向的代理组
 * 及其下游链路组一并显示。只依赖已是内存数据的 `/rules` 与 `/proxies`，
 * 不会为了搜索额外请求 Provider。
 */
export const getProxyGroupsLinkedFromRules = (matcher: SearchMatcher | null) => {
  const linkedGroups = new Set<string>()

  if (!matcher || !rules.value.length || isEmpty(proxyMap.value)) {
    return linkedGroups
  }

  rules.value.forEach((rule) => {
    const chains = getProxyGroupChains(rule.proxy)

    if (!matcher.testAny([rule.type, rule.payload, rule.proxy, ...chains])) {
      return
    }

    chains.forEach((groupName) => linkedGroups.add(groupName))
    linkedGroups.add(rule.proxy)
  })

  return linkedGroups
}

const filterProxyGroups = (groups: string[], respectHiddenGroups = true) => {
  if (!proxySearchKeyword.value) {
    if (!respectHiddenGroups || manageHiddenGroup.value) {
      return groups
    }

    return groups.filter((name) => !isHiddenGroup(name))
  }

  const matchesGroup = isProxyNodeSearchMode.value
    ? proxyGroupContainsMatchingNode
    : (name: string) => matchProxySearchKeyword(name)

  return groups.filter(matchesGroup)
}

const getRenderProxyGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  // GLOBAL 模式下列出 GLOBAL 的下游链路，且不再按隐藏组过滤（与上游一致）。
  const isGlobalMode = configs.value?.mode?.toUpperCase() === GLOBAL
  const respectHidden = !(displayGlobalByMode.value && isGlobalMode)
  const groups = displayGlobalByMode.value
    ? isGlobalMode
      ? getProxyGroupChains(GLOBAL)
      : proxyGroupList.value
    : [...proxyGroupList.value, ...(proxyMap.value[GLOBAL] ? [GLOBAL] : [])]

  const filtered = filterProxyGroups(groups, respectHidden)

  const matcher = toSmartSearchMatcher(proxySearchKeyword.value)

  if (!matcher) {
    return filtered
  }

  const linkedGroups = getProxyGroupsLinkedFromRules(matcher)

  if (!linkedGroups.size) {
    return filtered
  }

  // 规则命中的组可能被隐藏组过滤或搜索过滤排除，这里补回来。
  const filteredSet = new Set(filtered)
  const extraGroups = [...linkedGroups].filter(
    (name) => !filteredSet.has(name) && Boolean(proxyMap.value[name]),
  )

  return [...filtered, ...extraGroups]
}

const getRenderProxyProviders = () => {
  const names = proxyProviederList.value.map((provider) => provider.name)

  if (!proxySearchKeyword.value) {
    return names
  }

  const matches = isProxyNodeSearchMode.value
    ? proxyProviderContainsMatchingNode
    : (name: string) => matchProxySearchKeyword(name)

  return names.filter(matches)
}

export const disableProxiesPageScroll = ref(false)

export const renderProxyGroups = computed(getRenderProxyGroups)

export const renderProxyProviders = computed(getRenderProxyProviders)

/**
 * NebulaDash: 把（已过滤的）代理组按角色拆成策略组 / 节点组。
 * `/rules` 已加载时按规则目标判定，否则回退到代理类型判定。
 */
export const proxyGroupRoleSplit = computed(() =>
  splitProxyGroupsByRole({
    groups: renderProxyGroups.value,
    ruleTargets: new Set(rules.value.map((rule) => rule.proxy)),
    proxyMap: proxyMap.value,
  }),
)

export const renderProxyStrategyGroups = computed(() => proxyGroupRoleSplit.value.strategyGroups)

/** 节点组做了同前缀聚类排序：故转 > 手动 > 自动 > 负载均衡 > 其他。 */
export const renderProxyNodeGroups = computed(() => {
  const { strategyGroups, nodeGroups } = proxyGroupRoleSplit.value

  return sortNodeGroupsByVariantCluster({
    groups: nodeGroups,
    strategyGroups,
    variants: nodeClusterVariants.value,
    proxyMap: proxyMap.value,
    isGroupName: (name: string) => proxyGroupList.value.includes(name),
  })
})

const applyActiveFolder = (groups: string[]) => {
  if (!isProxyFolderModeActive.value) return groups

  const filter = groupsInActiveFolder.value
  if (!filter) return groups

  return groups.filter((name) => filter.has(name))
}

export const renderProxiesPageItems = computed(() => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return renderProxyProviders.value
  }

  const groups =
    proxiesTabShow.value === PROXY_TAB_TYPE.NODE
      ? renderProxyNodeGroups.value
      : renderProxyStrategyGroups.value

  return applyActiveFolder(groups)
})
