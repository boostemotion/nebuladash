import assert from 'node:assert/strict'
import test from 'node:test'
import {
  fetchLatestReleaseTag,
  getLatestReleaseApiUrl,
  isNewerReleaseVersion,
  NEBULADASH_REPOSITORY,
} from './version.ts'

test('uses the NebulaDash repository for release checks', () => {
  assert.equal(NEBULADASH_REPOSITORY, 'boostemotion/NebulaDash')
  assert.equal(
    getLatestReleaseApiUrl(),
    'https://api.github.com/repos/boostemotion/NebulaDash/releases/latest',
  )
})

test('detects newer NebulaDash prereleases', () => {
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.2', '2.8.0-nebula.1'), true)
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.1', '2.8.0-nebula.1'), false)
  assert.equal(isNewerReleaseVersion('v2.8.0-nebula.0', '2.8.0-nebula.1'), false)
})

test('detects newer stable base versions', () => {
  assert.equal(isNewerReleaseVersion('v2.8.1', '2.8.0-nebula.1'), true)
  assert.equal(isNewerReleaseVersion('v2.7.9', '2.8.0-nebula.1'), false)
})

test('ignores malformed release tags', () => {
  assert.equal(isNewerReleaseVersion('latest', '2.8.0-nebula.1'), false)
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
