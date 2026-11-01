import assert from 'node:assert/strict'
import test from 'node:test'
import {
  getSearchTermVariants,
  getSearchTextParts,
  normalizeSearchText,
  simplifySearchText,
  splitSearchTerms,
  toSearchRegex,
  toSmartSearchMatcher,
} from './search.ts'

test('normalizes full-width and compatibility characters', () => {
  assert.equal(normalizeSearchText('ＧＯＯＧＬＥ'), 'google')
  assert.equal(normalizeSearchText('  Hong Kong  '), 'hong kong')
})

test('simplifies text by dropping symbols', () => {
  assert.equal(simplifySearchText('google.com'), 'googlecom')
  assert.equal(simplifySearchText('香港-故转'), '香港故转')
})

test('splits keywords on space, comma and ideographic comma', () => {
  assert.deepEqual(splitSearchTerms('香港 自动'), ['香港', '自动'])
  assert.deepEqual(splitSearchTerms('Gemini,香港-故转'), ['gemini', '香港-故转'])
  assert.deepEqual(splitSearchTerms('香港、自动'), ['香港', '自动'])
  assert.deepEqual(splitSearchTerms('   '), [])
})

test('keeps pipe as regex alternation to stay compatible with upstream', () => {
  assert.deepEqual(splitSearchTerms('香港|故转'), ['香港|故转'])

  const matcher = toSmartSearchMatcher('香港|故转')

  assert.ok(matcher)
  assert.equal(matcher!.test('香港-自动'), true)
  assert.equal(matcher!.test('香港-故转'), true)
  assert.equal(matcher!.test('台湾-自动'), false)
})

test('expands domain terms into label variants and drops noise labels', () => {
  assert.deepEqual(getSearchTermVariants('google.com'), ['google.com', 'google'])
  assert.deepEqual(getSearchTermVariants('www.google.com'), ['www.google.com', 'google'])
  assert.deepEqual(getSearchTermVariants('a.b.com'), ['a.b.com'])
})

test('keeps multi keyword AND semantics', () => {
  const matcher = toSmartSearchMatcher('香港 自动')

  assert.ok(matcher)
  assert.equal(matcher!.test('香港-自动'), true)
  assert.equal(matcher!.test('香港-手动'), false)
  assert.equal(matcher!.test('台湾-自动'), false)
})

test('matches domain keywords against candidates without the suffix', () => {
  const matcher = toSmartSearchMatcher('google.com')

  assert.ok(matcher)
  assert.equal(matcher!.test('Google'), true)
  assert.equal(matcher!.test('google.com'), true)
  assert.equal(matcher!.test('openai.com'), false)
})

test('tolerates symbols in both query and candidate', () => {
  const matcher = toSmartSearchMatcher('google-com')

  assert.ok(matcher)
  assert.equal(matcher!.test('google.com'), true)
  assert.equal(matcher!.test('googlecom'), true)
})

test('still supports explicit regular expressions', () => {
  const matcher = toSmartSearchMatcher('^香港-(自动|手动)$')

  assert.ok(matcher)
  assert.equal(matcher!.test('香港-自动'), true)
  assert.equal(matcher!.test('香港-负载均衡'), false)
})

test('returns null for empty filters so callers can show everything', () => {
  assert.equal(toSmartSearchMatcher(''), null)
  assert.equal(toSmartSearchMatcher('   '), null)
})

test('testAny matches when any candidate satisfies every keyword', () => {
  const matcher = toSmartSearchMatcher('gemini 香港')

  assert.ok(matcher)
  assert.equal(matcher!.testAny(['Gemini', '香港-故转']), true)
  assert.equal(matcher!.testAny(['Gemini', '台湾-故转']), false)
})

test('strict regex matcher keeps upstream behaviour for explicit regex inputs', () => {
  const matcher = toSearchRegex('香港-自动')

  assert.ok(matcher)
  assert.equal(matcher!.test('香港-自动'), true)
  assert.equal(matcher!.test('香港自动'), false)
})

test('highlights the direct match ranges', () => {
  const parts = getSearchTextParts('香港-自动', '自动')

  assert.deepEqual(parts, [
    { text: '香港-', matched: false },
    { text: '自动', matched: true },
  ])
})

test('highlights domain variant matches', () => {
  const parts = getSearchTextParts('Google DNS', 'google.com')

  assert.deepEqual(parts, [
    { text: 'Google', matched: true },
    { text: ' DNS', matched: false },
  ])
})

test('highlights symbol tolerant matches by mapping back to the source text', () => {
  const parts = getSearchTextParts('google.com', 'google-com')
  const matchedText = parts
    .filter((part) => part.matched)
    .map((part) => part.text)
    .join('')

  assert.equal(matchedText, 'googlecom'.replace('com', '') + 'com')
  assert.ok(parts.every((part) => part.matched || part.text.length > 0))
})

test('returns a single unmatched part when nothing matches', () => {
  assert.deepEqual(getSearchTextParts('香港-自动', '台湾'), [
    { text: '香港-自动', matched: false },
  ])
})
