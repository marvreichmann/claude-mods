import type { Plan, TaskList } from '../types'

type Palette = { fill: number; dot: number; hi: number; pill: number; tick: number }

const PALETTES: Record<Plan['status'], Palette> = {
  active: { fill: 0x312b55, dot: 0x6a5fc4, hi: 0xb9afff, pill: 0x8b7cf6, tick: 0xd6d0ff },
  done: { fill: 0x1d5338, dot: 0x3d9d68, hi: 0x8de8b3, pill: 0x34b36f, tick: 0xc8f5da },
  failed: { fill: 0x552a2a, dot: 0xb85a5a, hi: 0xffa3a3, pill: 0xe05d5d, tick: 0xffd4d4 },
}
const TRACK = 0x2a2a30
const TRACK_TICK = 0x4c4c56
const TRACK_MAJOR = 0x7a7a88
const PILL_TEXT = 0xffffff
// U+258F..U+2589: a left-anchored block one eighth to seven eighths wide.
const EIGHTHS = [0, 0x258f, 0x258e, 0x258d, 0x258c, 0x258b, 0x258a, 0x2589]
const DITHER = [0x2598, 0x259d, 0x2596, 0x2597, 0x259a, 0x259e, 0x2580, 0x2584, 0xb7]

export const progressOf = (plan: Plan): number => {
  if (plan.status === 'done') return 1
  const total = plan.stages.reduce((n, s) => n + s.total, 0)
  const done = plan.stages.reduce((n, s) => n + Math.min(s.done, s.total), 0)
  return total === 0 ? 0 : done / total
}

export const totals = (plan: Plan) => ({
  done: plan.stages.reduce((n, s) => n + Math.min(s.done, s.total), 0),
  total: plan.stages.reduce((n, s) => n + s.total, 0),
})

export const pillText = (plan: Plan): string => {
  if (plan.status === 'done') {
    const { total } = totals(plan)
    return `✓ Done ${total}/${total}`
  }
  const stage = plan.stages[plan.current]
  if (stage === undefined) return '…'
  return `${plan.status === 'failed' ? '✗ ' : ''}${stage.name} ${Math.min(stage.done, stage.total)}/${stage.total}`
}

/** A task list as a one-stage plan: its finished items over all of them. */
export const listPlan = (key: string, list: TaskList): Plan => {
  const total = list.items.length
  const done = list.items.filter(t => t.status === 'completed').length
  const working = list.items.find(t => t.status === 'in_progress')
  const title =
    key === 'main' && working !== undefined ? working.activeForm || working.subject : list.title

  return {
    id: `tasks:${key}`,
    title,
    stages: [{ name: 'Tasks', total, done }],
    current: 0,
    status: total > 0 && done === total ? 'done' : 'active',
  }
}

/** Raster cells take width-1 BMP characters alone: anything else becomes `?`. */
export const narrow = (text: string): string =>
  Array.from(text, c => {
    const code = c.codePointAt(0)!
    return code < 0x20 || code > 0x2fff ? '?' : c
  }).join('')

const noise =(a: number, b: number): number => {
  let x = (Math.imul(a, 374761393) + Math.imul(b, 668265263)) | 0
  x = Math.imul(x ^ (x >>> 13), 1274126177)

  return ((x ^ (x >>> 16)) >>> 0) / 4294967296
}

/**
 * One row of Raster cells: a dithered fill up to `shown` (0..1), the stage
 * pill riding its head with a sub-cell edge, and stage and step ticks.
 */
export const barCells = (plan: Plan, width: number, shown: number, frame: number): Uint32Array => {
  const words = new Uint32Array(width * 3)
  const put = (i: number, ch: number, fg: number, bg: number) => {
    words[i * 3] = ch
    words[i * 3 + 1] = fg
    words[i * 3 + 2] = bg
  }
  const colors = PALETTES[plan.status]

  let label = narrow(pillText(plan))
  if (label.length + 2 > Math.floor(width * 0.6)) {
    const stage = plan.stages[plan.current]
    label = plan.status === 'done' ? '✓' : `${stage?.done ?? 0}/${stage?.total ?? 0}`
  }
  const pillWidth = Math.min(width, label.length + 2)
  const head = Math.max(0, Math.min(1, shown)) * width
  const end = Math.min(width, Math.max(pillWidth, Math.floor(head)))
  const start = end - pillWidth
  const edge = Math.round((head - Math.floor(head)) * 8)

  // Stage boundaries (major) and step boundaries (minor), as cell columns.
  const ticks = new Map<number, boolean>()
  const total = plan.stages.reduce((n, s) => n + s.total, 0)
  if (total > 0) {
    let at = 0
    plan.stages.forEach((stage, index) => {
      const cellsPerStep = width / total
      if (cellsPerStep >= 4) {
        for (let step = 1; step < stage.total; step++) {
          ticks.set(Math.round(((at + step) / total) * width), false)
        }
      }
      at += stage.total
      if (index < plan.stages.length - 1) ticks.set(Math.round((at / total) * width), true)
    })
  }

  const twinkle = frame >> 2
  const wave = start > 0 ? ((frame * 0.7) % (start + 16)) - 8 : -99
  for (let x = 0; x < width; x++) {
    if (x >= start && x < end) {
      const ch = label.codePointAt(x - start - 1)
      put(x, x === start || ch === undefined ? 0x20 : ch, PILL_TEXT, colors.pill)
      continue
    }
    const major = ticks.get(x)
    if (x < start) {
      if (major !== undefined) {
        put(x, major ? 0x2502 : 0x254e, major ? colors.tick : colors.dot, colors.fill)
        continue
      }
      const density = 0.25 + 0.55 * (x / Math.max(1, start))
      const r = noise(x, twinkle)
      const lit = plan.status === 'active' && Math.abs(x - wave) < 2.5
      const ch = r < density ? DITHER[Math.floor(noise(x + 7, twinkle) * DITHER.length)]! : 0x20
      put(x, ch, lit ? colors.hi : colors.dot, colors.fill)
      continue
    }
    if (x === end && edge > 0 && head > end) {
      put(x, EIGHTHS[Math.min(7, edge)]!, colors.pill, TRACK)
      continue
    }
    if (major !== undefined) {
      put(x, major ? 0x2502 : 0x2575, major ? TRACK_MAJOR : TRACK_TICK, TRACK)
      continue
    }
    put(x, 0x20, TRACK, TRACK)
  }

  return words
}

const B64 = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/'

/** Standard padded base64 of the words' little-endian bytes, as RasterProps takes. */
export const encode = (words: Uint32Array): string => {
  const bytes = new Uint8Array(words.buffer, words.byteOffset, words.byteLength)
  let out = ''
  for (let i = 0; i < bytes.length; i += 3) {
    const a = bytes[i]!
    const b = bytes[i + 1]
    const c = bytes[i + 2]
    const n = (a << 16) | ((b ?? 0) << 8) | (c ?? 0)
    out += B64[(n >> 18) & 63]! + B64[(n >> 12) & 63]!
    out += b === undefined ? '=' : B64[(n >> 6) & 63]!
    out += c === undefined ? '=' : B64[n & 63]!
  }
  return out
}
