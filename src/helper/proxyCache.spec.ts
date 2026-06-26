import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getCachedProviderLoadStatus,
  getProviderFailureStatus,
  getProxyCacheKey,
  shouldNotifyProviderFailure,
  type ProxyCacheKind,
} from './proxyCache.ts'

test('scopes proxy caches by backend UUID', () => {
  const cases: Array<[ProxyCacheKind, string]> = [
    ['data', 'cache/proxy-data/backend-a'],
    ['providers', 'cache/proxy-providers/backend-a'],
    ['provider-meta', 'cache/proxy-provider-meta/backend-a'],
  ]

  for (const [kind, expected] of cases) {
    assert.equal(getProxyCacheKey(kind, 'backend-a'), expected)
  }
})

test('uses an inactive namespace when no backend is selected', () => {
  assert.equal(getProxyCacheKey('data', ''), 'cache/proxy-data/inactive')
})

test('classifies axios timeout errors separately from other failures', () => {
  assert.equal(getProviderFailureStatus({ code: 'ECONNABORTED' }), 'timeout')
  assert.equal(getProviderFailureStatus({ code: 'ETIMEDOUT' }), 'timeout')
  assert.equal(getProviderFailureStatus({ code: 'ERR_NETWORK' }), 'error')
  assert.equal(getProviderFailureStatus(null), 'error')
})

test('marks provider cache as cached when it is still fresh', () => {
  assert.equal(
    getCachedProviderLoadStatus({
      hasCachedProviders: true,
      fetchedAt: 1_000,
      now: 1_500,
      freshDurationMs: 1_000,
    }),
    'cached',
  )
})

test('marks provider cache as stale when it is older than the fresh duration', () => {
  assert.equal(
    getCachedProviderLoadStatus({
      hasCachedProviders: true,
      fetchedAt: 1_000,
      now: 2_001,
      freshDurationMs: 1_000,
    }),
    'stale',
  )
})

test('returns null provider cache status when no provider cache exists', () => {
  assert.equal(
    getCachedProviderLoadStatus({
      hasCachedProviders: false,
      fetchedAt: 1_000,
      now: 1_500,
      freshDurationMs: 1_000,
    }),
    null,
  )
})

test('allows the first provider failure notification', () => {
  assert.equal(
    shouldNotifyProviderFailure({
      lastNotifiedAt: 0,
      now: 10_000,
      dedupeMs: 60_000,
    }),
    true,
  )
})

test('dedupes provider failure notifications inside the same window', () => {
  assert.equal(
    shouldNotifyProviderFailure({
      lastNotifiedAt: 10_000,
      now: 30_000,
      dedupeMs: 60_000,
    }),
    false,
  )
})

test('allows provider failure notifications after the dedupe window', () => {
  assert.equal(
    shouldNotifyProviderFailure({
      lastNotifiedAt: 10_000,
      now: 70_000,
      dedupeMs: 60_000,
    }),
    true,
  )
})
