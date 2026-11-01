import { readFileSync } from 'node:fs'
import { validateReleasePreflight } from '../src/helper/release-preflight.ts'

type PackageJson = {
  name?: string
  version?: string
}

const packageJson = JSON.parse(
  readFileSync(new URL('../package.json', import.meta.url), 'utf8'),
) as PackageJson

// auto-release 工作流里 GITHUB_REF_NAME 是 main，必须优先用显式传入的 RELEASE_TAG。
const tagName = process.env.RELEASE_TAG || process.env.GITHUB_REF_NAME
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
