import type { Plan, TaskList } from '../types'

type Palette = { fill: number; dot: number; hi: number; pill: number; tick: number; text: number }

const PALETTES: Record<Plan['status'], Palette> = {
  active: { fill: 0x312b55, dot: 0x6a5fc4, hi: 0xb9afff, pill: 0x8b7cf6, tick: 0xd6d0ff, text: 0xffffff },
  done: { fill: 0x1d5338, dot: 0x3d9d68, hi: 0x8de8b3, pill: 0x34b36f, tick: 0xc8f5da, text: 0xffffff },
  failed: { fill: 0x552a2a, dot: 0xb85a5a, hi: 0xffa3a3, pill: 0xe05d5d, tick: 0xffd4d4, text: 0xffffff },
}
// What a running bar is drawn in: the default purple, or one built from a theme's accent.
let running: Palette = PALETTES.active

export type Theme = { accent: number; background: number; foreground: number }

/** The `accent` and `background` of an Omarchy colors.toml; undefined without an accent. */
export const parseTheme = (toml: string): Theme | undefined => {
  const color = (key: string) => {
    const hex = new RegExp(`^\\s*${key}\\s*=\\s*["']#([0-9a-fA-F]{6})["']`, 'm').exec(toml)?.[1]
    return hex === undefined ? undefined : parseInt(hex, 16)
  }
  const accent = color('accent')
  if (accent === undefined) return undefined
  return { accent, background: color('background') ?? 0x1b1b1b, foreground: color('foreground') ?? 0xe0e0e0 }
}

const luminance = (rgb: number): number =>
  (0.2126 * ((rgb >> 16) & 255) + 0.7152 * ((rgb >> 8) & 255) + 0.0722 * (rgb & 255)) / 255

/** Draws running bars from `theme`'s accent from now on, or the default purple without one. */
export const useTheme = (theme: Theme | undefined): void => {
  if (theme === undefined) {
    running = PALETTES.active
    TRACK = DEFAULT_TRACK.bg
    TRACK_TICK = DEFAULT_TRACK.tick
    TRACK_MAJOR = DEFAULT_TRACK.major
    return
  }
  const { accent, background, foreground } = theme
  TRACK = mix(background, foreground, 0.06)
  TRACK_TICK = mix(background, foreground, 0.2)
  TRACK_MAJOR = mix(background, foreground, 0.4)
  running = {
    pill: accent,
    fill: mix(background, accent, 0.28),
    dot: mix(background, accent, 0.62),
    hi: mix(accent, 0xffffff, 0.45),
    tick: mix(accent, 0xffffff, 0.75),
    // Dark text on a light accent (a yellow, a pastel), white on the rest.
    text: luminance(accent) > 0.62 ? background : 0xffffff,
  }
}

/** The running color as `#rrggbb`, for the row's status dot. */
export const runningHex = (): string => `#${running.pill.toString(16).padStart(6, '0')}`
// The empty track and its ticks: fixed greys, or a theme's background lifted toward its foreground.
const DEFAULT_TRACK = { bg: 0x2a2a30, tick: 0x4c4c56, major: 0x7a7a88 }
let TRACK = DEFAULT_TRACK.bg
let TRACK_TICK = DEFAULT_TRACK.tick
let TRACK_MAJOR = DEFAULT_TRACK.major
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

export const STYLES = ['flow', 'comet', 'pixel'] as const
export type BarStyle = (typeof STYLES)[number]
export const isStyle = (name: string): name is BarStyle => (STYLES as readonly string[]).includes(name)

const mix = (a: number, b: number, t: number): number => {
  const k = Math.max(0, Math.min(1, t))
  const ch = (shift: number) => {
    const x = (a >> shift) & 255
    const y = (b >> shift) & 255
    return Math.round(x + (y - x) * k) << shift
  }
  return ch(16) | ch(8) | ch(0)
}

type Cells = {
  words: Uint32Array
  put: (i: number, ch: number, fg: number, bg: number) => void
  width: number
  head: number
  colors: Palette
  label: string
  ticks: Map<number, boolean>
}

const setup = (plan: Plan, width: number, shown: number): Cells => {
  const words = new Uint32Array(width * 3)
  const put = (i: number, ch: number, fg: number, bg: number) => {
    if (i < 0 || i >= width) return
    words[i * 3] = ch
    words[i * 3 + 1] = fg
    words[i * 3 + 2] = bg
  }
  let label = narrow(pillText(plan))
  if (label.length + 2 > Math.floor(width * 0.6)) {
    const stage = plan.stages[plan.current]
    label = plan.status === 'done' ? '✓' : `${stage?.done ?? 0}/${stage?.total ?? 0}`
  }
  // Stage boundaries (major) and step boundaries (minor), as cell columns.
  const ticks = new Map<number, boolean>()
  const total = plan.stages.reduce((n, s) => n + s.total, 0)
  if (total > 0) {
    let at = 0
    plan.stages.forEach((stage, index) => {
      if (width / total >= 4) {
        for (let step = 1; step < stage.total; step++) {
          ticks.set(Math.round(((at + step) / total) * width), false)
        }
      }
      at += stage.total
      if (index < plan.stages.length - 1) ticks.set(Math.round((at / total) * width), true)
    })
  }
  const head = Math.max(0, Math.min(1, shown)) * width

  return { words, put, width, head, colors: plan.status === 'active' ? running : PALETTES[plan.status], label, ticks }
}

/** Paints one fill cell at column `x`; `start` is where the pill begins. */
type Fill = (x: number, start: number) => void

/**
 * The shared frame: a fill up to the stage pill riding the head, an
 * eighth-cell edge past it, and the track with its ticks beyond.
 */
const headed = (c: Cells, fill: Fill, pill = c.colors.pill, pillText = c.colors.text, track = TRACK) => {
  const { put, width, head, label, ticks } = c
  const pillWidth = Math.min(width, label.length + 2)
  const end = Math.min(width, Math.max(pillWidth, Math.floor(head)))
  const start = end - pillWidth
  const edge = Math.round((head - Math.floor(head)) * 8)
  for (let x = 0; x < width; x++) {
    if (x >= start && x < end) {
      const ch = label.codePointAt(x - start - 1)
      put(x, x === start || ch === undefined ? 0x20 : ch, pillText, pill)
    } else if (x < start) {
      fill(x, start)
    } else if (x === end && edge > 0 && head > end) {
      put(x, EIGHTHS[Math.min(7, edge)]!, pill, track)
    } else {
      const major = ticks.get(x)
      if (major === undefined) put(x, 0x20, track, track)
      else put(x, major ? 0x2502 : 0x2575, major ? TRACK_MAJOR : TRACK_TICK, track)
    }
  }
  return { start, end }
}

/** The original: a dithered, twinkling fill with a light passing through it. */
const pixel = (plan: Plan, c: Cells, frame: number) => {
  const { put, colors, ticks } = c
  const twinkle = frame >> 2
  headed(c, (x, start) => {
    const major = ticks.get(x)
    if (major !== undefined) {
      put(x, major ? 0x2502 : 0x254e, major ? colors.tick : colors.dot, colors.fill)
      return
    }
    const wave = ((frame * 0.7) % (start + 16)) - 8
    const density = 0.25 + 0.55 * (x / Math.max(1, start))
    const lit = plan.status === 'active' && Math.abs(x - wave) < 2.5
    const ch = noise(x, twinkle) < density ? DITHER[Math.floor(noise(x + 7, twinkle) * DITHER.length)]! : 0x20
    put(x, ch, lit ? colors.hi : colors.dot, colors.fill)
  })
}

/** A finished bar in one solid color, the pill at its end. */
const solid = (c: Cells) => headed(c, x => c.put(x, 0x20, c.colors.pill, c.colors.pill))

/** Braille particles streaming toward the head, thickening as they go. */
const flow = (plan: Plan, c: Cells, frame: number) => {
  if (plan.status === 'done') return void solid(c)
  const { put, colors } = c
  const shift = Math.floor(frame * (plan.status === 'active' ? 0.8 : 0.15))
  // Braille dot bits by [column][row] of the 2x4 cell.
  const BITS = [
    [0x01, 0x02, 0x04, 0x40],
    [0x08, 0x10, 0x20, 0x80],
  ]
  headed(c, (x, start) => {
    const near = x / Math.max(1, start)
    const density = 0.12 + 0.5 * near * near
    let bits = 0
    for (let dx = 0; dx < 2; dx++) {
      for (let dy = 0; dy < 4; dy++) {
        if (noise(2 * x + dx - shift, dy * 977) < density) bits |= BITS[dx]![dy]!
      }
    }
    put(x, 0x2800 + bits, mix(colors.dot, colors.hi, near), colors.fill)
  })
}

// Glyphs every monospace font carries: no ✦ or ⋆, which many lack.
const SPARKS = [0x2a, 0x2b, 0xb7, 0x2022, 0x2219]

/** A comet: the pill its head, a trail of sparks shed behind it, stars ahead. */
const comet = (plan: Plan, c: Cells, frame: number) => {
  if (plan.status === 'done') return void solid(c)
  const { put, width, colors } = c
  const moving = plan.status === 'active'
  const { end } = headed(c, (x, start) => {
    const back = start - x
    const glow = Math.max(0, 1 - back / Math.max(8, start * 0.6))
    const bg = mix(colors.fill, mix(colors.fill, colors.pill, 0.55), glow * glow)
    // Each spark drifts back from the head and fades, then is shed again.
    const drift = moving ? Math.floor(frame * 0.5) : 0
    const r = noise(x + drift, 41)
    if (r < 0.18 + 0.5 * glow) {
      const ch = SPARKS[Math.floor(noise(x + drift, 7) * SPARKS.length)]!
      put(x, ch, mix(colors.dot, 0xffffff, glow * 0.8), bg)
    } else {
      put(x, 0x20, colors.dot, bg)
    }
  })
  const twinkle = frame >> 3
  for (let x = end + 1; x < width; x++) {
    if (c.ticks.has(x)) continue
    const r = noise(x, twinkle * 13)
    if (r < 0.07) put(x, r < 0.02 ? 0x2b : 0xb7, r < 0.02 ? mix(TRACK_MAJOR, running.hi, 0.5) : TRACK_TICK, TRACK)
  }
}

const DRAW: Record<BarStyle, (plan: Plan, c: Cells, frame: number) => void> = {
  pixel,
  flow,
  comet,
}

/** One row of Raster cells for `plan` at `shown` (0..1) in the given style. */
export const barCells = (
  plan: Plan,
  width: number,
  shown: number,
  frame: number,
  style: BarStyle = 'flow',
): Uint32Array => {
  const c = setup(plan, width, shown)
  DRAW[style](plan, c, frame)
  return c.words
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
