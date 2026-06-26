import assert from 'node:assert/strict'
import test from 'node:test'
import type { ProxyProvider } from '../types'
import { getProviderSearchTargets, matchesProviderSearchTarget } from './proxyProviderSearch.ts'

const createProvider = (overrides: Partial<ProxyProvider> = {}): ProxyProvider => ({
  name: 'Airport A',
  proxies: [
    {
      name: 'HK 01',
      type: 'ss',
      history: [],
      extra: {},
      udp: true,
      now: '',
      icon: '',
    },
  ],
  testUrl: 'https://cp.cloudflare.com',
  updatedAt: '2026-06-26T00:00:00Z',
  vehicleType: 'HTTP',
  subscriptionInfo: {
    Download: 1024,
    Upload: 2048,
    Total: 4096,
    Expire: 1798761600,
  },
  ...overrides,
})

test('provider search targets include provider metadata and subscription fields', () => {
  const targets = getProviderSearchTargets(createProvider())

  assert.equal(targets.includes('Airport A'), true)
  assert.equal(targets.includes('HK 01'), true)
  assert.equal(targets.includes('https://cp.cloudflare.com'), true)
  assert.equal(targets.includes('HTTP'), true)
  assert.equal(targets.includes('2026-06-26T00:00:00Z'), true)
  assert.equal(targets.includes('download 1024'), true)
  assert.equal(targets.includes('upload 2048'), true)
  assert.equal(targets.includes('total 4096'), true)
  assert.equal(targets.includes('expire 1798761600'), true)
  assert.equal(targets.includes('expire-date 2027-01-01'), true)
})

test('provider search matches subscription expiry date', () => {
  assert.equal(matchesProviderSearchTarget(createProvider(), ['2027-01-01']), true)
})

test('provider search matches provider node names', () => {
  assert.equal(matchesProviderSearchTarget(createProvider(), ['hk', '01']), true)
})

test('provider search does not split terms across unrelated provider targets', () => {
  assert.equal(
    matchesProviderSearchTarget(
      createProvider({
        name: 'HK Provider',
        proxies: [
          {
            name: 'JP 02',
            type: 'ss',
            history: [],
            extra: {},
            udp: true,
            now: '',
            icon: '',
          },
        ],
      }),
      ['hk', '02'],
    ),
    false,
  )
})

test('provider search treats empty terms as a match', () => {
  assert.equal(matchesProviderSearchTarget(createProvider(), []), true)
})
