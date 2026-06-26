import assert from 'node:assert/strict'
import test from 'node:test'
import {
  NEBULADASH_RELEASE_DOWNLOAD_URL,
  canUpgradeNebulaDashFromConfig,
  getExternalUiDownloadUrl,
} from './uiUpdateSource.ts'

test('allows NebulaDash release download URLs', () => {
  assert.equal(
    canUpgradeNebulaDashFromConfig({
      'external-ui-download-url': NEBULADASH_RELEASE_DOWNLOAD_URL,
    }),
    true,
  )
})

test('rejects official Zashboard release download URLs', () => {
  assert.equal(
    canUpgradeNebulaDashFromConfig({
      'external-ui-download-url':
        'https://github.com/Zephyruso/zashboard/releases/latest/download/dist.zip',
    }),
    false,
  )
})

test('rejects missing external UI download URLs', () => {
  assert.equal(canUpgradeNebulaDashFromConfig({}), false)
  assert.equal(canUpgradeNebulaDashFromConfig(undefined), false)
})

test('normalizes case and surrounding whitespace', () => {
  assert.equal(
    canUpgradeNebulaDashFromConfig({
      'external-ui-download-url':
        '  HTTPS://GITHUB.COM/BOOSTEMOTION/NEBULADASH/RELEASES/LATEST/DOWNLOAD/DIST.ZIP  ',
    }),
    true,
  )
})

test('extracts the configured external UI download URL', () => {
  assert.equal(
    getExternalUiDownloadUrl({
      'external-ui-download-url': NEBULADASH_RELEASE_DOWNLOAD_URL,
    }),
    NEBULADASH_RELEASE_DOWNLOAD_URL,
  )
  assert.equal(getExternalUiDownloadUrl({}), '')
})
