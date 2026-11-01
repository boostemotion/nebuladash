/*
 * 极简 ZIP 打包（deflate），用于在没有 zip 命令的机器上产出 dist.zip。
 * 仅供本地打包 / 路由器实测使用；CI 仍使用系统 zip。
 *
 *   node test/zip-dist.mjs <sourceDir> <outputZip>
 */
import { createWriteStream, readdirSync, readFileSync, statSync } from 'node:fs'
import { join, relative } from 'node:path'
import { deflateRawSync } from 'node:zlib'

const [, , sourceDir = 'dist', output = 'dist.zip'] = process.argv

const collect = (dir, files = []) => {
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry)

    if (statSync(full).isDirectory()) collect(full, files)
    else files.push(full)
  }

  return files
}

const crcTable = (() => {
  const table = new Int32Array(256)

  for (let i = 0; i < 256; i++) {
    let value = i

    for (let bit = 0; bit < 8; bit++) {
      value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1
    }

    table[i] = value
  }

  return table
})()

const crc32 = (buffer) => {
  let crc = -1

  for (const byte of buffer) {
    crc = (crc >>> 8) ^ crcTable[(crc ^ byte) & 0xff]
  }

  return (crc ^ -1) >>> 0
}

const files = collect(sourceDir)
const localParts = []
const centralParts = []
let offset = 0

for (const file of files) {
  const name = Buffer.from(relative(sourceDir, file).replaceAll('\\', '/'), 'utf8')
  const content = readFileSync(file)
  const compressed = deflateRawSync(content, { level: 9 })
  const checksum = crc32(content)

  const local = Buffer.alloc(30)
  local.writeUInt32LE(0x04034b50, 0)
  local.writeUInt16LE(20, 4)
  local.writeUInt16LE(0x0800, 6)
  local.writeUInt16LE(8, 8)
  local.writeUInt16LE(0, 10)
  local.writeUInt16LE(0, 12)
  local.writeUInt32LE(checksum, 14)
  local.writeUInt32LE(compressed.length, 18)
  local.writeUInt32LE(content.length, 22)
  local.writeUInt16LE(name.length, 26)
  local.writeUInt16LE(0, 28)

  localParts.push(local, name, compressed)

  const central = Buffer.alloc(46)
  central.writeUInt32LE(0x02014b50, 0)
  central.writeUInt16LE(20, 4)
  central.writeUInt16LE(20, 6)
  central.writeUInt16LE(0x0800, 8)
  central.writeUInt16LE(8, 10)
  central.writeUInt16LE(0, 12)
  central.writeUInt16LE(0, 14)
  central.writeUInt32LE(checksum, 16)
  central.writeUInt32LE(compressed.length, 20)
  central.writeUInt32LE(content.length, 24)
  central.writeUInt16LE(name.length, 28)
  central.writeUInt16LE(0, 30)
  central.writeUInt16LE(0, 32)
  central.writeUInt16LE(0, 34)
  central.writeUInt16LE(0, 36)
  central.writeUInt32LE(0, 38)
  central.writeUInt32LE(offset, 42)

  centralParts.push(central, name)
  offset += local.length + name.length + compressed.length
}

const centralSize = centralParts.reduce((total, part) => total + part.length, 0)
const end = Buffer.alloc(22)
end.writeUInt32LE(0x06054b50, 0)
end.writeUInt16LE(0, 4)
end.writeUInt16LE(0, 6)
end.writeUInt16LE(files.length, 8)
end.writeUInt16LE(files.length, 10)
end.writeUInt32LE(centralSize, 12)
end.writeUInt32LE(offset, 16)
end.writeUInt16LE(0, 20)

const output$ = createWriteStream(output)

for (const part of [...localParts, ...centralParts, end]) {
  output$.write(part)
}

output$.end(() => console.log(`Wrote ${output} (${files.length} files)`))
