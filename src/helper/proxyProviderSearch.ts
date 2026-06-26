import type { ProxyProvider, SubscriptionInfo } from '@/types'
import { matchesSearchTarget } from './search.ts'

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
    ...provider.proxies.map((proxy) => proxy.name),
    ...getSubscriptionSearchTargets(provider.subscriptionInfo),
  ].filter((target) => target.length > 0)
}

export const matchesProviderSearchTarget = (provider: ProxyProvider, terms: string[]) => {
  if (terms.length === 0) {
    return true
  }

  return getProviderSearchTargets(provider).some((target) => matchesSearchTarget(target, terms))
}
