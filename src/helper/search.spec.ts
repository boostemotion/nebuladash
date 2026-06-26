import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHighlightedParts, matchesSearchTargets } from './search.ts'

test('highlights direct matches without changing surrounding text', () => {
  assert.deepEqual(buildHighlightedParts('ChatGPT / Domain', 'chatgpt'), [
    { text: 'ChatGPT', matched: true },
    { text: ' / Domain', matched: false },
  ])
})

test('highlights each meaningful segment for symbol-tolerant matches', () => {
  assert.deepEqual(buildHighlightedParts('香港 自动', '香港-自动'), [
    { text: '香港', matched: true },
    { text: ' ', matched: false },
    { text: '自动', matched: true },
  ])
})

test('uses domain label variants for highlighting', () => {
  assert.deepEqual(buildHighlightedParts('Google / Domain', 'google.com'), [
    { text: 'Google', matched: true },
    { text: ' / Domain', matched: false },
  ])
})

test('returns unmarked text when the query does not match', () => {
  assert.deepEqual(buildHighlightedParts('香港 自动', '日本'), [
    { text: '香港 自动', matched: false },
  ])
})

test('matches parent names with all search terms', () => {
  assert.equal(matchesSearchTargets('香港 自动', ['HK 01'], ['香港', '自动']), true)
})

test('matches child node names when parent name does not match', () => {
  assert.equal(matchesSearchTargets('香港 自动', ['HK 01', 'JP 01'], ['hk', '01']), true)
})

test('uses domain label variants when matching child nodes', () => {
  assert.equal(matchesSearchTargets('国外媒体', ['Google / Domain'], ['google.com']), true)
})

test('does not match when terms are split across different targets', () => {
  assert.equal(matchesSearchTargets('香港 自动', ['HK 01', 'JP 02'], ['hk', '02']), false)
})

test('returns true for empty target search terms', () => {
  assert.equal(matchesSearchTargets('香港 自动', ['HK 01'], []), true)
})
