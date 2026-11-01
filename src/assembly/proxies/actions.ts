import { activeConnections, connectionAccessor, disconnectById } from '@/assembly/connections'
import { driver } from '@/assembly/driver'
import { GLOBAL, IPV6_TEST_URL, NOT_CONNECTED, PROXY_TAB_TYPE, PROXY_TYPE } from '@/constant'
import { showNotification } from '@/helper/notification'
import {
  getCachedProviderLoadStatus,
  getProviderFailureStatus,
  isValidProxyDataCache,
  PROVIDER_CACHE_FRESH_DURATION,
  PROVIDER_FAILURE_NOTIFICATION_DEDUPE,
  shouldNotifyProviderFailure,
} from '@/helper/proxy-cache'
import { notifyRequestError } from '@/helper/request-error'
import { automaticDisconnection, iconReflectList, IPv6test } from '@/store/settings'
import { proxiesTabShow } from '@/store/proxies'
import { activeUuid } from '@/store/setup'

import type { Proxy, ProxyProvider } from '@/types'
import { last } from 'lodash'
import { initSmartWeights } from './smart'
import {
  cachedProxyData,
  cachedProxyProviderMeta,
  cachedProxyProviders,
  hasLoadedProxyProviders,
  IPv6Map,
  proxyGroupList,
  proxyMap,
  proxyProviderLoadStatus,
  proxyProviederList,
} from './state'

const getIPv6FromExtra = (proxy: Proxy) => {
  const ipv6History = proxy.extra?.[IPV6_TEST_URL]?.history

  return (last(ipv6History)?.delay ?? NOT_CONNECTED) > NOT_CONNECTED
}

let fetchGeneration = 0
let lastProxyData: { proxies: Record<string, Proxy> } | null = null
let proxyLoadingPromise: Promise<void> | null = null
let proxyProviderLoadingPromise: Promise<void> | null = null
let lastProviderFailureNotifiedAt = 0

const applyProxyData = (
  proxyData: { proxies: Record<string, Proxy> },
  providers: ProxyProvider[] = proxyProviederList.value,
) => {
  const sortIndex = proxyData.proxies[GLOBAL]?.all ?? []
  const allProviderProxies: Record<string, Proxy> = {}

  for (const provider of providers) {
    for (const proxy of provider.proxies) {
      proxy['provider-name'] ||= provider.name
      allProviderProxies[proxy.name] = proxy
    }
  }

  proxyMap.value = {
    ...allProviderProxies,
    ...proxyData.proxies,
  }
  proxyGroupList.value = Object.values(proxyData.proxies)
    .filter((proxy) => proxy.all?.length && proxy.name !== GLOBAL)
    .sort((prev, next) => {
      const prevIndex = sortIndex.indexOf(prev.name)
      const nextIndex = sortIndex.indexOf(next.name)

      if (prevIndex === -1 && nextIndex === -1) {
        return 0
      }
      if (prevIndex === -1) {
        return 1
      }
      if (nextIndex === -1) {
        return -1
      }
      return prevIndex - nextIndex
    })
    .map((proxy) => proxy.name)

  proxyProviederList.value = providers

  let includesSmartGroup = false

  Object.entries(proxyMap.value).forEach(([name, proxy]) => {
    const iconReflect = iconReflectList.value.find((icon) => icon.name === name)

    if (iconReflect) {
      proxyMap.value[name].icon = iconReflect.icon
    }
    if (IPv6test.value && getIPv6FromExtra(proxy)) {
      IPv6Map.value[name] = true
    }

    if (proxy.type.toLowerCase() === PROXY_TYPE.Smart) {
      includesSmartGroup = true
    }
  })

  if (includesSmartGroup) {
    initSmartWeights()
  }
}

const applyProviders = (providers: ProxyProvider[]) => {
  hasLoadedProxyProviders.value = true
  cachedProxyProviders.value = providers

  if (lastProxyData) {
    applyProxyData(lastProxyData, providers)
    return
  }

  proxyProviederList.value = providers
}

/**
 * NebulaDash: 用当前后端 UUID 的本地缓存起屏，避免慢后端时页面空白。
 * 只读取缓存，不触发任何网络请求。
 */
export const hydrateProxiesFromCache = () => {
  // 只接受形状正确的缓存，避免旧版本遗留的脏数据直接进入渲染。
  if (cachedProxyData.value && isValidProxyDataCache(cachedProxyData.value)) {
    lastProxyData = cachedProxyData.value as { proxies: Record<string, Proxy> }
  } else {
    lastProxyData = null
    cachedProxyData.value = null
  }

  const cachedProviders = Array.isArray(cachedProxyProviders.value)
    ? cachedProxyProviders.value
    : []

  const hasCachedProviders = cachedProviders.length > 0
  const providerCacheStatus = getCachedProviderLoadStatus({
    hasCachedProviders,
    fetchedAt: cachedProxyProviderMeta.value?.fetchedAt ?? 0,
    now: Date.now(),
    freshDurationMs: PROVIDER_CACHE_FRESH_DURATION,
  })

  hasLoadedProxyProviders.value = providerCacheStatus === 'cached'
  proxyProviderLoadStatus.value =
    providerCacheStatus ?? cachedProxyProviderMeta.value?.status ?? 'idle'

  if (lastProxyData) {
    applyProxyData(lastProxyData, cachedProviders)
    return
  }

  proxyMap.value = {}
  proxyGroupList.value = []
  proxyProviederList.value = cachedProviders
}

/**
 * NebulaDash: 切换后端时重置内存状态。缓存本身不清理，
 * 由 hydrateProxiesFromCache 重新载入对应后端的数据。
 */
export const resetProxyState = () => {
  fetchGeneration++
  proxyLoadingPromise = null
  proxyProviderLoadingPromise = null
  proxyProviderLoadStatus.value = 'idle'
  hasLoadedProxyProviders.value = false
  lastProxyData = null
  lastProviderFailureNotifiedAt = 0
  proxyMap.value = {}
  proxyGroupList.value = []
  proxyProviederList.value = []
}

export const fetchProxies = async () => {
  if (proxyLoadingPromise) {
    return proxyLoadingPromise
  }

  const requestGeneration = ++fetchGeneration
  const requestBackendUuid = activeUuid.value

  const request = driver()
    .proxies.fetch()
    .then(({ proxies, providers }) => {
      if (fetchGeneration !== requestGeneration || activeUuid.value !== requestBackendUuid) {
        return
      }

      const proxyData = { proxies }
      lastProxyData = proxyData
      cachedProxyData.value = proxyData
      applyProxyData(proxyData)

      // dae 等驱动无法单独请求 Provider，会在 fetch() 里一并返回。
      if (providers.length > 0) {
        applyProviders(providers)
        proxyProviderLoadStatus.value = 'fresh'
        cachedProxyProviderMeta.value = {
          fetchedAt: Date.now(),
          durationMs: 0,
          status: 'fresh',
        }
      }
    })
    .finally(() => {
      if (proxyLoadingPromise === request) {
        proxyLoadingPromise = null
      }
    })

  proxyLoadingPromise = request
  return proxyLoadingPromise
}

const loadProxyProviders = async (): Promise<ProxyProvider[]> => {
  const proxiesDriver = driver().proxies

  if (proxiesDriver.fetchProviders) {
    return await proxiesDriver.fetchProviders()
  }

  const { providers } = await proxiesDriver.fetch({ includeProviders: true })

  return providers
}

/**
 * NebulaDash: Provider 按需加载。
 *
 * - 默认不请求 `/providers/proxies`，只有代理页切到“代理商”或用户手动刷新时才调用；
 * - 并发去重 + 代际校验，切换后端后过期响应直接丢弃；
 * - 失败/超时保留旧缓存，不向页面抛错；
 * - 失败通知 60 秒去重，避免慢接口连续刷屏。
 */
export const fetchProxyProviders = async (force = false) => {
  if (!lastProxyData) {
    await fetchProxies()
  }

  if (!lastProxyData) {
    return
  }

  if (hasLoadedProxyProviders.value && !force) {
    return
  }

  if (proxyProviderLoadingPromise) {
    return proxyProviderLoadingPromise
  }

  const requestGeneration = fetchGeneration
  const requestBackendUuid = activeUuid.value
  const requestStartedAt = performance.now()

  proxyProviderLoadStatus.value = 'loading'

  const request = loadProxyProviders()
    .then((providers) => {
      if (
        fetchGeneration !== requestGeneration ||
        activeUuid.value !== requestBackendUuid ||
        !lastProxyData
      ) {
        return
      }

      applyProviders(providers)
      cachedProxyProviderMeta.value = {
        fetchedAt: Date.now(),
        durationMs: Math.round(performance.now() - requestStartedAt),
        status: 'fresh',
      }
      lastProviderFailureNotifiedAt = 0
      proxyProviderLoadStatus.value = 'fresh'
    })
    .catch((error) => {
      if (fetchGeneration !== requestGeneration || activeUuid.value !== requestBackendUuid) {
        return
      }

      const failureStatus = getProviderFailureStatus(error)

      hasLoadedProxyProviders.value = cachedProxyProviders.value.length > 0
      cachedProxyProviderMeta.value = {
        fetchedAt: cachedProxyProviderMeta.value?.fetchedAt ?? 0,
        durationMs: Math.round(performance.now() - requestStartedAt),
        status: failureStatus,
      }
      proxyProviderLoadStatus.value = failureStatus

      const now = Date.now()

      if (
        shouldNotifyProviderFailure({
          lastNotifiedAt: lastProviderFailureNotifiedAt,
          now,
          dedupeMs: PROVIDER_FAILURE_NOTIFICATION_DEDUPE,
        })
      ) {
        lastProviderFailureNotifiedAt = now
        showNotification({
          content: failureStatus === 'timeout' ? 'providerLoadTimeoutTip' : 'providerLoadErrorTip',
          key: `proxy-provider-load-${requestBackendUuid}`,
          type: 'alert-error',
        })
      }
    })
    .finally(() => {
      if (proxyProviderLoadingPromise === request) {
        proxyProviderLoadingPromise = null
      }
    })

  proxyProviderLoadingPromise = request
  return proxyProviderLoadingPromise
}

export const handlerProxySelect = async (proxyGroupName: string, proxyName: string) => {
  try {
    const proxyGroup = proxyMap.value[proxyGroupName]

    if (proxyGroup.type.toLowerCase() === PROXY_TYPE.LoadBalance) return
    if (proxyGroup.now === proxyName) {
      await fetchProxies()
      if (proxyGroup.now === proxyName) return
    }

    await driver().proxies.select(proxyGroupName, proxyName)
    proxyMap.value[proxyGroupName].now = proxyName

    if (automaticDisconnection.value) {
      activeConnections.value
        .filter((c) => connectionAccessor().chains(c).includes(proxyGroupName))
        .forEach((c) => disconnectById(c.id).catch(() => {}))
    }
    fetchProxies()
  } catch (e) {
    notifyRequestError(e)
  }
}

/**
 * NebulaDash: Provider 更新/健康检查的组合动作。
 *
 * Provider 数据是独立按需加载的，所以“更新订阅”“Provider 测速”之后必须
 * 强制重拉 `/providers/proxies`，否则界面上的节点、延迟、更新时间都不会变，
 * 表现为“按钮转两圈就没了、也没报错”。
 */
const syncAfterProviderChange = async () => {
  await fetchProxies()
  await fetchProxyProviders(true)
}

export const updateProxyProvider = (name: string) => driver().proxies.updateProvider(name)

export const proxyProviderHealthCheck = (name: string) => driver().proxies.healthCheckProvider(name)

let providerResyncTimer: ReturnType<typeof setTimeout> | undefined

/**
 * 让“已加载”标记失效，但不丢缓存数据。
 *
 * 用于“后端配置被重载 / 内核重启 / 代际变化”这类场景：Provider 列表本身可能变了，
 * 下次进入代理商标签必须重新拉取，否则会一直显示旧列表。
 */
export const invalidateProxyProviders = () => {
  const wasLoaded = hasLoadedProxyProviders.value

  hasLoadedProxyProviders.value = false

  if (proxyProviderLoadStatus.value === 'fresh') {
    proxyProviderLoadStatus.value = 'cached'
  }

  // 如果用户此刻正停在“代理商”标签，失效后要立刻补一次，
  // 否则他会一直看着旧列表直到手动切走再切回。
  if (wasLoaded && proxiesTabShow.value === PROXY_TAB_TYPE.PROVIDER) {
    scheduleProxyProvidersResync(0)
  }
}

/**
 * 合并式重拉 Provider 数据（默认 800ms 内只拉一次）。
 *
 * 批量测速会对每个节点各触发一次刷新，逐次全量重拉会打爆后端，
 * 因此统一走这里做去抖。
 */
export const scheduleProxyProvidersResync = (delayMs = 800) => {
  if (!hasLoadedProxyProviders.value) return

  clearTimeout(providerResyncTimer)
  providerResyncTimer = setTimeout(() => {
    providerResyncTimer = undefined
    void fetchProxyProviders(true).catch(() => {})
  }, delayMs)
}

/**
 * NebulaDash 统一刷新入口。
 *
 * 规则（重要）：凡是“数据可能已变化”的场景一律调它，而不是单独调 `fetchProxies()`。
 * `fetchProxies()` 只负责 `/proxies`，Provider 卡片的数据在另一份数据源里。
 *
 * `resyncProviders` 为 false 时只刷代理（极少场景，例如只关心组与节点选择状态）。
 */
export const refreshProxyData = async ({
  resyncProviders = true,
}: { resyncProviders?: boolean } = {}) => {
  await fetchProxies()

  if (resyncProviders) {
    scheduleProxyProvidersResync(0)
  }
}

/** 更新单个 Provider 的订阅，然后同步代理与 Provider 数据。 */
export const refreshProxyProvider = async (name: string) => {
  await updateProxyProvider(name)
  await syncAfterProviderChange()
}

/** 对单个 Provider 做健康检查，然后同步延迟与 Provider 数据。 */
export const healthCheckProxyProvider = async (name: string) => {
  await proxyProviderHealthCheck(name)
  await syncAfterProviderChange()
}

/** 更新全部 Provider 的订阅，然后同步数据。 */
export const refreshAllProxyProviders = async (names: string[]) => {
  await Promise.all(names.map((name) => updateProxyProvider(name)))
  await syncAfterProviderChange()
}

export const fetchSmartWeights = () => driver().proxies.fetchSmartWeights()

export const flushSmartGroupWeights = () => driver().proxies.flushSmartWeights()
