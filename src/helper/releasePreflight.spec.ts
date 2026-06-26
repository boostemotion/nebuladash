import assert from 'node:assert/strict'
import test from 'node:test'
import { getExpectedReleaseTag, validateReleasePreflight } from './releasePreflight.ts'

test('builds the expected release tag from the package version', () => {
  assert.equal(getExpectedReleaseTag('2.8.0-nebula.2'), 'v2.8.0-nebula.2')
})

test('accepts NebulaDash patch releases that match the pushed tag', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '2.8.0-nebula.2',
      tagName: 'v2.8.0-nebula.2',
    }),
    {
      expectedTag: 'v2.8.0-nebula.2',
      errors: [],
    },
  )
})

test('rejects upstream-style versions without the Nebula suffix', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '3.2.0',
      tagName: 'v3.2.0',
    }),
    {
      expectedTag: 'v3.2.0',
      errors: ['package.json version must use the Nebula release format: x.y.z-nebula.n'],
    },
  )
})

test('rejects release tags that do not match package.json', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '2.8.0-nebula.2',
      tagName: 'v3.2.0',
    }),
    {
      expectedTag: 'v2.8.0-nebula.2',
      errors: ['release tag v3.2.0 must match package.json version tag v2.8.0-nebula.2'],
    },
  )
})
