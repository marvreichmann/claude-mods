// Renders media/src/<name>/demo.html into media/<name>.mp4 and .gif.
//
//   node media/src/render.mjs clickable-links
//   node media/src/render.mjs plan-progress
//
// Needs Node 22+ (global fetch and WebSocket), Chromium or Chrome, and ffmpeg.
// A scene sets `window.DURATION` (seconds), resolves `window.ready` once laid
// out, and draws any moment with `window.seek(seconds)`. Headless Chromium
// draws each frame that way, so the clip is the same on every run.
import { spawn, execFileSync } from 'node:child_process'
import { mkdtempSync, writeFileSync } from 'node:fs'
import { tmpdir } from 'node:os'
import { dirname, join } from 'node:path'
import { fileURLToPath, pathToFileURL } from 'node:url'

const HERE = dirname(fileURLToPath(import.meta.url))
const MEDIA = join(HERE, '..')
const NAME = process.argv[2]
if (!NAME) throw new Error('usage: node media/src/render.mjs <scene name>')
const FPS = 30
const WIDTH = 1280
const HEIGHT = 720
const PORT = 9333
const BROWSER = process.env.CHROME ?? 'chromium'

const work = mkdtempSync(join(tmpdir(), `${NAME}-demo-`))
const chrome = spawn(BROWSER, [
  '--headless=new', '--disable-extensions', `--remote-debugging-port=${PORT}`, `--user-data-dir=${join(work, 'profile')}`,
  `--window-size=${WIDTH},${HEIGHT}`, '--hide-scrollbars', '--force-color-profile=srgb', 'about:blank',
], { stdio: 'ignore' })

const sleep = ms => new Promise(resolve => setTimeout(resolve, ms))

const pageSocket = async () => {
  for (let tries = 0; tries < 50; tries++) {
    try {
      const pages = await (await fetch(`http://127.0.0.1:${PORT}/json/list`)).json()
      const page = pages.find(one => one.type === 'page')
      if (page) return page.webSocketDebuggerUrl
    } catch {
      // not listening yet
    }
    await sleep(100)
  }
  throw new Error(`${BROWSER} did not open a debugging port`)
}

const socket = new WebSocket(await pageSocket())
await new Promise(resolve => socket.addEventListener('open', resolve, { once: true }))

let nextId = 0
const waiting = new Map()
socket.addEventListener('message', ({ data }) => {
  const message = JSON.parse(data)
  const handlers = waiting.get(message.id)
  if (!handlers) return
  waiting.delete(message.id)
  if (message.error) handlers.reject(new Error(message.error.message))
  else handlers.resolve(message.result)
})
const send = (method, params = {}) =>
  new Promise((resolve, reject) => {
    const id = ++nextId
    waiting.set(id, { resolve, reject })
    socket.send(JSON.stringify({ id, method, params }))
  })
const evaluate = expression => send('Runtime.evaluate', { expression, awaitPromise: true })

try {
  await send('Emulation.setDeviceMetricsOverride', { width: WIDTH, height: HEIGHT, deviceScaleFactor: 1, mobile: false })
  await send('Page.navigate', { url: pathToFileURL(join(HERE, NAME, 'demo.html')).href })
  await sleep(500)
  await evaluate('window.ready')

  const { result } = await evaluate('window.DURATION')
  const frames = Math.round(result.value * FPS)
  for (let frame = 0; frame < frames; frame++) {
    await evaluate(`seek(${frame / FPS})`)
    const { data } = await send('Page.captureScreenshot', { format: 'png' })
    writeFileSync(join(work, `frame-${String(frame).padStart(4, '0')}.png`), Buffer.from(data, 'base64'))
  }
} finally {
  socket.close()
  chrome.kill()
}

const frames = join(work, 'frame-%04d.png')
const ffmpeg = args => execFileSync('ffmpeg', ['-y', '-loglevel', 'error', ...args], { stdio: 'inherit' })
ffmpeg(['-framerate', `${FPS}`, '-i', frames, '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-crf', '20',
  '-movflags', '+faststart', join(MEDIA, `${NAME}.mp4`)])
ffmpeg(['-framerate', `${FPS}`, '-i', frames, '-vf',
  'fps=20,scale=800:-1:flags=lanczos,split[a][b];[a]palettegen=max_colors=128[p];[b][p]paletteuse=dither=sierra2_4a',
  join(MEDIA, `${NAME}.gif`)])

console.log(`frames in ${work}`)
