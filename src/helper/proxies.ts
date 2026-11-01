import { configs } from '@/assembly/config'
import {
  getProxyGroupChains,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/assembly/proxies'
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant'
import { isHiddenGroup } from '@/helper'
import { rules } from '@/assembly/rules'
import { proxiesTabShow } from '@/store/proxies'
import { groupsInActiveFolder, isProxyFolderModeActive } from '@/store/proxy-folders'
import { displayGlobalByMode, manageHiddenGroup, nodeClusterVariants } from '@/store/settings'
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

  if (displayGlobalByMode.value) {
    if (configs.value?.mode.toUpperCase() === GLOBAL) {
      return filterProxyGroups(getProxyGroupChains(GLOBAL), false)
    }

    return filterProxyGroups(proxyGroupList.value)
  }

  const globalGroups = proxyMap.value[GLOBAL] ? [GLOBAL] : []
  return filterProxyGroups([...proxyGroupList.value, ...globalGroups])
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
