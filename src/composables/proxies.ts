import { isSingBox } from '@/api'
import { GLOBAL, PROXY_TAB_TYPE } from '@/constant'
import { isHiddenGroup } from '@/helper'
import {
  getSearchTermVariants,
  matchesSearchTargets,
  matchesSearchTerm,
  splitSearchTerms,
} from '@/helper/search'
import { configs } from '@/store/config'
import {
  getProxyGroupChains,
  proxiesFilter,
  proxiesTabShow,
  proxyGroupList,
  proxyMap,
  proxyProviederList,
} from '@/store/proxies'
import { rules } from '@/store/rules'
import {
  customGlobalNode,
  displayGlobalByMode,
  manageHiddenGroup,
  nodeClusterVariants,
} from '@/store/settings'
import { isEmpty } from 'lodash'
import { computed, ref } from 'vue'

const STRATEGY_PROXY_TYPES = new Set(['selector', 'urltest', 'fallback', 'loadbalance', 'smart'])
const DEFAULT_NODE_VARIANT_PATTERNS = [
  '故转|故障转移|fallback',
  '手动|manual',
  '自动|auto',
  '负载均衡|负载|均衡|loadbalance|balance|lb',
]

export type ProxySectionType = 'strategy' | 'node' | 'provider'

export type ProxySection = {
  key: ProxySectionType
  title: string
  items: string[]
}

const getLinkedGroupsFromRules = (terms: string[]) => {
  const linkedGroups = new Set<string>()

  if (terms.length === 0 || rules.value.length === 0) {
    return linkedGroups
  }

  rules.value.forEach((rule) => {
    const chains = getProxyGroupChains(rule.proxy)
    const candidates = [rule.type, rule.payload, rule.proxy, ...chains]
    const hit = terms.every((term) => {
      const variants = getSearchTermVariants(term)

      return variants.some((variant) =>
        candidates.some((candidate) => matchesSearchTerm(candidate ?? '', variant)),
      )
    })

    if (!hit) {
      return
    }

    chains.forEach((groupName) => linkedGroups.add(groupName))
    linkedGroups.add(rule.proxy)
  })

  return linkedGroups
}

const getCurrentSectionKey = (): ProxySectionType => {
  if (proxiesTabShow.value === PROXY_TAB_TYPE.NODE) {
    return 'node'
  }

  if (proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    return 'provider'
  }

  return 'strategy'
}

const getNodeVariantPatterns = () => {
  return (
    nodeClusterVariants.value.length ? nodeClusterVariants.value : DEFAULT_NODE_VARIANT_PATTERNS
  )
    .map((raw) => raw.trim())
    .filter(Boolean)
}

const getNodeVariantRegex = (pattern: string) => {
  return new RegExp(`(${pattern})`, 'iu')
}

const isFallbackNodeVariant = (name: string) => {
  return /故转|故障转移|fallback/iu.test(name)
}

const isManualNodeVariant = (name: string) => {
  return /手动|manual/iu.test(name)
}

const isAutoNodeVariant = (name: string) => {
  return /自动|auto/iu.test(name)
}

const normalizeNodeGroupBaseKey = (name: string) => {
  const variantPattern = getNodeVariantPatterns().join('|')

  return name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[【\[][^\]】]+[\]】]\s*$/u, '')
    .replace(/[（(][^)）]+[）)]\s*$/u, '')
    .replace(new RegExp(`\\s*[-_/|·•:：]\\s*(${variantPattern})\\s*$`, 'iu'), '')
    .replace(new RegExp(`\\s*(${variantPattern})\\s*$`, 'iu'), '')
    .trim()
    .toLocaleLowerCase('zh-CN')
}

const getNodeVariantRank = (name: string) => {
  if (isFallbackNodeVariant(name)) {
    return 0
  }

  if (isManualNodeVariant(name)) {
    return 1
  }

  if (isAutoNodeVariant(name)) {
    return 2
  }

  const patterns = getNodeVariantPatterns()

  for (let rank = 0; rank < patterns.length; rank++) {
    if (getNodeVariantRegex(patterns[rank]).test(name)) {
      return rank
    }
  }

  return 9
}

const countNodeGroupUsageInStrategyGroups = (strategyGroups: string[]) => {
  const usageCountMap = new Map<string, number>()

  strategyGroups.forEach((strategyGroupName) => {
    const strategyGroup = proxyMap.value[strategyGroupName]

    if (!strategyGroup?.now) {
      return
    }

    let currentGroupName = strategyGroup.now
    const visited = new Set<string>()

    while (currentGroupName && proxyGroupList.value.includes(currentGroupName)) {
      if (visited.has(currentGroupName)) {
        break
      }

      visited.add(currentGroupName)
      usageCountMap.set(currentGroupName, (usageCountMap.get(currentGroupName) ?? 0) + 1)

      const nextGroup = proxyMap.value[currentGroupName]

      if (!nextGroup?.now || nextGroup.now === currentGroupName) {
        break
      }

      currentGroupName = nextGroup.now
    }
  })

  return usageCountMap
}

const sortNodeGroupsByVariantCluster = (groups: string[], strategyGroups: string[]) => {
  const originalIndexMap = new Map(groups.map((name, index) => [name, index]))
  const usageCountMap = countNodeGroupUsageInStrategyGroups(strategyGroups)
  const clusterReferenceMap = new Map<string, string>()
  const clusteredGroups = new Map<string, string[]>()

  groups.forEach((name) => {
    const base = normalizeNodeGroupBaseKey(name)

    if (!clusteredGroups.has(base)) {
      clusteredGroups.set(base, [])
    }

    clusteredGroups.get(base)!.push(name)
  })

  clusteredGroups.forEach((clustered, base) => {
    const fallbackGroup = clustered.find((name) => isFallbackNodeVariant(name))

    if (fallbackGroup) {
      clusterReferenceMap.set(base, fallbackGroup)
      return
    }

    const maxUsageGroup = [...clustered].sort((left, right) => {
      return (usageCountMap.get(right) ?? 0) - (usageCountMap.get(left) ?? 0)
    })[0]

    clusterReferenceMap.set(base, maxUsageGroup)
  })

  return [...groups].sort((left, right) => {
    const leftBase = normalizeNodeGroupBaseKey(left)
    const rightBase = normalizeNodeGroupBaseKey(right)

    if (leftBase !== rightBase) {
      const leftRef = clusterReferenceMap.get(leftBase)
      const rightRef = clusterReferenceMap.get(rightBase)
      const leftUsage = leftRef ? (usageCountMap.get(leftRef) ?? 0) : 0
      const rightUsage = rightRef ? (usageCountMap.get(rightRef) ?? 0) : 0

      if (leftUsage !== rightUsage) {
        return rightUsage - leftUsage
      }

      return leftBase.localeCompare(rightBase, 'zh-Hans-CN', {
        numeric: true,
        sensitivity: 'base',
      })
    }

    const rankGap = getNodeVariantRank(left) - getNodeVariantRank(right)

    if (rankGap !== 0) {
      return rankGap
    }

    const nameGap = left.localeCompare(right, 'zh-Hans-CN', {
      numeric: true,
      sensitivity: 'base',
    })

    if (nameGap !== 0) {
      return nameGap
    }

    return (originalIndexMap.get(left) ?? 0) - (originalIndexMap.get(right) ?? 0)
  })
}

const filterGroups = (all: string[]) => {
  if (manageHiddenGroup.value) {
    return all
  }

  return all.filter((name) => !isHiddenGroup(name))
}

const getRenderGroups = () => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  let groups: string[]

  if (displayGlobalByMode.value) {
    if (configs.value?.mode.toUpperCase() === GLOBAL) {
      groups = [
        isSingBox.value && proxyMap.value[customGlobalNode.value] ? customGlobalNode.value : GLOBAL,
      ]
    } else {
      groups = filterGroups(proxyGroupList.value)
    }
  } else {
    groups = filterGroups([...proxyGroupList.value, GLOBAL])
  }

  const searchTerms = splitSearchTerms(proxiesFilter.value)

  if (searchTerms.length === 0) {
    return groups
  }

  const linkedGroups = getLinkedGroupsFromRules(searchTerms)

  return groups.filter((groupName) => {
    if (linkedGroups.has(groupName)) {
      return true
    }

    return matchesSearchTargets(groupName, proxyMap.value[groupName]?.all ?? [], searchTerms)
  })
}

export const splitProxyGroupsByRole = (groups: string[]) => {
  const strategyGroups: string[] = []
  const nodeGroups: string[] = []

  if (rules.value.length > 0) {
    const ruleTargetSet = new Set(rules.value.map((rule) => rule.proxy))

    groups.forEach((groupName) => {
      if (ruleTargetSet.has(groupName)) {
        strategyGroups.push(groupName)
        return
      }

      nodeGroups.push(groupName)
    })

    return {
      strategyGroups,
      nodeGroups,
    }
  }

  groups.forEach((groupName) => {
    const proxyGroup = proxyMap.value[groupName]

    if (!proxyGroup) {
      return
    }

    if (STRATEGY_PROXY_TYPES.has(proxyGroup.type.toLowerCase())) {
      strategyGroups.push(groupName)
      return
    }

    nodeGroups.push(groupName)
  })

  return {
    strategyGroups,
    nodeGroups,
  }
}

const getProxySections = (): ProxySection[] => {
  if (isEmpty(proxyMap.value)) {
    return []
  }

  const groups = getRenderGroups()

  const { strategyGroups, nodeGroups } = splitProxyGroupsByRole(groups)

  const sections: ProxySection[] = [
    {
      key: 'strategy',
      title: 'strategyGroup',
      items: strategyGroups,
    },
    {
      key: 'node',
      title: 'nodeGroup',
      items: sortNodeGroupsByVariantCluster(nodeGroups, strategyGroups),
    },
    {
      key: 'provider',
      title: 'proxyProvider',
      items: proxyProviederList.value
        .map((provider) => provider.name)
        .filter((name) => {
          const searchTerms = splitSearchTerms(proxiesFilter.value)

          if (searchTerms.length === 0) {
            return true
          }

          const provider = proxyProviederList.value.find((item) => item.name === name)

          return matchesSearchTargets(
            name,
            provider?.proxies.map((proxy) => proxy.name) ?? [],
            searchTerms,
          )
        }),
    },
  ]

  const currentSectionKey = getCurrentSectionKey()

  return sections.filter((section) => section.key === currentSectionKey && section.items.length > 0)
}

export const disableProxiesPageScroll = ref(false)
export const isProxiesPageMounted = ref(false)
export const skipNextProxiesTabRestore = ref(false)
export const renderGroups = computed(() => {
  const groups = getRenderGroups()

  if (isProxiesPageMounted.value) {
    return groups
  }

  return groups.slice(0, 16)
})

export const proxySections = computed(() => {
  const sections = getProxySections()

  if (isProxiesPageMounted.value) {
    return sections
  }

  let remaining = 16

  return sections
    .map((section) => {
      if (remaining <= 0) {
        return {
          ...section,
          items: [],
        }
      }

      const items = section.items.slice(0, remaining)
      remaining -= items.length

      return {
        ...section,
        items,
      }
    })
    .filter((section) => section.items.length > 0)
})
