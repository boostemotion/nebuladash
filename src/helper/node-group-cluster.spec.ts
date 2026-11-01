import assert from 'node:assert/strict'
import test from 'node:test'
import {
  countNodeGroupUsageInStrategyGroups,
  getNodeVariantRank,
  normalizeNodeGroupBaseKey,
  sortNodeGroupsByVariantCluster,
  splitProxyGroupsByRole,
} from './node-group-cluster.ts'

test('normalizes node group base names by stripping variant suffixes', () => {
  assert.equal(normalizeNodeGroupBaseKey('香港-手动'), '香港')
  assert.equal(normalizeNodeGroupBaseKey('香港-自动'), '香港')
  assert.equal(normalizeNodeGroupBaseKey('香港-故转'), '香港')
  assert.equal(normalizeNodeGroupBaseKey('香港 手动'), '香港')
  assert.equal(normalizeNodeGroupBaseKey('香港（自动）'), '香港')
  assert.equal(normalizeNodeGroupBaseKey('香港【故转】'), '香港')
  assert.equal(normalizeNodeGroupBaseKey('HK-Manual'), 'hk')
  assert.equal(normalizeNodeGroupBaseKey('HK_Auto'), 'hk')
})

test('keeps unrelated names distinct', () => {
  assert.notEqual(normalizeNodeGroupBaseKey('香港-手动'), normalizeNodeGroupBaseKey('台湾-手动'))
})

test('ranks fallback above manual above auto', () => {
  assert.ok(getNodeVariantRank('香港-故转') < getNodeVariantRank('香港-手动'))
  assert.ok(getNodeVariantRank('香港-手动') < getNodeVariantRank('香港-自动'))
  assert.ok(getNodeVariantRank('香港-自动') < getNodeVariantRank('香港-负载均衡'))
})

test('respects custom variant patterns order', () => {
  const variants = ['主用|primary', '备用|backup']
  assert.equal(getNodeVariantRank('香港-主用', variants), 0)
  assert.equal(getNodeVariantRank('香港-备用', variants), 1)
  assert.equal(getNodeVariantRank('香港-其它', variants), 9)
})

test('counts how many strategy groups reference each node group chain', () => {
  const proxyMap = {
    ChatGPT: { now: '香港故转', type: 'selector' },
    Gemini: { now: '香港故转', type: 'selector' },
    香港故转: { now: '香港自动', type: 'fallback' },
    香港自动: { now: 'HK-01', type: 'urltest' },
    'HK-01': { type: 'ss' },
  }
  // 只有代理组参与链路计数，节点不参与（与真实 proxyGroupList 语义一致）
  const isGroupName = (name: string) => name in proxyMap && name !== 'HK-01'

  const counts = countNodeGroupUsageInStrategyGroups({
    strategyGroups: ['ChatGPT', 'Gemini'],
    proxyMap,
    isGroupName,
  })

  assert.equal(counts.get('香港故转'), 2)
  assert.equal(counts.get('香港自动'), 2)
  assert.equal(counts.get('HK-01'), undefined)
})

test('does not loop forever on cyclic group chains', () => {
  const proxyMap = {
    A: { now: 'B', type: 'selector' },
    B: { now: 'A', type: 'selector' },
  }
  const isGroupName = (name: string) => name in proxyMap

  const counts = countNodeGroupUsageInStrategyGroups({
    strategyGroups: ['A'],
    proxyMap,
    isGroupName,
  })

  assert.equal(counts.get('B'), 1)
})

test('sorts same-prefix groups adjacently and orders fallback > manual > auto', () => {
  const proxyMap = {
    香港自动: { type: 'urltest', now: 'HK-01' },
    台湾自动: { type: 'urltest' },
    香港故转: { type: 'fallback' },
    香港手动: { type: 'selector' },
  }
  const isGroupName = (name: string) => name in proxyMap

  const sorted = sortNodeGroupsByVariantCluster({
    groups: ['香港自动', '台湾自动', '香港故转', '香港手动'],
    strategyGroups: [],
    proxyMap,
    isGroupName,
  })

  // 同前缀簇必须相邻，且簇内顺序为 故转 > 手动 > 自动
  const hkIndexes = ['香港故转', '香港手动', '香港自动'].map((name) => sorted.indexOf(name))
  assert.equal(Math.max(...hkIndexes) - Math.min(...hkIndexes), 2)
  assert.deepEqual(sorted.filter((name) => name.startsWith('香港')), [
    '香港故转',
    '香港手动',
    '香港自动',
  ])
})

test('orders clusters by how often they are referenced by strategy groups', () => {
  const proxyMap = {
    台湾自动: { type: 'urltest' },
    香港故转: { type: 'fallback' },
    ChatGPT: { type: 'selector', now: '香港故转' },
  }
  const isGroupName = (name: string) => name in proxyMap

  const sorted = sortNodeGroupsByVariantCluster({
    groups: ['台湾自动', '香港故转'],
    strategyGroups: ['ChatGPT'],
    proxyMap,
    isGroupName,
  })

  assert.deepEqual(sorted, ['香港故转', '台湾自动'])
})

test('keeps original relative order for identical ranks and names', () => {
  const proxyMap = {
    新加坡: { type: 'urltest' },
    香港: { type: 'urltest' },
  }
  const isGroupName = (name: string) => name in proxyMap

  const sorted = sortNodeGroupsByVariantCluster({
    groups: ['新加坡', '香港'],
    strategyGroups: [],
    proxyMap,
    isGroupName,
  })

  assert.equal(sorted.length, 2)
  assert.deepEqual([...sorted].sort(), ['新加坡', '香港'])
})

test('splits groups by rule targets when rules are loaded', () => {
  const proxyMap = {
    ChatGPT: { type: 'selector' },
    香港故转: { type: 'fallback' },
  }

  const result = splitProxyGroupsByRole({
    groups: ['ChatGPT', '香港故转'],
    ruleTargets: new Set(['ChatGPT']),
    proxyMap,
  })

  assert.deepEqual(result.strategyGroups, ['ChatGPT'])
  assert.deepEqual(result.nodeGroups, ['香港故转'])
})

test('falls back to proxy types when rules are not loaded', () => {
  const proxyMap = {
    ChatGPT: { type: 'selector' },
    香港故转: { type: 'fallback' },
    香港自动: { type: 'urltest' },
    未知类型: { type: 'sometype' },
  }

  const result = splitProxyGroupsByRole({
    groups: ['ChatGPT', '香港故转', '香港自动', '未知类型'],
    ruleTargets: new Set(),
    proxyMap,
  })

  assert.deepEqual(result.strategyGroups, ['ChatGPT', '香港故转', '香港自动'])
  assert.deepEqual(result.nodeGroups, ['未知类型'])
})

test('drops groups missing from the proxy map', () => {
  const result = splitProxyGroupsByRole({
    groups: ['不存在'],
    ruleTargets: new Set(),
    proxyMap: {},
  })

  assert.deepEqual(result.strategyGroups, [])
  assert.deepEqual(result.nodeGroups, [])
})

test('returns a copy so the caller list is never mutated', () => {
  const groups = ['香港故转']
  const sorted = sortNodeGroupsByVariantCluster({
    groups,
    strategyGroups: [],
    proxyMap: { 香港故转: { type: 'fallback' } },
    isGroupName: (name: string) => name === '香港故转',
  })

  assert.notEqual(sorted, groups)
  assert.deepEqual(groups, ['香港故转'])
})
