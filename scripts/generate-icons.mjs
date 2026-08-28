/**
 * Renders the Nine AI mark to PNG at the sizes a PWA manifest needs.
 *
 * Deliberately dependency-free: `sharp` and friends pull native binaries that
 * break as often as they build, and this only ever draws four shapes. The
 * geometry mirrors src/components/wordmark.tsx so the icon and the in-app logo
 * cannot drift apart.
 */
import { deflateSync } from "node:zlib"
import { mkdirSync, writeFileSync } from "node:fs"
import path from "node:path"
import { fileURLToPath } from "node:url"

const OUT_DIR = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..", "public")

/** Edges are supersampled rather than analytically antialiased. */
const SAMPLES = 4

const VIOLET = [139, 92, 246]
const FUCHSIA = [217, 70, 239]
const WHITE = [255, 255, 255]

const clamp01 = (n) => (n < 0 ? 0 : n > 1 ? 1 : n)
const mix = (a, b, t) => a.map((channel, i) => Math.round(channel + (b[i] - channel) * t))

/** Signed distance helpers, all working in the 48x48 design space. */
function insideRoundedRect(x, y, size, radius) {
  const dx = Math.max(radius - x, x - (size - radius), 0)
  const dy = Math.max(radius - y, y - (size - radius), 0)
  return Math.hypot(dx, dy) <= radius
}

function insideDisc(x, y, cx, cy, r) {
  return Math.hypot(x - cx, y - cy) <= r
}

/**
 * The mark: nine dots on a 3x3 grid, sized so they read as a hub with eight
 * satellites. Nine for the name, converging for what a router does.
 *
 * An earlier version drew the digit 9. Hand-rasterised at 32px it read as a
 * lowercase q, and no amount of nudging the stem fixed it.
 */
const GRID = [14, 24, 34]

function dotRadius(col, row) {
  const isCentre = col === 1 && row === 1
  if (isCentre) return 5
  const isEdge = col === 1 || row === 1
  return isEdge ? 3.4 : 2.4
}

function insideNine(x, y) {
  for (let row = 0; row < 3; row += 1) {
    for (let col = 0; col < 3; col += 1) {
      if (insideDisc(x, y, GRID[col], GRID[row], dotRadius(col, row))) return true
    }
  }
  return false
}

function renderIcon(size, { padding = 0 } = {}) {
  const pixels = Buffer.alloc(size * size * 4)
  const inset = size * padding
  const drawable = size - inset * 2

  for (let py = 0; py < size; py += 1) {
    for (let px = 0; px < size; px += 1) {
      let coverage = 0
      let glyph = 0
      let gradientSum = 0

      for (let sy = 0; sy < SAMPLES; sy += 1) {
        for (let sx = 0; sx < SAMPLES; sx += 1) {
          const fx = px + (sx + 0.5) / SAMPLES
          const fy = py + (sy + 0.5) / SAMPLES

          // Map the device pixel into the 48-unit design space.
          const dx = ((fx - inset) / drawable) * 48
          const dy = ((fy - inset) / drawable) * 48
          if (dx < 0 || dy < 0 || dx > 48 || dy > 48) continue

          if (!insideRoundedRect(dx, dy, 48, 12)) continue

          coverage += 1
          gradientSum += clamp01((dx + dy) / 96)
          if (insideNine(dx, dy)) glyph += 1
        }
      }

      const total = SAMPLES * SAMPLES
      const alpha = coverage / total
      const offset = (py * size + px) * 4

      if (alpha === 0) continue

      const base = mix(VIOLET, FUCHSIA, gradientSum / coverage)
      const glyphRatio = glyph / coverage
      const colour = mix(base, WHITE, glyphRatio)

      pixels[offset] = colour[0]
      pixels[offset + 1] = colour[1]
      pixels[offset + 2] = colour[2]
      pixels[offset + 3] = Math.round(alpha * 255)
    }
  }

  return pixels
}

// --- minimal PNG encoder ---------------------------------------------------

const CRC_TABLE = (() => {
  const table = new Int32Array(256)
  for (let n = 0; n < 256; n += 1) {
    let c = n
    for (let k = 0; k < 8; k += 1) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1
    table[n] = c
  }
  return table
})()

function crc32(buffer) {
  let crc = -1
  for (const byte of buffer) crc = CRC_TABLE[(crc ^ byte) & 0xff] ^ (crc >>> 8)
  return (crc ^ -1) >>> 0
}

function chunk(type, data) {
  const length = Buffer.alloc(4)
  length.writeUInt32BE(data.length)
  const body = Buffer.concat([Buffer.from(type, "ascii"), data])
  const crc = Buffer.alloc(4)
  crc.writeUInt32BE(crc32(body))
  return Buffer.concat([length, body, crc])
}

function encodePng(pixels, size) {
  const ihdr = Buffer.alloc(13)
  ihdr.writeUInt32BE(size, 0)
  ihdr.writeUInt32BE(size, 4)
  ihdr[8] = 8 // bit depth
  ihdr[9] = 6 // RGBA
  ihdr[10] = 0
  ihdr[11] = 0
  ihdr[12] = 0

  // Each scanline is prefixed with its filter byte (0 = none).
  const raw = Buffer.alloc(size * (size * 4 + 1))
  for (let y = 0; y < size; y += 1) {
    const start = y * (size * 4 + 1)
    raw[start] = 0
    pixels.copy(raw, start + 1, y * size * 4, (y + 1) * size * 4)
  }

  return Buffer.concat([
    Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]),
    chunk("IHDR", ihdr),
    chunk("IDAT", deflateSync(raw, { level: 9 })),
    chunk("IEND", Buffer.alloc(0)),
  ])
}

const TARGETS = [
  { file: "icon-192.png", size: 192, options: {} },
  { file: "icon-512.png", size: 512, options: {} },
  // Maskable icons get cropped to a circle on some launchers, so the mark sits
  // inside the 80% safe zone.
  { file: "icon-maskable-512.png", size: 512, options: { padding: 0.1 } },
  { file: "apple-touch-icon.png", size: 180, options: {} },
]

mkdirSync(OUT_DIR, { recursive: true })

for (const { file, size, options } of TARGETS) {
  const png = encodePng(renderIcon(size, options), size)
  writeFileSync(path.join(OUT_DIR, file), png)
  console.log(`wrote ${file} (${size}x${size}, ${(png.length / 1024).toFixed(1)} KB)`)
}
