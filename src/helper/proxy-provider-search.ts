import type { ProxyProvider, SubscriptionInfo } from '@/types'
import type { SearchMatcher } from './search'

/**
 * NebulaDash: Provider 卡片搜索目标。
 *
 * 旧版 NebulaDash 在“代理商”标签里除了 Provider 名与节点名，还能搜测试 URL、
 * 更新时间、Provider 类型和订阅信息。这里把目标集合集中成一个纯函数，
 * 便于单测与复用。
 *
 * 约束：只使用已加载的 Provider 数据，**不得触发 `/providers/proxies` 请求**。
 */
const addDefinedTarget = (targets: string[], label: string, value: unknown) => {
  if (value === undefined || value === null || value === '') {
    return
  }

  targets.push(`${label} ${String(value)}`)
}

const getSubscriptionSearchTargets = (subscriptionInfo?: SubscriptionInfo) => {
  const targets: string[] = []

  if (!subscriptionInfo) {
    return targets
  }

  addDefinedTarget(targets, 'download', subscriptionInfo.Download)
  addDefinedTarget(targets, 'upload', subscriptionInfo.Upload)
  addDefinedTarget(targets, 'total', subscriptionInfo.Total)
  addDefinedTarget(targets, 'expire', subscriptionInfo.Expire)

  if (subscriptionInfo.Expire) {
    targets.push(
      `expire-date ${new Date(subscriptionInfo.Expire * 1000).toISOString().slice(0, 10)}`,
    )
  }

  return targets
}

export const getProviderSearchTargets = (provider: ProxyProvider) => {
  return [
    provider.name,
    provider.testUrl,
    provider.updatedAt,
    provider.vehicleType,
    ...getSubscriptionSearchTargets(provider.subscriptionInfo),
  ].filter((target) => typeof target === 'string' && target.length > 0)
}

/** Provider 名 / 测试 URL / 更新时间 / 类型 / 订阅信息是否命中当前搜索词。 */
export const matchesProviderSearch = (provider: ProxyProvider, matcher: SearchMatcher) => {
  return matcher.testAny(getProviderSearchTargets(provider))
}
