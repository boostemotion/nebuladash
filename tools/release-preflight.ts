import { readFileSync } from 'node:fs'
import { validateReleasePreflight } from '../src/helper/releasePreflight.ts'

type PackageJson = {
  name?: string
  version?: string
}

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageJson

const tagName = process.env.GITHUB_REF_NAME || process.env.RELEASE_TAG
const result = validateReleasePreflight({
  packageName: packageJson.name ?? '',
  version: packageJson.version ?? '',
  tagName,
})

if (result.errors.length) {
  console.error('Release preflight failed:')
  result.errors.forEach((error) => console.error(`- ${error}`))
  console.error(`Expected release tag: ${result.expectedTag}`)
  process.exit(1)
}

console.log(`Release preflight passed. Expected release tag: ${result.expectedTag}`)
