import assert from 'node:assert/strict'
import test from 'node:test'
import type { ProxyProvider } from '@/types'
import { getProviderSearchTargets, matchesProviderSearch } from './proxy-provider-search.ts'
import { toSmartSearchMatcher } from './search.ts'

const provider: ProxyProvider = {
  name: 'airport-a',
  testUrl: 'https://www.gstatic.com/generate_204',
  updatedAt: '2026-11-01T09:00:00Z',
  vehicleType: 'HTTP',
  proxies: [{ name: 'HK-01' } as ProxyProvider['proxies'][number]],
  subscriptionInfo: {
    Download: 5e10,
    Upload: 1e9,
    Total: 1e12,
    Expire: 1893456000,
  },
}

const matcher = (filter: string) => {
  const m = toSmartSearchMatcher(filter)
  assert.ok(m, `expected matcher for ${filter}`)
  return m!
}

test('matches provider name', () => {
  assert.equal(matchesProviderSearch(provider, matcher('airport')), true)
  assert.equal(matchesProviderSearch(provider, matcher('other')), false)
})

test('matches test url', () => {
  assert.equal(matchesProviderSearch(provider, matcher('gstatic')), true)
  assert.equal(matchesProviderSearch(provider, matcher('generate_204')), true)
})

test('matches provider vehicle type and updated time', () => {
  assert.equal(matchesProviderSearch(provider, matcher('http')), true)
  assert.equal(matchesProviderSearch(provider, matcher('2026-11-01')), true)
})

test('matches subscription metadata including expire date', () => {
  assert.equal(matchesProviderSearch(provider, matcher('expire-date 2030-01-01')), true)
  assert.equal(matchesProviderSearch(provider, matcher('total')), true)
})

test('requires every keyword to hit the provider targets', () => {
  assert.equal(matchesProviderSearch(provider, matcher('airport gstatic')), true)
  assert.equal(matchesProviderSearch(provider, matcher('airport gstatic total')), true)
  assert.equal(matchesProviderSearch(provider, matcher('airport unknownword')), false)
})

test('collects targets without empty entries', () => {
  const targets = getProviderSearchTargets({
    name: 'p',
    testUrl: '',
    updatedAt: '',
    vehicleType: '',
    proxies: [],
  })

  assert.deepEqual(targets, ['p'])
})

test('does not read provider node names here (handled by node search mode)', () => {
  assert.equal(matchesProviderSearch(provider, matcher('HK-01')), false)
})
