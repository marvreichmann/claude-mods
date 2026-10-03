import { expect, test } from 'claude-code/testing'

import { barCells, listPlan, parseTheme, pillText, progressOf, STYLES, useTheme } from './bar'
import type { Plan } from '../types'

const BAND = {
  component: 'AbovePrompt',
  props: {
    hasSurvey: false,
    isWorking: true,
    maxRows: 10,
    bodyColumns: 100,
    scroll: { offset: 0, bodyRows: 10 },
    view: {},
  },
} as const

const release: Plan = {
  id: 'plan:release',
  title: 'Release pipeline',
  stages: [
    { name: 'Build', total: 3, done: 3 },
    { name: 'Test', total: 4, done: 2 },
    { name: 'Deploy', total: 2, done: 0 },
  ],
  current: 1,
  status: 'active',
}

test('progress counts finished steps across stages', () => {
  expect(progressOf(release)).toBe(5 / 9)
  expect(pillText(release)).toBe('Test 2/4')
  expect(pillText({ ...release, status: 'done' })).toBe('✓ Done 9/9')
})

test('the pill rides the head of the fill', () => {
  const width = 60
  const words = barCells(release, width, progressOf(release), 0)
  const label = 'Test 2/4'
  const end = Math.floor((5 / 9) * width)
  const start = end - (label.length + 2)
  const text = Array.from({ length: label.length }, (_, i) => String.fromCodePoint(words[(start + 1 + i) * 3]!)).join('')
  expect(text).toBe(label)
  // Past the head, the empty track carries the Deploy stage boundary.
  const deployTick = Math.round((7 / 9) * width)
  expect(words[deployTick * 3]).toBe(0x2502)
})

test('every style draws only printable cells, at every state and frame', () => {
  for (const style of STYLES) {
    for (const status of ['active', 'done', 'failed'] as const) {
      for (const [shown, frame] of [[0, 0], [0.31, 17], [5 / 9, 400], [1, 9999]] as const) {
        const words = barCells({ ...release, status }, 48, shown, frame, style)
        for (let i = 0; i < 48; i++) {
          const code = words[i * 3]!
          expect(code >= 0x20 && code <= 0xffff && (code < 0x7f || code > 0x9f)).toBe(true)
          expect(words[i * 3 + 1]! <= 0x01ffffff && words[i * 3 + 2]! <= 0x01ffffff).toBe(true)
        }
      }
    }
  }
})

test('flow and comet finish as one solid color', () => {
  for (const style of ['flow', 'comet'] as const) {
    const words = barCells({ ...release, status: 'done' }, 48, 1, 123, style)
    const label = '✓ Done 9/9'
    const start = 48 - (label.length + 2)
    for (let x = 0; x < start; x++) {
      expect(words[x * 3]).toBe(0x20)
      expect(words[x * 3 + 2]).toBe(words[(start + 1) * 3 + 2])
    }
  }
})

test('a running bar takes the Omarchy accent; done stays green', () => {
  const theme = parseTheme('accent = "#e75a50"\nforeground = "#efebdc"\nbackground = "#1B1B1B"\n')
  expect(theme).toEqual({ accent: 0xe75a50, background: 0x1b1b1b })
  expect(parseTheme('foreground = "#ffffff"')).toBeUndefined()

  const pillBg = (plan: Plan) => {
    const words = barCells(plan, 60, progressOf(plan), 0)
    const end = plan.status === 'done' ? 60 : Math.floor(progressOf(plan) * 60)
    return words[(end - 2) * 3 + 2]
  }
  useTheme(theme)
  expect(pillBg(release)).toBe(0xe75a50)
  expect(pillBg({ ...release, status: 'done' })).toBe(0x34b36f)
  useTheme(undefined)
  expect(pillBg(release)).toBe(0x8b7cf6)
})

test('a todo list is a one-stage plan titled by what is in progress', () => {
  const plan = listPlan('main', {
    title: 'Tasks',
    items: [
      { id: '0', subject: 'Write', status: 'completed' },
      { id: '1', subject: 'Test', activeForm: 'Testing', status: 'in_progress' },
      { id: '2', subject: 'Ship', status: 'pending' },
    ],
  })
  expect(plan.title).toBe('Testing')
  expect(pillText(plan)).toBe('Tasks 1/3')
})

test('TodoWrite draws a bar above the prompt', async ($, on) => {
  on('tool.call', { tool: 'TodoWrite' }, () => ({ result: { oldTodos: [], newTodos: [] } }))
  // The engine's own band, drawn once the last bar is dismissed.
  on('ui.render', { component: 'AbovePrompt' }, ($, e) => $.ui.resolve(e).Text({}))
  await $.tool.call({
    tool: 'TodoWrite',
    todos: [
      { content: 'One', activeForm: 'Doing one', status: 'completed' },
      { content: 'Two', activeForm: 'Doing two', status: 'in_progress' },
      { content: 'Three', activeForm: 'Doing three', status: 'pending' },
    ],
  })
  const ui = await $.ui.mount({ plugin: 'plan-progress', surface: 'terminal', ...BAND })
  expect(await ui.find({ key: 'bar:tasks:main' })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /Doing two/ })).toBeDefined()
  expect(await ui.find({ type: 'Text', text: /33%/ })).toBeDefined()

  await ui.press({ key: 'x:tasks:main' })
  expect(await ui.find({ key: 'bar:tasks:main' })).toBeUndefined()
})
