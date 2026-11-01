/*
 * 递增 NebulaDash 版本号（只动 patch 段）。
 *
 *   3.30.0-nebula.2  ->  3.30.0-nebula.3
 *   3.30.0-nebula.4.2.0 -> 3.30.0-nebula.4.2.1
 *
 * 用法：
 *   node tools/bump-version.mjs           # 写入 package.json
 *   node tools/bump-version.mjs --dry-run # 只打印新版本
 *   node tools/bump-version.mjs --sync-docs
 */
import { readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const dryRun = process.argv.includes('--dry-run')
const syncDocs = process.argv.includes('--sync-docs')

const pattern = /^(\d+\.\d+\.\d+)-nebula\.(\d+(?:\.\d+)*)$/

const bumpVersion = (version) => {
  const match = pattern.exec(version)

  if (!match) {
    throw new Error(`Unexpected NebulaDash version: ${version}`)
  }

  const [, base, nebula] = match
  const segments = nebula.split('.').map(Number)
  segments[segments.length - 1] += 1

  return `${base}-nebula.${segments.join('.')}`
}

const packagePath = join(ROOT, 'package.json')
const packageJson = JSON.parse(readFileSync(packagePath, 'utf8'))
const previousVersion = packageJson.version
const nextVersion = bumpVersion(previousVersion)

if (dryRun) {
  console.log(nextVersion)
  process.exit(0)
}

packageJson.version = nextVersion
writeFileSync(packagePath, `${JSON.stringify(packageJson, null, 2)}\n`)

if (syncDocs) {
  for (const file of ['README.md', 'README-改动说明.md']) {
    const path = join(ROOT, file)
    const content = readFileSync(path, 'utf8')
    const updated = content.replaceAll(`\`${previousVersion}\``, `\`${nextVersion}\``)

    if (updated !== content) writeFileSync(path, updated)
  }
}

console.log(nextVersion)
