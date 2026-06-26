import assert from 'node:assert/strict'
import test from 'node:test'
import { getProviderFailureStatus, getProxyCacheKey, type ProxyCacheKind } from './proxyCache.ts'

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
