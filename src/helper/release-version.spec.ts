import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareReleaseVersion,
  fetchLatestReleaseTag,
  getLatestReleaseApiUrl,
  getReleaseUpdateState,
  isNewerReleaseVersion,
  NEBULADASH_REPOSITORY,
} from './release-version.ts'

test('uses the NebulaDash repository for release checks', () => {
  assert.equal(NEBULADASH_REPOSITORY, 'boostemotion/nebuladash')
  assert.equal(
    getLatestReleaseApiUrl(),
    'https://api.github.com/repos/boostemotion/nebuladash/releases/latest',
  )
})

test('detects newer NebulaDash prereleases', () => {
  assert.equal(isNewerReleaseVersion('v3.30.0-nebula.2', '3.30.0-nebula.1'), true)
  assert.equal(isNewerReleaseVersion('v3.30.0-nebula.1', '3.30.0-nebula.1'), false)
  assert.equal(isNewerReleaseVersion('v3.30.0-nebula.0', '3.30.0-nebula.1'), false)
  assert.equal(isNewerReleaseVersion('v3.30.0-nebula.2.1.0', '3.30.0-nebula.2.0.9'), true)
  assert.equal(isNewerReleaseVersion('v3.30.0-nebula.2.1.0', '3.30.0-nebula.2.1.0'), false)
  assert.equal(isNewerReleaseVersion('v3.30.0-nebula.2.0.9', '3.30.0-nebula.2.1.0'), false)
})

test('compares release tags against the current version', () => {
  assert.equal(compareReleaseVersion('v3.30.0-nebula.2', '3.30.0-nebula.1'), 1)
  assert.equal(compareReleaseVersion('v3.30.0-nebula.1', '3.30.0-nebula.1'), 0)
  assert.equal(compareReleaseVersion('v3.30.0-nebula.1', '3.30.0-nebula.2'), -1)
  assert.equal(compareReleaseVersion('v3.30.0-nebula.2.1.0', '3.30.0-nebula.2.0.9'), 1)
  assert.equal(compareReleaseVersion('v3.30.0-nebula.2.0.9', '3.30.0-nebula.2.1.0'), -1)
  assert.equal(compareReleaseVersion('latest', '3.30.0-nebula.1'), null)
})

test('detects newer stable base versions', () => {
  assert.equal(isNewerReleaseVersion('v3.31.0', '3.30.0-nebula.1'), true)
  assert.equal(isNewerReleaseVersion('v3.29.9', '3.30.0-nebula.1'), false)
})

test('ignores malformed release tags', () => {
  assert.equal(isNewerReleaseVersion('latest', '3.30.0-nebula.1'), false)
})

test('classifies release update states for the settings UI', () => {
  assert.deepEqual(getReleaseUpdateState('v3.30.0-nebula.2', '3.30.0-nebula.1'), {
    status: 'available',
    latestReleaseTag: 'v3.30.0-nebula.2',
    isUpdateAvailable: true,
  })

  assert.deepEqual(getReleaseUpdateState('v3.30.0-nebula.1', '3.30.0-nebula.1'), {
    status: 'current',
    latestReleaseTag: 'v3.30.0-nebula.1',
    isUpdateAvailable: false,
  })

  assert.deepEqual(getReleaseUpdateState('v3.30.0-nebula.1', '3.30.0-nebula.2'), {
    status: 'ahead',
    latestReleaseTag: 'v3.30.0-nebula.1',
    isUpdateAvailable: false,
  })
})

test('treats missing or malformed release tags as unknown update state', () => {
  assert.deepEqual(getReleaseUpdateState(null, '3.30.0-nebula.1'), {
    status: 'unknown',
    latestReleaseTag: null,
    isUpdateAvailable: false,
  })

  assert.deepEqual(getReleaseUpdateState('latest', '3.30.0-nebula.1'), {
    status: 'unknown',
    latestReleaseTag: 'latest',
    isUpdateAvailable: false,
  })
})

test('returns the latest release tag from GitHub', async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ tag_name: 'v3.30.0-nebula.2' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  assert.equal(await fetchLatestReleaseTag(fetcher), 'v3.30.0-nebula.2')
})

test('treats a repository without releases as unavailable', async () => {
  const fetcher = async () => new Response(null, { status: 404 })

  assert.equal(await fetchLatestReleaseTag(fetcher), null)
})
