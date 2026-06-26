import assert from 'node:assert/strict'
import test from 'node:test'
import { buildHighlightedParts } from './search.ts'

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
