import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const readLocalFile = (relativePath: string) =>
  readFileSync(join(process.cwd(), relativePath), 'utf8')

test('settings page exposes a dedicated latest-version check action', () => {
  const settingsView = readLocalFile('src/components/settings/ZashboardSettings.vue')

  assert.match(settingsView, /\$t\('checkUIUpdate'\)/)
  assert.match(settingsView, /handlerClickCheckUIUpdate/)
})

test('settings page auto-checks NebulaDash releases and shows update indicators', () => {
  const settingsView = readLocalFile('src/components/settings/ZashboardSettings.vue')

  assert.match(settingsView, /onMounted\(\(\) => \{\s+void checkUIUpdate\(/s)
  assert.match(settingsView, /v-if="isUIUpdateAvailable"/)
})

test('translations include NebulaDash release status labels', () => {
  const zh = readLocalFile('src/i18n/zh.ts')

  assert.match(zh, /checkUIUpdate:/)
  assert.match(zh, /uiUpdateStatus:/)
  assert.match(zh, /uiUpdateAvailable:/)
})
