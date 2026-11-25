/**
 * 把 public/app-icon.svg 轉成 PWA / APK 需要的 PNG。
 * 不依賴外部套件：畫出與 SVG 相同的圓角筆記本圖示。
 */
import { deflateSync } from 'node:zlib'
import { mkdirSync, writeFileSync } from 'node:fs'
import { dirname, join } from 'node:path'
import { fileURLToPath } from 'node:url'

const root = join(dirname(fileURLToPath(import.meta.url)), '..')
const outDir = join(root, 'public')

function crc32(buf) {
  let crc = 0xffffffff
  for (let i = 0; i < buf.length; i++) {
    crc ^= buf[i]
    for (let j = 0; j < 8; j++) {
      crc = (crc >>> 1) ^ (crc & 1 ? 0xedb88320 : 0)
    }
  }
  return (crc ^ 0xffffffff) >>> 0
}

function chunk(type, data) {
  const typeBuf = Buffer.from(type)
  const len = Buffer.alloc(4)
  len.writeUInt32BE(data.length)
  const crcBuf = Buffer.alloc(4)
  crcBuf.writeUInt32BE(crc32(Buffer.concat([typeBuf, data])))
  return Buffer.concat([len, typeBuf, data, crcBuf])
}

function roundRect(px, size, x, y, w, h, r, color, set) {
  const s = size / 512
  const x0 = x * s
  const y0 = y * s
  const x1 = (x + w) * s
  const y1 = (y + h) * s
  const rad = r * s
  const cx = px % size
  const cy = (px / size) | 0
  if (cx < x0 || cx >= x1 || cy < y0 || cy >= y1) return
  const lx = cx - x0
  const ly = cy - y0
  const rx = x1 - 1 - cx
  const ry = y1 - 1 - cy
  if (lx < rad && ly < rad && (lx - rad) ** 2 + (ly - rad) ** 2 > rad ** 2) return
  if (rx < rad && ly < rad && (rx - rad) ** 2 + (ly - rad) ** 2 > rad ** 2) return
  if (lx < rad && ry < rad && (lx - rad) ** 2 + (ry - rad) ** 2 > rad ** 2) return
  if (rx < rad && ry < rad && (rx - rad) ** 2 + (ry - rad) ** 2 > rad ** 2) return
  set(px, color)
}

function circle(px, size, x, y, r, color, set) {
  const s = size / 512
  const cx = px % size
  const cy = (px / size) | 0
  const dx = cx - x * s
  const dy = cy - y * s
  if (dx * dx + dy * dy <= (r * s) ** 2) set(px, color)
}

function writePng(size, file) {
  const rgb = Buffer.alloc(size * size * 3)
  const set = (i, [r, g, b]) => {
    const o = i * 3
    rgb[o] = r
    rgb[o + 1] = g
    rgb[o + 2] = b
  }
  const green = [15, 107, 76]
  const white = [255, 255, 255]
  const mint = [217, 239, 228]
  const mute = [154, 172, 162]
  const accent = [61, 186, 139]
  for (let i = 0; i < size * size; i++) set(i, green)
  roundRect(0, size, 0, 0, 512, 512, 96, green, () => {})
  for (let i = 0; i < size * size; i++) {
    roundRect(i, size, 118, 96, 276, 320, 28, white, set)
  }
  for (let i = 0; i < size * size; i++) {
    roundRect(i, size, 118, 96, 36, 320, 10, mint, set)
  }
  for (let i = 0; i < size * size; i++) {
    roundRect(i, size, 186, 156, 168, 22, 11, green, set)
    roundRect(i, size, 186, 204, 168, 16, 8, mute, set)
    roundRect(i, size, 186, 240, 132, 16, 8, mute, set)
    roundRect(i, size, 186, 276, 150, 16, 8, mute, set)
  }
  for (let i = 0; i < size * size; i++) circle(i, size, 348, 348, 28, accent, set)

  const raw = Buffer.alloc((size * 3 + 1) * size)
  for (let y = 0; y < size; y++) {
    raw[y * (size * 3 + 1)] = 0
    rgb.copy(raw, y * (size * 3 + 1) + 1, y * size * 3, (y + 1) * size * 3)
  }
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8
  ihdr[9] = 2
  const png = Buffer.concat([
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
    chunk('IHDR', ihdr),
    chunk('IDAT', deflateSync(raw, { level: 9 })),
    chunk('IEND', Buffer.alloc(0)),
  ])
  writeFileSync(file, png)
}

mkdirSync(outDir, { recursive: true })
writePng(192, join(outDir, 'icon-192.png'))
writePng(512, join(outDir, 'icon-512.png'))
writePng(180, join(outDir, 'apple-touch-icon.png'))
console.log('已產生 icon-192.png / icon-512.png / apple-touch-icon.png')
