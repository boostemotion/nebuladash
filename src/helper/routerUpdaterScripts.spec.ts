import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const ROOT = process.cwd()
const updaterFiles = [
  'router-updater/install.sh',
  'router-updater/updater.sh',
  'router-updater/nebuladash-updater.cgi',
  'router-updater/config.example',
]

test('router updater release scripts are stored with LF line endings', () => {
  for (const relativePath of updaterFiles) {
    const content = readFileSync(join(ROOT, relativePath), 'utf8')
    assert.equal(content.includes('\r'), false, `${relativePath} must not contain CRLF`)
  }
})

test('router updater installer normalizes installed scripts and config', () => {
  const installer = readFileSync(join(ROOT, 'router-updater/install.sh'), 'utf8')

  assert.match(installer, /strip_crlf_file\(\)/)
  assert.match(installer, /strip_crlf_file "\$RUNTIME_DIR\/updater\.sh"/)
  assert.match(installer, /strip_crlf_file "\$CGI_PATH"/)
  assert.match(installer, /strip_crlf_file "\$RUNTIME_DIR\/config"/)
})

test('router updater CGI accepts a query token fallback when headers are unavailable', () => {
  const cgi = readFileSync(join(ROOT, 'router-updater/nebuladash-updater.cgi'), 'utf8')

  assert.match(cgi, /QUERY_TOKEN=/)
  assert.match(cgi, /TOKEN="\$\{HTTP_X_NEBULADASH_TOKEN:-\$QUERY_TOKEN\}"/)
})
