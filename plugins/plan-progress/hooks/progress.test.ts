import { expect, test } from 'claude-code/testing'

import { barCells, listPlan, pillText, progressOf } from './bar'
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
