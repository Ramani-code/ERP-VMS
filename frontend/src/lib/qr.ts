/**
 * Minimal, dependency-free QR code encoder (byte mode, error-correction level M, versions 1–10).
 * Enough for pass numbers and short verification links, and it works fully offline.
 * Output is a square boolean matrix: true = dark module.
 */

export type QrMatrix = boolean[][]

// Index = QR version (1..10)
const TOTAL_CODEWORDS = [0, 26, 44, 70, 100, 134, 172, 196, 242, 292, 346]
const DATA_CODEWORDS_M = [0, 16, 28, 44, 64, 86, 108, 124, 154, 182, 216]
const ECC_CODEWORDS_PER_BLOCK_M = [0, 10, 16, 26, 18, 24, 16, 18, 22, 22, 26]
const ECC_BLOCKS_M = [0, 1, 1, 1, 2, 2, 4, 4, 4, 5, 5]
const REMAINDER_BITS = [0, 0, 7, 7, 7, 7, 7, 0, 0, 0, 0]
const ALIGNMENT_POSITIONS: number[][] = [
  [], [], [6, 18], [6, 22], [6, 26], [6, 30], [6, 34], [6, 22, 38], [6, 24, 42], [6, 26, 46], [6, 28, 50]
]
const MAX_VERSION = 10

// ---------- Reed–Solomon over GF(256), polynomial 0x11D ----------

const GF_EXP: number[] = new Array(512).fill(0)
const GF_LOG: number[] = new Array(256).fill(0)
{
  let x = 1
  for (let i = 0; i < 255; i++) {
    GF_EXP[i] = x
    GF_LOG[x] = i
    x <<= 1
    if (x & 0x100) x ^= 0x11d
  }
  for (let i = 255; i < 512; i++) GF_EXP[i] = GF_EXP[i - 255]
}

function gfMul(a: number, b: number): number {
  if (a === 0 || b === 0) return 0
  return GF_EXP[GF_LOG[a] + GF_LOG[b]]
}

function rsGenerator(degree: number): number[] {
  let poly = [1]
  for (let i = 0; i < degree; i++) {
    const next = new Array<number>(poly.length + 1).fill(0)
    for (let j = 0; j < poly.length; j++) {
      next[j] ^= poly[j]
      next[j + 1] ^= gfMul(poly[j], GF_EXP[i])
    }
    poly = next
  }
  return poly
}

function rsRemainder(data: number[], degree: number): number[] {
  const gen = rsGenerator(degree)
  const rem = new Array<number>(degree).fill(0)
  for (const byte of data) {
    const factor = byte ^ rem[0]
    rem.shift()
    rem.push(0)
    for (let i = 0; i < degree; i++) rem[i] ^= gfMul(gen[i + 1], factor)
  }
  return rem
}

// ---------- encoding ----------

function toCodewords(text: string, version: number): number[] {
  const bytes = new TextEncoder().encode(text)
  const countBits = version <= 9 ? 8 : 16
  const capacityBits = DATA_CODEWORDS_M[version] * 8
  const bits: number[] = []
  const push = (value: number, count: number) => {
    for (let i = count - 1; i >= 0; i--) bits.push((value >>> i) & 1)
  }
  push(0b0100, 4) // byte mode
  push(bytes.length, countBits)
  for (const b of bytes) push(b, 8)
  push(0, Math.min(4, capacityBits - bits.length)) // terminator
  push(0, (8 - (bits.length % 8)) % 8) // align to byte
  for (let pad = 0xec; bits.length < capacityBits; pad = pad === 0xec ? 0x11 : 0xec) push(pad, 8)

  const data: number[] = []
  for (let i = 0; i < bits.length; i += 8) {
    let v = 0
    for (let j = 0; j < 8; j++) v = (v << 1) | bits[i + j]
    data.push(v)
  }
  return data
}

function interleave(data: number[], version: number): number[] {
  const numBlocks = ECC_BLOCKS_M[version]
  const eccLen = ECC_CODEWORDS_PER_BLOCK_M[version]
  const raw = TOTAL_CODEWORDS[version]
  const shortLen = Math.floor(raw / numBlocks)
  const numShort = numBlocks - (raw % numBlocks)

  const dataBlocks: number[][] = []
  const eccBlocks: number[][] = []
  let k = 0
  for (let i = 0; i < numBlocks; i++) {
    const len = shortLen - eccLen + (i < numShort ? 0 : 1)
    const block = data.slice(k, k + len)
    k += len
    dataBlocks.push(block)
    eccBlocks.push(rsRemainder(block, eccLen))
  }

  const out: number[] = []
  const maxLen = Math.max(...dataBlocks.map((b) => b.length))
  for (let i = 0; i < maxLen; i++) {
    for (const block of dataBlocks) if (i < block.length) out.push(block[i])
  }
  for (let i = 0; i < eccLen; i++) {
    for (const block of eccBlocks) out.push(block[i])
  }
  return out
}

// ---------- matrix construction ----------

const MASKS: Array<(x: number, y: number) => boolean> = [
  (x, y) => (x + y) % 2 === 0,
  (_x, y) => y % 2 === 0,
  (x) => x % 3 === 0,
  (x, y) => (x + y) % 3 === 0,
  (x, y) => (Math.floor(y / 2) + Math.floor(x / 3)) % 2 === 0,
  (x, y) => ((x * y) % 2) + ((x * y) % 3) === 0,
  (x, y) => (((x * y) % 2) + ((x * y) % 3)) % 2 === 0,
  (x, y) => (((x + y) % 2) + ((x * y) % 3)) % 2 === 0
]

interface Grid {
  size: number
  dark: boolean[][]
  reserved: boolean[][]
}

function newGrid(size: number): Grid {
  return {
    size,
    dark: Array.from({ length: size }, () => new Array<boolean>(size).fill(false)),
    reserved: Array.from({ length: size }, () => new Array<boolean>(size).fill(false))
  }
}

/** Sets a function module. Coordinates are (x = column, y = row). */
function setFn(g: Grid, x: number, y: number, isDark: boolean) {
  g.dark[y][x] = isDark
  g.reserved[y][x] = true
}

function drawFinder(g: Grid, cx: number, cy: number) {
  for (let dy = -4; dy <= 4; dy++) {
    for (let dx = -4; dx <= 4; dx++) {
      const x = cx + dx
      const y = cy + dy
      if (x < 0 || y < 0 || x >= g.size || y >= g.size) continue
      const dist = Math.max(Math.abs(dx), Math.abs(dy))
      setFn(g, x, y, dist !== 2 && dist !== 4)
    }
  }
}

function drawAlignment(g: Grid, cx: number, cy: number) {
  for (let dy = -2; dy <= 2; dy++) {
    for (let dx = -2; dx <= 2; dx++) {
      setFn(g, cx + dx, cy + dy, Math.max(Math.abs(dx), Math.abs(dy)) !== 1)
    }
  }
}

function drawFormatBits(g: Grid, mask: number) {
  // ECC level M is encoded as 00
  const data = mask
  let rem = data
  for (let i = 0; i < 10; i++) rem = (rem << 1) ^ ((rem >>> 9) * 0x537)
  const bits = ((data << 10) | rem) ^ 0x5412
  const bit = (i: number) => ((bits >>> i) & 1) === 1
  const size = g.size

  for (let i = 0; i <= 5; i++) setFn(g, 8, i, bit(i))
  setFn(g, 8, 7, bit(6))
  setFn(g, 8, 8, bit(7))
  setFn(g, 7, 8, bit(8))
  for (let i = 9; i < 15; i++) setFn(g, 14 - i, 8, bit(i))

  for (let i = 0; i < 8; i++) setFn(g, size - 1 - i, 8, bit(i))
  for (let i = 8; i < 15; i++) setFn(g, 8, size - 15 + i, bit(i))
  setFn(g, 8, size - 8, true) // always-dark module
}

function drawVersionBits(g: Grid, version: number) {
  let rem = version
  for (let i = 0; i < 12; i++) rem = (rem << 1) ^ ((rem >>> 11) * 0x1f25)
  const bits = (version << 12) | rem
  for (let i = 0; i < 18; i++) {
    const bit = ((bits >>> i) & 1) === 1
    const a = g.size - 11 + (i % 3)
    const b = Math.floor(i / 3)
    setFn(g, a, b, bit)
    setFn(g, b, a, bit)
  }
}

function buildFunctionPatterns(version: number): Grid {
  const size = version * 4 + 17
  const g = newGrid(size)

  // timing first: the finder patterns below overwrite the timing modules where they overlap
  for (let i = 0; i < size; i++) {
    setFn(g, 6, i, i % 2 === 0)
    setFn(g, i, 6, i % 2 === 0)
  }

  drawFinder(g, 3, 3)
  drawFinder(g, size - 4, 3)
  drawFinder(g, 3, size - 4)

  const pos = ALIGNMENT_POSITIONS[version]
  const last = pos.length - 1
  for (let i = 0; i < pos.length; i++) {
    for (let j = 0; j < pos.length; j++) {
      if ((i === 0 && j === 0) || (i === 0 && j === last) || (i === last && j === 0)) continue
      drawAlignment(g, pos[i], pos[j])
    }
  }

  // reserve format areas (real values are written after the mask is chosen)
  drawFormatBits(g, 0)
  if (version >= 7) drawVersionBits(g, version)
  return g
}

function placeData(g: Grid, bits: number[]) {
  const size = g.size
  let i = 0
  for (let right = size - 1; right >= 1; right -= 2) {
    if (right === 6) right = 5
    for (let vert = 0; vert < size; vert++) {
      for (let j = 0; j < 2; j++) {
        const x = right - j
        const upward = ((right + 1) & 2) === 0
        const y = upward ? size - 1 - vert : vert
        if (!g.reserved[y][x] && i < bits.length) {
          g.dark[y][x] = bits[i] === 1
          i++
        }
      }
    }
  }
}

function applyMask(g: Grid, mask: number): boolean[][] {
  const out = g.dark.map((row) => row.slice())
  const test = MASKS[mask]
  for (let y = 0; y < g.size; y++) {
    for (let x = 0; x < g.size; x++) {
      if (!g.reserved[y][x] && test(x, y)) out[y][x] = !out[y][x]
    }
  }
  return out
}

function penalty(m: boolean[][]): number {
  const n = m.length
  let score = 0

  // Rule 1: runs of 5+ same-colour modules in rows and columns
  for (let a = 0; a < n; a++) {
    for (const line of [m[a], m.map((row) => row[a])]) {
      let run = 1
      for (let i = 1; i < n; i++) {
        if (line[i] === line[i - 1]) {
          run++
        } else {
          if (run >= 5) score += run - 2
          run = 1
        }
      }
      if (run >= 5) score += run - 2
    }
  }

  // Rule 2: 2x2 blocks of one colour
  for (let y = 0; y < n - 1; y++) {
    for (let x = 0; x < n - 1; x++) {
      const c = m[y][x]
      if (c === m[y][x + 1] && c === m[y + 1][x] && c === m[y + 1][x + 1]) score += 3
    }
  }

  // Rule 3: finder-like patterns 1011101 with 4 light modules on one side
  const p1 = [true, false, true, true, true, false, true, false, false, false, false]
  const p2 = [false, false, false, false, true, false, true, true, true, false, true]
  const matchAt = (get: (i: number) => boolean, start: number, pat: boolean[]) =>
    pat.every((v, k) => get(start + k) === v)
  for (let a = 0; a < n; a++) {
    const row = (i: number) => m[a][i]
    const col = (i: number) => m[i][a]
    for (let s = 0; s + 11 <= n; s++) {
      if (matchAt(row, s, p1) || matchAt(row, s, p2)) score += 40
      if (matchAt(col, s, p1) || matchAt(col, s, p2)) score += 40
    }
  }

  // Rule 4: balance of dark and light modules
  let dark = 0
  for (const row of m) for (const c of row) if (c) dark++
  const percent = (dark * 100) / (n * n)
  score += Math.floor(Math.abs(percent - 50) / 5) * 10

  return score
}

function chooseVersion(text: string): number {
  const byteLength = new TextEncoder().encode(text).length
  for (let v = 1; v <= MAX_VERSION; v++) {
    const countBits = v <= 9 ? 8 : 16
    if (4 + countBits + byteLength * 8 <= DATA_CODEWORDS_M[v] * 8) return v
  }
  throw new Error('The pass text is too long for the QR code')
}

/** Encodes text into a QR code matrix (true = dark). */
export function encodeQr(text: string): QrMatrix {
  const version = chooseVersion(text)
  const codewords = interleave(toCodewords(text, version), version)

  const bits: number[] = []
  for (const cw of codewords) for (let i = 7; i >= 0; i--) bits.push((cw >>> i) & 1)
  for (let i = 0; i < REMAINDER_BITS[version]; i++) bits.push(0)

  const base = buildFunctionPatterns(version)
  placeData(base, bits)

  let best: boolean[][] | null = null
  let bestScore = Infinity
  let bestMask = 0
  for (let mask = 0; mask < 8; mask++) {
    const candidate = applyMask(base, mask)
    const trial: Grid = { size: base.size, dark: candidate, reserved: base.reserved }
    drawFormatBits(trial, mask)
    if (version >= 7) drawVersionBits(trial, version)
    const s = penalty(candidate)
    if (s < bestScore) {
      bestScore = s
      best = candidate
      bestMask = mask
    }
  }

  // write the chosen mask's format information into the final matrix
  const final: Grid = { size: base.size, dark: best as boolean[][], reserved: base.reserved }
  drawFormatBits(final, bestMask)
  if (version >= 7) drawVersionBits(final, version)
  return final.dark
}

/** Builds an SVG path (one square per dark module) with a quiet zone, ready to scale. */
export function qrToSvgPath(matrix: QrMatrix, quietZone = 4): { path: string; viewBox: number } {
  const parts: string[] = []
  matrix.forEach((row, y) => {
    row.forEach((on, x) => {
      if (on) parts.push(`M${x + quietZone} ${y + quietZone}h1v1h-1z`)
    })
  })
  return { path: parts.join(''), viewBox: matrix.length + quietZone * 2 }
}
