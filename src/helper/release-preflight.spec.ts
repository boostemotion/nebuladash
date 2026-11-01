import assert from 'node:assert/strict'
import test from 'node:test'
import { getExpectedReleaseTag, validateReleasePreflight } from './release-preflight.ts'

test('builds the expected release tag from the package version', () => {
  assert.equal(getExpectedReleaseTag('3.30.0-nebula.1'), 'v3.30.0-nebula.1')
})

test('accepts NebulaDash releases that match the pushed tag', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '3.30.0-nebula.1',
      tagName: 'v3.30.0-nebula.1',
    }),
    {
      expectedTag: 'v3.30.0-nebula.1',
      errors: [],
    },
  )
})

test('accepts multi-level Nebula release versions that match the pushed tag', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '3.30.0-nebula.2.1.3',
      tagName: 'v3.30.0-nebula.2.1.3',
    }),
    {
      expectedTag: 'v3.30.0-nebula.2.1.3',
      errors: [],
    },
  )
})

test('rejects upstream-style versions without the Nebula suffix', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '3.30.0',
      tagName: 'v3.30.0',
    }),
    {
      expectedTag: 'v3.30.0',
      errors: ['package.json version must use the Nebula release format: x.y.z-nebula.a[.b[.c]]'],
    },
  )
})

test('rejects release tags that do not match package.json', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '3.30.0-nebula.1',
      tagName: 'v3.31.0-nebula.1',
    }),
    {
      expectedTag: 'v3.30.0-nebula.1',
      errors: [
        'release tag v3.31.0-nebula.1 must match package.json version tag v3.30.0-nebula.1',
      ],
    },
  )
})
