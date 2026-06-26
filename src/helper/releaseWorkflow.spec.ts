import assert from 'node:assert/strict'
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import test from 'node:test'

const releaseWorkflow = () =>
  readFileSync(join(process.cwd(), '.github/workflows/release.yml'), 'utf8')

test('release workflow packages the router updater archive', () => {
  const workflow = releaseWorkflow()

  assert.match(workflow, /router-updater\.zip/)
  assert.match(workflow, /zip -qr "router-updater\.zip" router-updater/)
})

test('release workflow uploads the router updater archive', () => {
  const workflow = releaseWorkflow()

  assert.match(workflow, /files:\s+\|\s+dist\*\.zip\s+router-updater\.zip/s)
})
