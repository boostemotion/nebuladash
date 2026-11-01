import assert from 'node:assert/strict'
import test from 'node:test'
import { getExpectedReleaseTag, validateReleasePreflight } from './release-preflight.ts'

test('builds the expected release tag from the package version', () => {
  assert.equal(getExpectedReleaseTag('3.30.0-nebula.1'), 'v3.30.0-nebula.1')
})

test('accepts a tag that matches package.json', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '3.30.0-nebula.1',
      tagName: 'v3.30.0-nebula.1',
    }),
    { expectedTag: 'v3.30.0-nebula.1', errors: [], warnings: [] },
  )
})

test('accepts a tag that is ahead of package.json and warns instead of failing', () => {
  const result = validateReleasePreflight({
    packageName: 'nebuladash',
    version: '3.30.0-nebula.1',
    tagName: 'v3.30.0-nebula.5',
  })

  assert.deepEqual(result.errors, [])
  assert.equal(result.warnings.length, 1)
  assert.equal(result.expectedTag, 'v3.30.0-nebula.5')
})

test('accepts multi-level Nebula tags', () => {
  assert.deepEqual(
    validateReleasePreflight({
      packageName: 'nebuladash',
      version: '3.30.0-nebula.2.1.3',
      tagName: 'v3.30.0-nebula.2.1.3',
    }),
    { expectedTag: 'v3.30.0-nebula.2.1.3', errors: [], warnings: [] },
  )
})

test('rejects upstream-style tags without the Nebula suffix', () => {
  const result = validateReleasePreflight({
    packageName: 'nebuladash',
    version: '3.30.0-nebula.1',
    tagName: 'v3.30.0',
  })

  assert.equal(result.errors.length, 1)
  assert.match(result.errors[0]!, /must match v<x\.y\.z>-nebula/)
})

test('rejects non-Nebula package versions when no tag is given', () => {
  assert.deepEqual(validateReleasePreflight({ packageName: 'nebuladash', version: '3.30.0' }), {
    expectedTag: 'v3.30.0',
    errors: ['package.json version must use the Nebula release format: x.y.z-nebula.a[.b[.c]]'],
    warnings: [],
  })
})

test('rejects a package that is not nebuladash', () => {
  const result = validateReleasePreflight({
    packageName: 'zashboard',
    version: '3.30.0-nebula.1',
    tagName: 'v3.30.0-nebula.1',
  })

  assert.deepEqual(result.errors, ['package.json name must be nebuladash'])
})
