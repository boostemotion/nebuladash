import {
  deleteFixedProxyAPI,
  disconnectByIdAPI,
  fetchProxiesAPI,
  fetchProxyGroupLatencyAPI,
  fetchProxyLatencyAPI,
  fetchProxyProviderAPI,
  isSingBox,
  selectProxyAPI,
} from '@/api'
import {
  GLOBAL,
  IPV6_TEST_URL,
  NOT_CONNECTED,
  PROXY_TAB_TYPE,
  PROXY_TYPE,
  TEST_URL,
} from '@/constant'
import { isProxyGroup } from '@/helper'
import { showNotification } from '@/helper/notification'
import {
  getCachedProviderLoadStatus,
  getProviderFailureStatus,
  getProxyCacheKey,
  shouldNotifyProviderFailure,
  type ProviderCacheMeta,
  type ProviderLoadStatus,
} from '@/helper/proxyCache'
import type { Proxy, ProxyProvider } from '@/types'
import { useStorage } from '@vueuse/core'
import { last } from 'lodash'
import pLimit from 'p-limit'
import { computed, nextTick, ref, watch } from 'vue'
import { activeConnections } from './connections'
import {
  automaticDisconnection,
  groupTestUrls,
  iconReflectList,
  independentLatencyTest,
  IPv6test,
  speedtestTimeout,
  speedtestUrl,
} from './settings'
import { activeUuid } from './setup'
import { initSmartWeights } from './smart'

export const proxiesFilter = ref('')
export const proxiesTabShow = ref(PROXY_TAB_TYPE.STRATEGY)

export const proxyGroupList = ref<string[]>([])
export const proxyMap = ref<Record<string, Proxy>>({})
export const IPv6Map = useStorage<Record<string, boolean>>('config/ipv6-map', {})
export const hiddenGroupMap = useStorage<Record<string, boolean>>('config/hidden-group-map', {})
export const proxyProviederList = ref<ProxyProvider[]>([])
export const isProxyLoading = ref(false)
export const proxyProviderLoadStatus = ref<ProviderLoadStatus>('idle')
const cachedProxyData = useStorage<{ proxies: Record<string, Proxy> } | null>(
  () => getProxyCacheKey('data', activeUuid.value),
  null,
)
const cachedProxyProviders = useStorage<ProxyProvider[]>(
  () => getProxyCacheKey('providers', activeUuid.value),
  [],
)
const cachedProxyProviderMeta = useStorage<ProviderCacheMeta | null>(
  () => getProxyCacheKey('provider-meta', activeUuid.value),
  null,
)
const hasLoadedProxyProviders = ref(false)
export const proxyProviderLastUpdatedAt = computed(
  () => cachedProxyProviderMeta.value?.fetchedAt ?? 0,
)
export const proxyProviderRequestDurationMs = computed(
  () => cachedProxyProviderMeta.value?.durationMs ?? 0,
)
export const proxyNodeProviderMap = computed<Record<string, string>>(() => {
  const result: Record<string, string> = {}

  proxyProviederList.value.forEach((provider) => {
    provider.proxies.forEach((proxy) => {
      result[proxy.name] = provider.name
    })
  })

  return result
})

const speedtestUrlWithDefault = computed(() => {
  return speedtestUrl.value || TEST_URL
})

export const getTestUrl = (groupName?: string) => {
  if (!groupName || !independentLatencyTest.value) {
    return speedtestUrlWithDefault.value
  }

  const groupTestUrl = groupTestUrls.value.find((item) => item.name === groupName)

  if (groupTestUrl) {
    return groupTestUrl.url
  }

  const proxyNode =
    proxyMap.value[groupName] || proxyProviederList.value.find((p) => p.name === groupName)

  return proxyNode?.testUrl || speedtestUrlWithDefault.value
}

export const getLatencyByName = (proxyName: string, groupName?: string) => {
  const history = getHistoryByName(proxyName, groupName)

  return getLatencyFromHistory(history)
}

export const getHistoryByName = (proxyName: string, groupName?: string) => {
  if (independentLatencyTest.value && !isSingBox.value) {
    const proxyNode = proxyMap.value[proxyName]
    const url = getTestUrl(groupName)

    if (!proxyNode) {
      return []
    }

    if (!proxyNode?.extra) {
      proxyNode.extra = {}
    }

    if (!proxyNode.extra?.[url]) {
      proxyNode.extra[url] = {
        history: [],
        alive: true,
      }
    }

    return proxyNode?.extra?.[url]?.history
  }

  const nowNode = proxyMap.value[getNowProxyNodeName(proxyName)]

  return nowNode?.history
}

export const getIPv6ByName = (proxyName: string) => {
  return IPv6Map.value[getNowProxyNodeName(proxyName)]
}

const PROVIDER_CACHE_FRESH_DURATION = 30 * 60 * 1000
const PROVIDER_FAILURE_NOTIFICATION_DEDUPE = 60 * 1000
let fetchGeneration = 0
let lastProxyData: { proxies: Record<string, Proxy> } | null = null
let lastProxyProviderFailureNotifiedAt = 0
let proxyLoadingPromise: Promise<void> | null = null
let proxyProviderLoadingPromise: Promise<void> | null = null

const applyProxyData = (
  proxyData: { proxies: Record<string, Proxy> },
  providers: ProxyProvider[] = proxyProviederList.value,
) => {
  const sortIndex = proxyData.proxies[GLOBAL].all ?? []
  const allProviderProxies: Record<string, Proxy> = {}

  for (const provider of providers) {
    for (const proxy of provider.proxies) {
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
      // 都在 sortIndex 中，按索引排序
      return prevIndex - nextIndex
    })
    .map((proxy) => proxy.name)

  proxyProviederList.value = providers

  const smartGroups: string[] = []

  Object.entries(proxyMap.value).forEach(([name, proxy]) => {
    const iconReflect = iconReflectList.value.find((icon) => icon.name === name)

    if (iconReflect) {
      proxyMap.value[name].icon = iconReflect.icon
    }
    if (IPv6test.value && getIPv6FromExtra(proxy)) {
      IPv6Map.value[name] = true
    }

    if (proxy.type.toLowerCase() === PROXY_TYPE.Smart) {
      smartGroups.push(name)
    }
  })

  if (smartGroups.length > 0) {
    initSmartWeights(smartGroups)
  }
}

const hydrateProxyStateFromCache = () => {
  lastProxyData = cachedProxyData.value
  const hasCachedProviders = cachedProxyProviders.value.length > 0
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
    applyProxyData(lastProxyData, cachedProxyProviders.value)
    return
  }

  proxyMap.value = {}
  proxyGroupList.value = []
  proxyProviederList.value = cachedProxyProviders.value
}

watch(
  activeUuid,
  async () => {
    fetchGeneration++
    proxyLoadingPromise = null
    proxyProviderLoadingPromise = null
    isProxyLoading.value = false
    proxyProviderLoadStatus.value = 'idle'
    lastProxyData = null
    lastProxyProviderFailureNotifiedAt = 0
    proxyMap.value = {}
    proxyGroupList.value = []
    proxyProviederList.value = []

    await nextTick()
    hydrateProxyStateFromCache()
  },
  { immediate: true },
)

export const fetchProxies = async () => {
  if (proxyLoadingPromise) {
    return proxyLoadingPromise
  }

  const requestGeneration = ++fetchGeneration
  const requestBackendUuid = activeUuid.value

  isProxyLoading.value = true

  const request = fetchProxiesAPI()
    .then((proxyRes) => {
      if (fetchGeneration !== requestGeneration || activeUuid.value !== requestBackendUuid) {
        return
      }

      const proxyData = proxyRes.data
      lastProxyData = proxyData
      cachedProxyData.value = proxyData

      applyProxyData(proxyData)
    })
    .finally(() => {
      if (proxyLoadingPromise === request) {
        isProxyLoading.value = false
        proxyLoadingPromise = null
      }
    })

  proxyLoadingPromise = request
  return proxyLoadingPromise
}

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

  const request = fetchProxyProviderAPI()
    .then((providerRes) => {
      if (
        fetchGeneration !== requestGeneration ||
        activeUuid.value !== requestBackendUuid ||
        !lastProxyData
      ) {
        return
      }

      const providers = Object.values(providerRes.data.providers).filter(
        (provider) => provider.name !== 'default' && provider.vehicleType !== 'Compatible',
      )

      hasLoadedProxyProviders.value = true
      cachedProxyProviders.value = providers
      cachedProxyProviderMeta.value = {
        fetchedAt: Date.now(),
        durationMs: Math.round(performance.now() - requestStartedAt),
        status: 'fresh',
      }
      lastProxyProviderFailureNotifiedAt = 0
      proxyProviderLoadStatus.value = 'fresh'
      applyProxyData(lastProxyData, providers)
    })
    .catch((error) => {
      if (fetchGeneration === requestGeneration && activeUuid.value === requestBackendUuid) {
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
            lastNotifiedAt: lastProxyProviderFailureNotifiedAt,
            now,
            dedupeMs: PROVIDER_FAILURE_NOTIFICATION_DEDUPE,
          })
        ) {
          lastProxyProviderFailureNotifiedAt = now
          showNotification({
            content:
              failureStatus === 'timeout' ? 'providerLoadTimeoutTip' : 'providerLoadErrorTip',
            key: `proxy-provider-load-${requestBackendUuid}`,
            type: 'alert-error',
          })
        }
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
  const proxyGroup = proxyMap.value[proxyGroupName]

  if (proxyGroup.type.toLowerCase() === PROXY_TYPE.LoadBalance) return
  if (proxyGroup.now === proxyName) {
    await fetchProxies()
    if (proxyGroup.now === proxyName) return
  }

  await selectProxyAPI(proxyGroupName, proxyName)
  proxyMap.value[proxyGroupName].now = proxyName

  if (automaticDisconnection.value) {
    activeConnections.value
      .filter((c) => c.chains.includes(proxyGroupName))
      .forEach((c) => disconnectByIdAPI(c.id))
  }
  fetchProxies()
}

const latencyTestForSingle = async (proxyName: string, url: string, timeout: number) => {
  const now = getNowProxyNodeName(proxyName)

  if (IPv6test.value) {
    try {
      const { data: ipv6LatencyResult } = await fetchProxyLatencyAPI(now, IPV6_TEST_URL, 2000)

      IPv6Map.value[now] = ipv6LatencyResult.delay > NOT_CONNECTED
    } catch {
      IPv6Map.value[now] = false
    }
  }

  return await fetchProxyLatencyAPI(independentLatencyTest.value ? proxyName : now, url, timeout)
}

const getNameForNotification = (name: string, url: string) => {
  if (independentLatencyTest.value) {
    return `${name}\n@${url}`
  }

  return name
}

export const proxyLatencyTest = async (
  proxyName: string,
  url = speedtestUrlWithDefault.value,
  timeout = speedtestTimeout.value,
) => {
  const res = await latencyTestForSingle(proxyName, url, timeout)
  await fetchProxies()

  if (res.status !== 200) {
    showNotification({
      content: 'testFailedTip',
      params: {
        name: getNameForNotification(proxyName, url),
      },
      type: 'alert-error',
    })
  }
}

const setHistory = (proxyName: string, delay: number) => {
  const history = getHistoryByName(proxyName)
  const now = new Date()

  history.push({
    time: now.toISOString(),
    delay,
  })
}

const TIP_KEY = 'testLatencyOneByOneWithTip'
const limiter = pLimit(5)
const testLatencyOneByOneWithTip = async (
  proxyGroupName: string,
  nodes: string[],
  url = speedtestUrlWithDefault.value,
) => {
  const total = nodes.length
  let testDone = 0
  let testFailed = 0

  await Promise.allSettled(
    nodes.map((name) =>
      limiter(async () => {
        const res = await latencyTestForSingle(name, url, Math.min(1500, speedtestTimeout.value))

        if (res.status !== 200) {
          testFailed++
          setHistory(name, NOT_CONNECTED)
        } else {
          setHistory(name, res.data.delay)
        }
        testDone++
        showNotification({
          content: 'testFinishedTip',
          key: TIP_KEY + proxyGroupName,
          params: {
            name: getNameForNotification(proxyGroupName, url),
            total: total.toString(),
            number: testDone.toString(),
          },
          type: 'alert-info',
          timeout: 0,
        })
      }),
    ),
  )
  showNotification({
    content: 'testFinishedResultTip',
    key: TIP_KEY + proxyGroupName,
    params: {
      name: getNameForNotification(proxyGroupName, url),
      total: total.toString(),
      success: `${total - testFailed}`,
      failed: `${testFailed}`,
    },
    type: testFailed ? 'alert-warning' : 'alert-success',
    timeout: 3000,
  })
  await fetchProxies()
}

export const proxyGroupLatencyTest = async (proxyGroupName: string) => {
  const proxyNode = proxyMap.value[proxyGroupName]
  const all = proxyNode.all ?? []
  const url = getTestUrl(proxyGroupName)

  if (
    [PROXY_TYPE.Selector, PROXY_TYPE.LoadBalance, PROXY_TYPE.Smart].includes(
      proxyNode.type.toLowerCase() as PROXY_TYPE,
    )
  ) {
    if (proxyNode.fixed) {
      deleteFixedProxyAPI(proxyGroupName)
    }
    return testLatencyOneByOneWithTip(proxyGroupName, all, url)
  }

  const timeout = Math.max(5000, speedtestTimeout.value)

  if (IPv6test.value) {
    try {
      const { data: ipv6LatencyResult } = await fetchProxyGroupLatencyAPI(
        proxyGroupName,
        IPV6_TEST_URL,
        timeout,
      )

      all?.forEach((name) => {
        IPv6Map.value[getNowProxyNodeName(name)] = ipv6LatencyResult[name] > NOT_CONNECTED
      })
    } catch {
      all?.forEach((name) => {
        IPv6Map.value[getNowProxyNodeName(name)] = false
      })
    }
  }
  await fetchProxyGroupLatencyAPI(proxyGroupName, url, timeout)
  await fetchProxies()

  const total = all.length
  const testFailed = all.filter(
    (name) => getLatencyByName(name, proxyGroupName) === NOT_CONNECTED,
  ).length

  showNotification({
    content: 'testFinishedResultTip',
    key: TIP_KEY + proxyGroupName,
    params: {
      name: getNameForNotification(proxyGroupName, url),
      total: total.toString(),
      success: `${total - testFailed}`,
      failed: `${testFailed}`,
    },
    type: testFailed ? 'alert-warning' : 'alert-success',
    timeout: 3000,
  })
}

export const allProxiesLatencyTest = async () => {
  if (independentLatencyTest.value) {
    const limit = pLimit(3)

    return await Promise.all(
      proxyGroupList.value.map((proxyGroupName) =>
        limit(async () => {
          await proxyGroupLatencyTest(proxyGroupName)
        }),
      ),
    )
  }

  const proxyNode = Object.keys(proxyMap.value).filter((proxy) => !isProxyGroup(proxy))

  return testLatencyOneByOneWithTip('all', proxyNode)
}

const getLatencyFromHistory = (history: Proxy['history']) => {
  return last(history)?.delay ?? NOT_CONNECTED
}

const getIPv6FromExtra = (proxy: Proxy) => {
  const ipv6History = proxy.extra?.[IPV6_TEST_URL]?.history

  return (last(ipv6History)?.delay ?? NOT_CONNECTED) > NOT_CONNECTED
}

export const getNowProxyNodeName = (name: string) => {
  let node = proxyMap.value[name]

  if (!name || !node) {
    return name
  }

  while (node.now && node.now !== node.name) {
    const nextNode = proxyMap.value[node.now]

    if (!nextNode) {
      return node.name
    }

    node = nextNode
  }

  return node.name
}

export const getProxyGroupChains = (name: string) => {
  let proxyNode = proxyMap.value[name]

  if (!proxyNode) {
    return []
  }

  const result = [name]

  while (
    proxyNode.now &&
    proxyNode.now !== proxyNode.name &&
    proxyGroupList.value.includes(proxyNode.now)
  ) {
    result.push(proxyNode.now)
    proxyNode = proxyMap.value[proxyNode.now]
  }
  return result
}

export const hasSmartGroup = computed(() => {
  return Object.values(proxyMap.value).some(
    (proxy) => proxy.type.toLowerCase() === PROXY_TYPE.Smart,
  )
})
