import { can } from '@/assembly/backend'
import { StorageSerializers } from '@vueuse/core'
import { useStorage } from '@/composables/use-storage'
import { NOT_CONNECTED, PROXY_TYPE, TEST_URL } from '@/constant'
import { getProxyCacheKey, type ProviderCacheMeta, type ProviderLoadStatus } from '@/helper/proxy-cache'
import { activeUuid } from '@/store/setup'
import { groupTestUrls, independentLatencyTest, speedtestUrl } from '@/store/settings'
import type { Proxy, ProxyProvider } from '@/types'
import { last } from 'lodash'
import { computed, effectScope, ref, toValue, type ComputedRef, type MaybeRefOrGetter } from 'vue'

export const proxyGroupList = ref<string[]>([])
export const proxyMap = ref<Record<string, Proxy>>({})
export const IPv6Map = useStorage<Record<string, boolean>>('cache/ipv6-map', {})
export const proxyProviederList = ref<ProxyProvider[]>([])

/**
 * NebulaDash: Provider 独立加载状态。
 *
 * OpenClash 下 `/providers/proxies` 可能十几秒才返回甚至超时，因此：
 * - Provider 数据只在需要时请求（代理页“代理商”标签 / 手动刷新）；
 * - 请求结果与元数据按后端 UUID 缓存，用于先缓存起屏；
 * - 失败时保留旧数据，并把状态暴露给界面。
 */
export const proxyProviderLoadStatus = ref<ProviderLoadStatus>('idle')
export const hasLoadedProxyProviders = ref(false)

/*
 * NebulaDash: 显式指定序列化器。
 *
 * vueuse 会根据默认值推断序列化器，默认值为 `null` 时无法推断，会退化成 String(),
 * 结果把代理缓存写成 `"[object Object]"`，再读回来就成了字符串。
 * 这三项必须显式使用 object 序列化器。
 */
export const cachedProxyData = useStorage<{ proxies: Record<string, Proxy> } | null>(
  () => getProxyCacheKey('data', activeUuid.value),
  null,
  localStorage,
  { serializer: StorageSerializers.object },
)
export const cachedProxyProviders = useStorage<ProxyProvider[]>(
  () => getProxyCacheKey('providers', activeUuid.value),
  [],
  localStorage,
  { serializer: StorageSerializers.object },
)
export const cachedProxyProviderMeta = useStorage<ProviderCacheMeta | null>(
  () => getProxyCacheKey('provider-meta', activeUuid.value),
  null,
  localStorage,
  { serializer: StorageSerializers.object },
)

export const proxyProviderLastUpdatedAt = computed(
  () => cachedProxyProviderMeta.value?.fetchedAt ?? 0,
)
export const proxyProviderRequestDurationMs = computed(
  () => cachedProxyProviderMeta.value?.durationMs ?? 0,
)

export type LatencyMap = Map<string, number>

export const speedtestUrlWithDefault = computed(() => {
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

export const getLatencyFromHistory = (history?: Proxy['history']) => {
  return last(history)?.delay ?? NOT_CONNECTED
}

const DEFAULT_TEST_URL_BUCKET = ''

const latencyMapCache = new Map<string, ComputedRef<LatencyMap>>()

const readHistory = (proxyName: string, testUrl: string) => {
  const proxyNode = proxyMap.value[proxyName]

  if (testUrl !== DEFAULT_TEST_URL_BUCKET) {
    if (!proxyNode) {
      return undefined
    }

    if (proxyNode.extra) {
      return proxyNode.extra[testUrl]?.history
    }
  }

  return proxyMap.value[getNowProxyNodeName(proxyName)]?.history
}

const latencyScope = effectScope(true)

const getLatencyMap = (testUrl: string) => {
  let latencyMap = latencyMapCache.get(testUrl)

  if (!latencyMap) {
    latencyMap = latencyScope.run(() =>
      computed(() => {
        const result: LatencyMap = new Map()

        for (const name of Object.keys(proxyMap.value)) {
          result.set(name, getLatencyFromHistory(readHistory(name, testUrl)))
        }

        return result
      }),
    )!
    latencyMapCache.set(testUrl, latencyMap)
  }

  return latencyMap
}

const getTestUrlBucket = (groupName?: string) => {
  if (groupName && independentLatencyTest.value && can('independentLatency')) {
    return getTestUrl(groupName)
  }

  return DEFAULT_TEST_URL_BUCKET
}

export const latencyMapOf = (groupName?: MaybeRefOrGetter<string | undefined>) =>
  computed(() => getLatencyMap(getTestUrlBucket(toValue(groupName))).value)

export const getLatencyByName = (proxyName: string, groupName?: string) => {
  return getLatencyMap(getTestUrlBucket(groupName)).value.get(proxyName) ?? NOT_CONNECTED
}

export const getHistoryByName = (proxyName: string, groupName?: string) => {
  if (groupName && independentLatencyTest.value && can('independentLatency')) {
    const proxyNode = proxyMap.value[proxyName]
    const url = getTestUrl(groupName)

    if (!proxyNode) {
      return []
    }

    if (!proxyNode?.extra) {
      const nowNode = proxyMap.value[getNowProxyNodeName(proxyName)]

      return nowNode?.history
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

const untestableProxyTypes = new Set([PROXY_TYPE.Reject, PROXY_TYPE.RejectDrop, PROXY_TYPE.Block])

export const isLatencyTestable = (name: string) => {
  const type = proxyMap.value[name]?.type.toLowerCase() as PROXY_TYPE | undefined

  return !type || !untestableProxyTypes.has(type)
}

export const getProviderNameByProxy = (proxyName: string) => {
  const hinted = proxyMap.value[proxyName]?.['provider-name']

  if (hinted) {
    return proxyProviederList.value.some((provider) => provider.name === hinted) ? hinted : ''
  }

  return (
    proxyProviederList.value.find((provider) =>
      provider.proxies.some((proxy) => proxy.name === proxyName),
    )?.name ?? ''
  )
}
