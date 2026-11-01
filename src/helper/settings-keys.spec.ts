import assert from 'node:assert/strict'
import test from 'node:test'
import { DEPRECATED_SETTINGS_KEYS, isDeprecatedSettingsKey } from './settings-keys.ts'

test('ignores settings keys removed from NebulaDash and upstream', () => {
  assert.equal(isDeprecatedSettingsKey('config/icon-size'), true)
  assert.equal(isDeprecatedSettingsKey('config/icon-margin-right'), true)
  assert.equal(isDeprecatedSettingsKey('config/use-large-proxy-group-icon'), true)
  assert.equal(isDeprecatedSettingsKey('config/singbox-channel'), true)
  assert.equal(isDeprecatedSettingsKey('config/use-singbox'), true)
})

test('keeps current NebulaDash settings importable', () => {
  assert.equal(isDeprecatedSettingsKey('config/node-cluster-variants'), false)
  assert.equal(isDeprecatedSettingsKey('config/router-updater-endpoint'), false)
  assert.equal(isDeprecatedSettingsKey('config/router-updater-token'), false)
  assert.equal(isDeprecatedSettingsKey('config/import-settings-url'), false)
})

test('deprecation list has no duplicates', () => {
  assert.equal(DEPRECATED_SETTINGS_KEYS.size, 5)
})
