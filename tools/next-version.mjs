/*
 * 计算下一个 NebulaDash 版本号。只打印，不写文件。
 *
 *   node tools/next-version.mjs                 # 基于 package.json
 *   node tools/next-version.mjs v3.30.0-nebula.4 # 基于上一个 tag
 *   node tools/next-version.mjs "" --dry-tag     # 只返回不带 v 的版本
 *
 * 规则：递增最后一段数字
 *   v3.30.0-nebula.4      -> 3.30.0-nebula.5
 *   v3.30.0-nebula.4.2.0  -> 3.30.0-nebula.4.2.1
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'

const ROOT = join(import.meta.dirname, '..')
const pattern = /^v?(\d+\.\d+\.\d+)-nebula\.(\d+(?:\.\d+)*)$/

const bump = (version) => {
  const match = pattern.exec(version)

  if (!match) {
    throw new Error(`Unexpected NebulaDash version: ${version}`)
  }

  const [, base, nebula] = match
  const segments = nebula.split('.').map(Number)
  segments[segments.length - 1] += 1

  return `${base}-nebula.${segments.join('.')}`
}

const args = process.argv.slice(2).filter((arg) => !arg.startsWith('--'))
const source = args[0]?.trim() || JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8')).version

console.log(bump(source))
