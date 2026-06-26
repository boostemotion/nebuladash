export type ProxyCacheKind = 'data' | 'providers' | 'provider-meta'

export type ProviderLoadStatus =
  | 'idle'
  | 'loading'
  | 'cached'
  | 'stale'
  | 'fresh'
  | 'timeout'
  | 'error'

export type ProviderCacheMeta = {
  fetchedAt: number
  durationMs: number
  status: Exclude<ProviderLoadStatus, 'idle' | 'loading'>
}

const CACHE_PREFIX_MAP: Record<ProxyCacheKind, string> = {
  data: 'cache/proxy-data',
  providers: 'cache/proxy-providers',
  'provider-meta': 'cache/proxy-provider-meta',
}

export const getProxyCacheKey = (kind: ProxyCacheKind, backendUuid: string) => {
  return `${CACHE_PREFIX_MAP[kind]}/${backendUuid || 'inactive'}`
}

export const getProviderFailureStatus = (error: unknown): 'timeout' | 'error' => {
  const code =
    typeof error === 'object' && error !== null && 'code' in error ? String(error.code) : ''

  return code === 'ECONNABORTED' || code === 'ETIMEDOUT' ? 'timeout' : 'error'
}

export const getCachedProviderLoadStatus = ({
  hasCachedProviders,
  fetchedAt,
  now,
  freshDurationMs,
}: {
  hasCachedProviders: boolean
  fetchedAt: number
  now: number
  freshDurationMs: number
}): 'cached' | 'stale' | null => {
  if (!hasCachedProviders) {
    return null
  }

  return now - fetchedAt < freshDurationMs ? 'cached' : 'stale'
}

export const shouldNotifyProviderFailure = ({
  lastNotifiedAt,
  now,
  dedupeMs,
}: {
  lastNotifiedAt: number
  now: number
  dedupeMs: number
}) => {
  return lastNotifiedAt <= 0 || now - lastNotifiedAt >= dedupeMs
}
