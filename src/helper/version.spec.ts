import assert from 'node:assert/strict'
import test from 'node:test'
import {
  compareReleaseVersion,
  fetchLatestReleaseTag,
  getLatestReleaseApiUrl,
  getReleaseUpdateState,
  isNewerReleaseVersion,
  NEBULADASH_REPOSITORY,
} from './version.ts'

test('uses the NebulaDash repository for release checks', () => {
  assert.equal(NEBULADASH_REPOSITORY, 'boostemotion/nebuladash')
  assert.equal(
    getLatestReleaseApiUrl(),
    'https://api.github.com/repos/boostemotion/nebuladash/releases/latest',
  )
})

test('detects newer NebulaDash prereleases', () => {
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.2', '2.8.0-nebula.1'), true)
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.1', '2.8.0-nebula.1'), false)
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.0', '2.8.0-nebula.1'), false)
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.4.2.0', '2.8.0-nebula.4.1.9'), true)
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.4.2.0', '2.8.0-nebula.4.2.0'), false)
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.4.1.9', '2.8.0-nebula.4.2.0'), false)
})

test('compares release tags against the current version', () => {
  assert.equal(compareReleaseVersion('v2.8.0-nebula.3', '2.8.0-nebula.2'), 1)
  assert.equal(compareReleaseVersion('v2.8.0-nebula.2', '2.8.0-nebula.2'), 0)
  assert.equal(compareReleaseVersion('v2.8.0-nebula.1', '2.8.0-nebula.2'), -1)
  assert.equal(compareReleaseVersion('v2.8.0-nebula.4.2.0', '2.8.0-nebula.4.1.9'), 1)
  assert.equal(compareReleaseVersion('v2.8.0-nebula.4.2.0', '2.8.0-nebula.4.2.0'), 0)
  assert.equal(compareReleaseVersion('v2.8.0-nebula.4.1.9', '2.8.0-nebula.4.2.0'), -1)
  assert.equal(compareReleaseVersion('latest', '2.8.0-nebula.2'), null)
})

test('detects newer stable base versions', () => {
  assert.equal(isNewerReleaseVersion('v2.8.1', '2.8.0-nebula.1'), true)
  assert.equal(isNewerReleaseVersion('v2.7.9', '2.8.0-nebula.1'), false)
})

test('ignores malformed release tags', () => {
  assert.equal(isNewerReleaseVersion('latest', '2.8.0-nebula.1'), false)
})

test('classifies release update states for the settings UI', () => {
  assert.deepEqual(getReleaseUpdateState('v2.8.0-nebula.4.2.0', '2.8.0-nebula.4.1.9'), {
    status: 'available',
    latestReleaseTag: 'v2.8.0-nebula.4.2.0',
    isUpdateAvailable: true,
  })

  assert.deepEqual(getReleaseUpdateState('v2.8.0-nebula.4.2.0', '2.8.0-nebula.4.2.0'), {
    status: 'current',
    latestReleaseTag: 'v2.8.0-nebula.4.2.0',
    isUpdateAvailable: false,
  })

  assert.deepEqual(getReleaseUpdateState('v2.8.0-nebula.4.1.9', '2.8.0-nebula.4.2.0'), {
    status: 'ahead',
    latestReleaseTag: 'v2.8.0-nebula.4.1.9',
    isUpdateAvailable: false,
  })
})

test('treats missing or malformed release tags as unknown update state', () => {
  assert.deepEqual(getReleaseUpdateState(null, '2.8.0-nebula.4.2.0'), {
    status: 'unknown',
    latestReleaseTag: null,
    isUpdateAvailable: false,
  })

  assert.deepEqual(getReleaseUpdateState('latest', '2.8.0-nebula.4.2.0'), {
    status: 'unknown',
    latestReleaseTag: 'latest',
    isUpdateAvailable: false,
  })
})

test('returns the latest release tag from GitHub', async () => {
  const fetcher = async () =>
    new Response(JSON.stringify({ tag_name: 'v2.8.0-nebula.2' }), {
      status: 200,
      headers: { 'content-type': 'application/json' },
    })

  assert.equal(await fetchLatestReleaseTag(fetcher), 'v2.8.0-nebula.2')
})

test('treats a repository without releases as unavailable', async () => {
  const fetcher = async () => new Response(null, { status: 404 })

  assert.equal(await fetchLatestReleaseTag(fetcher), null)
})
