/**
 * NebulaDash: 节点组聚类排序 + 策略组/节点组拆分。
 *
 * 背景：OpenClash / Mihomo 配置里节点组通常按地区 + 模式命名，例如
 * `香港-手动`、`香港-自动`、`香港-故转`。上游按原始顺序或纯名称排序会把同一
 * 地区拆散，难以浏览。这里做两件事：
 *
 * 1. 同前缀簇相邻（先去掉尾部的变体词再分组）；
 * 2. 簇内顺序固定为 故转 > 手动 > 自动 > 负载均衡 > 其他；
 * 3. 簇间顺序优先“被策略组引用次数多”的簇，其次按基础名自然排序。
 *
 * 全部为纯函数，便于单元测试；不直接依赖 store。
 */

export const DEFAULT_NODE_VARIANT_PATTERNS = [
  '故转|故障转移|fallback',
  '手动|manual',
  '自动|auto',
  '负载均衡|负载|均衡|loadbalance|balance|lb',
]

/** 判定为“策略组”的代理类型（其余代理组视为节点组）。 */
export const STRATEGY_PROXY_TYPES = new Set([
  'selector',
  'urltest',
  'fallback',
  'loadbalance',
  'smart',
])

export type NodeGroupProxyLike = {
  now?: string
  type?: string
}

const getPatterns = (variants: string[]) => {
  const patterns = (variants.length ? variants : DEFAULT_NODE_VARIANT_PATTERNS)
    .map((raw) => raw.trim())
    .filter(Boolean)

  return patterns
}

const isFallbackNodeVariant = (name: string) => /故转|故障转移|fallback/iu.test(name)
const isManualNodeVariant = (name: string) => /手动|manual/iu.test(name)
const isAutoNodeVariant = (name: string) => /自动|auto/iu.test(name)

/**
 * 去掉尾部变体词与括号后缀，得到聚类用的基础名。
 * 例：`香港-手动` / `香港 (故转)` / `香港【自动】` → `香港`
 */
export const normalizeNodeGroupBaseKey = (
  name: string,
  variants: string[] = DEFAULT_NODE_VARIANT_PATTERNS,
) => {
  const variantPattern = getPatterns(variants).join('|')

  return name
    .normalize('NFKC')
    .replace(/\s+/g, ' ')
    .replace(/[【[][^\]】]+[\]】]\s*$/u, '')
    .replace(/[（(][^)）]+[）)]\s*$/u, '')
    .replace(new RegExp(`\\s*[-_/|·•:：]\\s*(${variantPattern})\\s*$`, 'iu'), '')
    .replace(new RegExp(`\\s*(${variantPattern})\\s*$`, 'iu'), '')
    .trim()
    .toLocaleLowerCase('zh-CN')
}

/** 簇内顺序：故转 0 > 手动 1 > 自动 2 > 配置词表顺序 > 其他 9 */
export const getNodeVariantRank = (
  name: string,
  variants: string[] = DEFAULT_NODE_VARIANT_PATTERNS,
) => {
  if (isFallbackNodeVariant(name)) {
    return 0
  }

  if (isManualNodeVariant(name)) {
    return 1
  }

  if (isAutoNodeVariant(name)) {
    return 2
  }

  const patterns = getPatterns(variants)

  for (let rank = 0; rank < patterns.length; rank++) {
    if (new RegExp(`(${patterns[rank]})`, 'iu').test(name)) {
      return rank
    }
  }

  return 9
}

/**
 * 统计每个节点组被策略组引用的次数：沿策略组的 `now` 链一路向下计数。
 * 带 visited 防环，遇到非代理组节点即停止。
 */
export const countNodeGroupUsageInStrategyGroups = ({
  strategyGroups,
  proxyMap,
  isGroupName,
}: {
  strategyGroups: string[]
  proxyMap: Record<string, NodeGroupProxyLike>
  isGroupName: (name: string) => boolean
}) => {
  const usageCountMap = new Map<string, number>()

  strategyGroups.forEach((strategyGroupName) => {
    const strategyGroup = proxyMap[strategyGroupName]

    if (!strategyGroup?.now) {
      return
    }

    let currentGroupName = strategyGroup.now
    const visited = new Set<string>()

    while (currentGroupName && isGroupName(currentGroupName)) {
      if (visited.has(currentGroupName)) {
        break
      }

      visited.add(currentGroupName)
      usageCountMap.set(currentGroupName, (usageCountMap.get(currentGroupName) ?? 0) + 1)

      const nextGroup = proxyMap[currentGroupName]

      if (!nextGroup?.now || nextGroup.now === currentGroupName) {
        break
      }

      currentGroupName = nextGroup.now
    }
  })

  return usageCountMap
}

/**
 * 节点组聚类排序。返回新数组，不修改入参。
 */
export const sortNodeGroupsByVariantCluster = ({
  groups,
  strategyGroups,
  variants = DEFAULT_NODE_VARIANT_PATTERNS,
  proxyMap,
  isGroupName,
}: {
  groups: string[]
  strategyGroups: string[]
  variants?: string[]
  proxyMap: Record<string, NodeGroupProxyLike>
  isGroupName: (name: string) => boolean
}) => {
  if (groups.length <= 1) {
    return [...groups]
  }

  const originalIndexMap = new Map(groups.map((name, index) => [name, index]))
  const usageCountMap = countNodeGroupUsageInStrategyGroups({
    strategyGroups,
    proxyMap,
    isGroupName,
  })
  const clusterReferenceMap = new Map<string, string>()
  const clusteredGroups = new Map<string, string[]>()

  groups.forEach((name) => {
    const base = normalizeNodeGroupBaseKey(name, variants)

    if (!clusteredGroups.has(base)) {
      clusteredGroups.set(base, [])
    }

    clusteredGroups.get(base)!.push(name)
  })

  // 每个簇选一个“代表组”参与簇间排序：优先 fallback 组，其次被引用最多的组。
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
    const leftBase = normalizeNodeGroupBaseKey(left, variants)
    const rightBase = normalizeNodeGroupBaseKey(right, variants)

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

    const rankGap = getNodeVariantRank(left, variants) - getNodeVariantRank(right, variants)

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

/**
 * 把代理组拆成“策略组”和“节点组”。
 *
 * 优先用 `/rules` 里出现的代理名判定策略组（OpenClash 下更准确）；
 * 规则未加载时回退到代理类型判定。
 */
export const splitProxyGroupsByRole = ({
  groups,
  ruleTargets,
  proxyMap,
  strategyTypes = STRATEGY_PROXY_TYPES,
}: {
  groups: string[]
  ruleTargets: Set<string>
  proxyMap: Record<string, NodeGroupProxyLike>
  strategyTypes?: Set<string>
}) => {
  const strategyGroups: string[] = []
  const nodeGroups: string[] = []

  if (ruleTargets.size > 0) {
    groups.forEach((groupName) => {
      if (ruleTargets.has(groupName)) {
        strategyGroups.push(groupName)
        return
      }

      nodeGroups.push(groupName)
    })

    return { strategyGroups, nodeGroups }
  }

  groups.forEach((groupName) => {
    const proxyGroup = proxyMap[groupName]

    if (!proxyGroup?.type) {
      return
    }

    if (strategyTypes.has(proxyGroup.type.toLowerCase())) {
      strategyGroups.push(groupName)
      return
    }

    nodeGroups.push(groupName)
  })

  return { strategyGroups, nodeGroups }
}
