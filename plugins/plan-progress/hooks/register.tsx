import { atom, read, update } from 'claude-code'
import type { EngineInterface, Register } from 'claude-code'

import type { Plan, Stage, TaskItem, TaskList, ThemeColors } from '../types'
import { barCells, encode, isStyle, listPlan, parseTheme, progressOf, runningHex, STYLES, totals, useTheme } from './bar'
import type { BarStyle } from './bar'

const plans = atom({ plugin: 'plan-progress', key: 'plans' } as const, {})
const lists = atom({ plugin: 'plan-progress', key: 'lists' } as const, {})
const muted = atom({ plugin: 'plan-progress', key: 'muted' } as const, false)
const style = atom({ plugin: 'plan-progress', key: 'style' } as const, 'flow')
const theme = atom({ plugin: 'plan-progress', key: 'theme' } as const, null)

const TOOL = 'mcp__plan-progress__progress'
const HIDE_DONE_MS = 30_000
// 30 frames a second, the band's redraw ceiling; animations count in 50ms ticks.
const FRAME_MS = 33
const THEME_POLL_MS = 3000

type ProgressInput = {
  plan: string
  title?: string
  stages?: { name: string; steps: number }[]
  stage?: string
  step?: number
  advance?: boolean
  status?: 'active' | 'done' | 'failed' | 'remove'
}

type Mounted = { requestId: string; width: number; plan: Plan; style: BarStyle }

// What each bar shows now, eased toward its plan's progress by the frame timer.
const shown = new Map<string, number>()
const velocity = new Map<string, number>()
const mounted = new Map<string, Mounted>()
let frame = 0
// The style preview running now, and which style `/progress try` showed last.
let preview: { cancel: () => void } | undefined
let tried = -1
let player: string[] | null | undefined

async function play($: EngineInterface, name: 'tick' | 'done') {
  if (await read($, muted)) return
  if (player === undefined) {
    player = null
    for (const argv of [['pw-play'], ['paplay'], ['afplay'], ['aplay', '-q']]) {
      const found = await $.process.run(['which', argv[0]!]).catch(() => undefined)
      if (found?.exitCode === 0) {
        player = argv
        break
      }
    }
  }
  const asset = `sounds/${name}.wav`
  const playing = player
    ? $.process.run([...player, `${$.plugin.root}/${asset}`])
    : $.audio.play({ asset })
  void playing.catch(() => undefined)
}

async function remove($: EngineInterface, id: string) {
  if (id.startsWith('tasks:')) {
    const key = id.slice('tasks:'.length)
    await update($, lists, all => {
      const { [key]: _, ...rest } = all
      return rest
    })
  } else {
    await update($, plans, all => {
      const { [id]: _, ...rest } = all
      return rest
    })
  }
  shown.delete(id)
}

// Sounds on a stage step or a finish; a finished bar leaves after a while.
async function changed($: EngineInterface, before: Plan | undefined, after: Plan | undefined) {
  // Style previews stay quiet: six bars ticking at once would only be noise.
  if (after === undefined || after.style !== undefined) return
  if (after.status === 'done' && before?.status !== 'done') {
    void play($, 'done')
    $.clock.after(HIDE_DONE_MS, () => {
      void (async () => {
        const now = after.id.startsWith('tasks:')
          ? (await read($, lists))[after.id.slice('tasks:'.length)]
          : (await read($, plans))[after.id]
        const plan = now && ('items' in now ? listPlan(after.id.slice(6), now) : now)
        if (plan?.status === 'done') await remove($, after.id)
      })()
    })
    return
  }
  const steppedStage = after.current > (before?.current ?? 0)
  const steppedTask = after.stages.length === 1 && totals(after).done > (before ? totals(before).done : 0)
  if (steppedStage || steppedTask) void play($, 'tick')
}

async function setList(
  $: EngineInterface,
  agentId: string | undefined,
  change: (items: TaskItem[]) => TaskItem[],
) {
  const key = agentId ?? 'main'
  const all = await read($, lists)
  const existing = all[key]
  let title = existing?.title ?? 'Tasks'
  if (existing === undefined && agentId !== undefined) {
    const agents = await $.agent.list().catch(() => [])
    title = agents.find(a => a.id === agentId)?.description || `Agent ${agentId.slice(0, 6)}`
  }
  const before = existing && listPlan(key, existing)
  const next = await update($, lists, current => {
    const items = change(current[key]?.items ?? [])
    if (items.length === 0) {
      const { [key]: _, ...rest } = current
      return rest
    }
    const list: TaskList = { title, items }
    return { ...current, [key]: list }
  })
  const after = next[key] && listPlan(key, next[key])
  await changed($, before, after)
}


async function applyProgress($: EngineInterface, input: ProgressInput): Promise<string> {
  const id = `plan:${input.plan}`
  if (input.status === 'remove') {
    await remove($, id)
    return `Removed the bar for ${input.plan}.`
  }
  const before = (await read($, plans))[id]
  if (before === undefined && (input.stages === undefined || input.stages.length === 0)) {
    return `No plan "${input.plan}" yet: call again with its stages first.`
  }
  const all = await update($, plans, current => {
    let plan: Plan = current[id] ?? { id, title: input.plan, stages: [], current: 0, status: 'active' }
    if (input.stages !== undefined && input.stages.length > 0) {
      const stages: Stage[] = input.stages.map(s => ({ name: s.name, total: Math.max(1, s.steps), done: 0 }))
      plan = { ...plan, stages, current: 0, status: 'active' }
    }
    if (input.title !== undefined) plan = { ...plan, title: input.title }
    const stages = plan.stages.map(s => ({ ...s }))
    let at = plan.current
    if (input.stage !== undefined) {
      const found = stages.findIndex(s => s.name.toLowerCase() === input.stage!.toLowerCase())
      if (found >= 0) {
        at = found
        stages.forEach((s, i) => {
          if (i < found) s.done = s.total
          if (i > found) s.done = 0
        })
      }
    }
    const stage = stages[at]
    if (stage !== undefined) {
      if (input.step !== undefined) stage.done = Math.min(stage.total, Math.max(0, input.step))
      if (input.advance) stage.done = Math.min(stage.total, stage.done + 1)
      while (stages[at] !== undefined && stages[at]!.done >= stages[at]!.total && at < stages.length - 1) at += 1
    }
    const finished = stages.every(s => s.done >= s.total)
    const status: Plan['status'] = input.status === 'done' || input.status === 'failed' ? input.status : finished ? 'done' : 'active'
    if (status === 'done') stages.forEach(s => (s.done = s.total))
    return { ...current, [id]: { ...plan, stages, current: at, status } }
  })
  const after = all[id]!
  await changed($, before, after)
  const { done, total } = totals(after)
  const stage = after.stages[after.current]
  return after.status === 'active'
    ? `${after.title}: ${done}/${total} steps, now in ${stage?.name} (${stage?.done}/${stage?.total}).`
    : `${after.title}: ${after.status}.`
}

async function startPreview($: EngineInterface, index: number, current: string) {
  const name = STYLES[index]!
  await applyProgress($, {
    plan: `style-${name}`,
    title: `${index + 1}/${STYLES.length} ${name}${name === current ? ' (current)' : ''}`,
    stages: [{ name: 'Build', steps: 2 }, { name: 'Test', steps: 3 }, { name: 'Deploy', steps: 2 }],
  })
  await update($, plans, all => {
    const plan = all[`plan:style-${name}`]
    return plan ? { ...all, [plan.id]: { ...plan, style: name } } : all
  })
}

async function tryStyle($: EngineInterface, index: number, current: string) {
  preview?.cancel()
  for (const name of STYLES) await remove($, `plan:style-${name}`)
  tried = index
  await startPreview($, index, current)
  const name = STYLES[index]!
  let held = 0
  // Fill, hold on Done, start over: until another style is tried or the preview stops.
  preview = $.clock.every(700, () => {
    void (async () => {
      const plan = (await read($, plans))[`plan:style-${name}`]
      if (plan === undefined) return preview?.cancel()
      if (plan.status !== 'done') return void (await applyProgress($, { plan: `style-${name}`, advance: true }))
      held += 1
      if (held < 4) return
      held = 0
      await remove($, `plan:style-${name}`)
      await startPreview($, index, current)
    })().catch(() => undefined)
  })
}

/** Reads the Omarchy theme in use; its accent colors running bars, null keeps the default. */
async function readTheme($: EngineInterface) {
  const home = await $.env.get('HOME')
  const state = (await $.env.get('XDG_STATE_HOME')) || (home && `${home}/.local/state`)
  const toml = state ? await $.fs.read(`${state}/omarchy/current/theme/colors.toml`).catch(() => undefined) : undefined
  const found: ThemeColors | null = (toml !== undefined && parseTheme(toml)) || null
  const now = await read($, theme)
  if (now?.accent !== found?.accent || now?.background !== found?.background) await update($, theme, () => found)
}

export const register: Register = on => {
  on('session.start', async ($, e, next) => {
    await $.tool.register({
      name: 'progress',
      description: [
        'Show the user a live progress bar above their prompt for a multi-stage plan of work.',
        'Call it once with `plan` and `stages` (each a name and its number of steps) when starting the plan,',
        'then with `advance: true` each time a step finishes (it moves on to the next stage by itself),',
        'or `stage`/`step` to jump, and `status: "done"` or `"failed"` at the end. Several plans may run side by side.',
        'Plain todo lists already get a bar on their own: use this for staged work such as build → test → deploy.',
      ].join(' '),
      inputSchema: {
        type: 'object',
        properties: {
          plan: { type: 'string', description: 'A short id for the plan, reused across calls' },
          title: { type: 'string', description: 'What the bar is labelled; defaults to the id' },
          stages: {
            type: 'array',
            description: 'Defines (or redefines) the stages, in order',
            items: {
              type: 'object',
              properties: { name: { type: 'string' }, steps: { type: 'integer', minimum: 1 } },
              required: ['name', 'steps'],
            },
          },
          stage: { type: 'string', description: 'Make this stage current; earlier stages count as finished' },
          step: { type: 'integer', minimum: 0, description: 'Steps finished in the current stage' },
          advance: { type: 'boolean', description: 'One more step of the current stage finished' },
          status: { type: 'string', enum: ['active', 'done', 'failed', 'remove'] },
        },
        required: ['plan'],
      },
    })
    await $.command.register({
      name: 'progress',
      description: 'Progress bars: /progress demo | styles | try [name|stop] | style <name> | clear | mute | unmute',
    })
    const stored = await $.store.get('muted')
    if (stored === true) await update($, muted, () => true)
    const saved = await $.store.get('style')
    if (typeof saved === 'string' && isStyle(saved)) await update($, style, () => saved)

    // Follow the theme: read it now, and again every few seconds for a switch.
    await readTheme($)
    $.clock.every(THEME_POLL_MS, () => void readTheme($).catch(() => undefined))

    $.clock.every(FRAME_MS, () => {
      frame += FRAME_MS / 50
      for (const [id, bar] of mounted) {
        const target = progressOf(bar.plan)
        const from = shown.get(id) ?? 0
        let to: number
        if (bar.style === 'pixel') {
          to = Math.abs(target - from) < 0.002 ? target : from + (target - from) * 0.123
        } else {
          // A near-critically damped spring: about 0.27s to settle, no visible bounce.
          const v = (velocity.get(id) ?? 0) * 0.35 + (target - from) * 0.2
          const settled = Math.abs(target - from) < 0.002 && Math.abs(v) < 0.001
          to = settled ? target : Math.min(1, Math.max(0, from + v))
          velocity.set(id, settled ? 0 : v)
        }
        shown.set(id, to)
        if (to === from && bar.plan.status !== 'active') continue
        const cells = encode(barCells(bar.plan, bar.width, to, frame, bar.style))
        void $.ui.blit({ requestId: bar.requestId, key: `bar:${id}`, columns: bar.width, rows: 1, cells })
          .catch(() => undefined)
      }
    })

    return next(e)
  })

  on('tool.call', { tool: 'TodoWrite' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      await setList($, e.agentId, () =>
        e.todos.map((todo, i) => ({
          id: String(i),
          subject: todo.content,
          activeForm: todo.activeForm,
          status: todo.status,
        })),
      )
    }
    return ran
  })

  on('tool.call', { tool: 'TaskCreate' }, async ($, e, next) => {
    const ran = await next(e)
    const id = (ran.result as { task?: { id?: string } } | undefined)?.task?.id
    if (ran.deny === undefined && !ran.isError && id !== undefined) {
      await setList($, e.agentId, items => [
        ...items,
        { id, subject: e.subject, activeForm: e.activeForm, status: 'pending' },
      ])
    }
    return ran
  })

  on('tool.call', { tool: 'TaskUpdate' }, async ($, e, next) => {
    const ran = await next(e)
    if (ran.deny === undefined && !ran.isError) {
      const status = e.status === 'deleted' ? undefined : e.status
      await setList($, e.agentId, items =>
        e.status === 'deleted'
          ? items.filter(t => t.id !== e.taskId)
          : items.map(t =>
              t.id !== e.taskId
                ? t
                : {
                    ...t,
                    subject: e.subject ?? t.subject,
                    activeForm: e.activeForm ?? t.activeForm,
                    status: status ?? t.status,
                  },
            ),
      )
    }
    return ran
  })

  on('tool.call', { tool: TOOL }, async ($, e) => ({
    result: await applyProgress($, e as unknown as ProgressInput),
  }))

  on('command.run', { command: 'progress' }, async ($, e) => {
    const arg = e.args.trim()
    if (arg === 'mute' || arg === 'unmute') {
      await update($, muted, () => arg === 'mute')
      await $.store.set('muted', arg === 'mute')
      return { text: `Progress sounds ${arg === 'mute' ? 'off' : 'on'}.` }
    }
    if (arg === 'clear') {
      await update($, plans, () => ({}))
      await update($, lists, () => ({}))
      shown.clear()
      return { text: 'Progress bars cleared.' }
    }
    if (arg === 'demo') {
      const demo: [string, string, [string, number][]][] = [
        ['demo-tasks', 'Start at zero, tick marks', [['Tasks', 5]]],
        ['demo-release', 'Release pipeline', [['Build', 3], ['Test', 4], ['Deploy', 2]]],
      ]
      for (const [plan, title, stages] of demo) {
        await remove($, `plan:${plan}`)
        await applyProgress($, { plan, title, stages: stages.map(([name, steps]) => ({ name, steps })) })
      }
      let tick = 0
      const timer = $.clock.every(900, () => {
        tick += 1
        const plan = tick % 3 === 0 ? 'demo-tasks' : 'demo-release'
        void applyProgress($, { plan, advance: true }).catch(() => undefined)
        if (tick >= 14) timer.cancel()
      })
      return { text: 'Running two demo plans.' }
    }
    if (arg === 'try' || arg.startsWith('try ')) {
      const want = arg.slice('try'.length).trim()
      const current = await read($, style)
      if (want === 'stop') {
        preview?.cancel()
        preview = undefined
        for (const name of STYLES) await remove($, `plan:style-${name}`)
        return { text: 'Style preview stopped.' }
      }
      if (want !== '' && !isStyle(want)) return { text: `Styles: ${STYLES.join(', ')}` }
      const index = want === '' ? (tried + 1) % STYLES.length : STYLES.indexOf(want as BarStyle)
      await tryStyle($, index, current)
      const following = STYLES[(index + 1) % STYLES.length]
      return {
        text: `Showing ${STYLES[index]} (${index + 1}/${STYLES.length}). /progress try for ${following}, /progress style ${STYLES[index]} to keep it, /progress try stop to end.`,
      }
    }
    if (arg === 'styles') {
      preview?.cancel()
      const current = await read($, style)
      for (const name of STYLES) await remove($, `plan:style-${name}`)
      // One style at a time: run it from empty to Done, hold, then the next.
      let index = 0
      let held = 0
      await startPreview($, index, current)
      const timer = $.clock.every(700, () => {
        void (async () => {
          const name = STYLES[index]!
          const plan = (await read($, plans))[`plan:style-${name}`]
          if (plan !== undefined && plan.status !== 'done') {
            await applyProgress($, { plan: `style-${name}`, advance: true })
            return
          }
          held += 1
          if (held < 3) return
          held = 0
          await remove($, `plan:style-${name}`)
          index += 1
          if (index >= STYLES.length) {
            timer.cancel()
            return
          }
          await startPreview($, index, current)
        })().catch(() => undefined)
      })
      preview = timer
      return { text: `Previewing ${STYLES.length} styles one after the other. Pick one with /progress style <name>.` }
    }
    if (arg.startsWith('style')) {
      const name = arg.slice('style'.length).trim()
      if (!isStyle(name)) return { text: `Styles: ${STYLES.join(', ')}` }
      await update($, style, () => name)
      await $.store.set('style', name)
      return { text: `Progress bars now use the ${name} style.` }
    }
    return { text: 'Usage: /progress demo | styles | try [name|stop] | style <name> | clear | mute | unmute' }
  })

  on('ui.render', { component: 'AbovePrompt' }, async ($, e, next) => {
    const views: Plan[] = [
      ...Object.entries(await read($, lists)).map(([key, list]) => listPlan(key, list)),
      ...Object.values(await read($, plans)),
    ]
    mounted.clear()
    // Raster cells are the terminal's alone; other surfaces keep their own band.
    if (e.surface !== 'terminal' || e.props.hasSurvey || views.length === 0) return next(e)

    const { Box, Text, Button, Raster } = $.ui.resolve(e)
    const setting = await read($, style)
    useTheme((await read($, theme)) ?? undefined)
    const styleOf = (plan: Plan): BarStyle =>
      plan.style !== undefined && isStyle(plan.style) ? plan.style : isStyle(setting) ? setting : 'flow'
    const inner = Math.max(20, e.props.bodyColumns - 4)
    const titleWidth = Math.max(10, Math.min(32, Math.floor(inner * 0.26)))
    const width = Math.max(8, inner - titleWidth - 10)
    const rows = views.slice(-Math.max(1, e.props.maxRows - 2))

    return (
      <Box flexDirection="column" borderStyle="round" borderColor="gray" paddingX={1}>
        {rows.map(plan => {
          if (!shown.has(plan.id)) shown.set(plan.id, 0)
          mounted.set(plan.id, { requestId: e.requestId, width, plan, style: styleOf(plan) })
          const color = plan.status === 'done' ? '#34b36f' : plan.status === 'failed' ? '#e05d5d' : runningHex()
          return (
            <Box key={`row:${plan.id}`} flexDirection="row" gap={1}>
              <Text color={color}>{plan.status === 'done' ? '✓' : plan.status === 'failed' ? '✗' : '●'}</Text>
              <Box width={titleWidth}>
                <Text wrap="truncate-end">{plan.title}</Text>
              </Box>
              <Raster
                key={`bar:${plan.id}`}
                columns={width}
                rows={1}
                cells={encode(barCells(plan, width, shown.get(plan.id) ?? 0, frame, styleOf(plan)))}
              />
              <Box width={4} justifyContent="flex-end">
                <Text dimColor>{`${Math.round(progressOf(plan) * 100)}%`}</Text>
              </Box>
              <Button key={`x:${plan.id}`} label="×" plain dimColor onPress={() => void remove($, plan.id)} />
            </Box>
          )
        })}
      </Box>
    )
  })
}
