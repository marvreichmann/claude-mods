import { describe, expect, test } from 'claude-code/testing'
import type { On } from 'claude-code'

import { findLinks, labelOf } from './links'

const drawnByEngine = (on: On) =>
  on('ui.render', ($, e) => {
    const { Text } = $.ui.resolve(e)
    return <Text>engine drew this</Text>
  })

describe('findLinks', () => {
  test('finds bare and markdown links, without trailing punctuation', () => {
    const text = 'See https://a.dev/x. And [docs](https://b.dev/y?q=1), or https://a.dev/x!'
    expect(findLinks(text)).toEqual(['https://a.dev/x', 'https://b.dev/y?q=1'])
  })

  test('finds nothing in plain text', () => {
    expect(findLinks('no links here, just ftp://x and mailto:a@b')).toEqual([])
  })

  test('drops matches that are not URLs', () => {
    expect(findLinks('broken: https://. and https://[')).toEqual([])
  })

  test('skips URLs in inline code and code fences', () => {
    const text = [
      'Real: https://a.dev/ but not `https://b.dev/`.',
      '```bash',
      'curl https://c.dev/',
      '```',
      '~~~',
      'https://d.dev/',
      '~~~',
      'After: https://e.dev/',
      '```',
      'https://f.dev/ in a fence never closed',
    ].join('\n')
    expect(findLinks(text)).toEqual(['https://a.dev/', 'https://e.dev/'])
  })
})

describe('labelOf', () => {
  test('names a link by host and path, cut short', () => {
    expect(labelOf('https://example.com/')).toBe('example.com')
    expect(labelOf('https://a.dev/x?q=1')).toBe('a.dev/x')
    expect(labelOf(`https://a.dev/${'p'.repeat(60)}`)).toHaveLength(40)
  })
})

describe('terminal', () => {
  test("a reply without links draws as the engine's own", async ($, on) => {
    drawnByEngine(on)
    const mounted = await $.ui.mount({
      plugin: 'clickable-links',
      surface: 'terminal',
      component: 'AssistantMessage',
      props: { text: 'Nothing to click.', isFirstOfReply: true },
    })
    expect(await mounted.find({ key: 'reply' })).toBeUndefined()
    expect(await mounted.find({ text: 'engine drew this' })).toBeDefined()
  })

  test('a reply with links lists them in a hoverable row', async $ => {
    const mounted = await $.ui.mount({
      plugin: 'clickable-links',
      surface: 'terminal',
      component: 'AssistantMessage',
      props: { text: 'See https://a.dev/x and [b](https://b.dev/).', isFirstOfReply: true },
    })
    expect(await mounted.find({ key: 'link-0' })).toBeDefined()
    expect(await mounted.find({ key: 'open-1' })).toBeDefined()
    expect(await mounted.find({ key: 'open-2' })).toBeUndefined()
  })

  test('pressing links opens them in the browser', async ($, on) => {
    const opened: string[] = []
    on('process.run', (_, e) => {
      opened.push(e.argv.join(' '))
      return {
        value: {
          exitCode: 0,
          stdout: '',
          stderr: '',
          isStdoutTruncated: false,
          isStderrTruncated: false,
        },
      }
    })
    const mounted = await $.ui.mount({
      plugin: 'clickable-links',
      surface: 'terminal',
      component: 'AssistantMessage',
      props: { text: 'Read [this](https://a.dev/) or https://b.dev/', isFirstOfReply: true },
    })
    await mounted.press({ key: 'reply', link: { href: 'https://a.dev/' } })
    await mounted.press({ key: 'open-1' })

    expect(opened).toEqual(['xdg-open https://a.dev/', 'xdg-open https://b.dev/'])
  })
})

test("other surfaces keep the engine's own reply, links and all", async ($, on) => {
  drawnByEngine(on)
  const mounted = await $.ui.mount({
    plugin: 'clickable-links',
    surface: 'desktop',
    component: 'AssistantMessage',
    props: { text: 'See https://a.dev/x', isFirstOfReply: true },
  })
  expect(await mounted.find({ key: 'reply' })).toBeUndefined()
  expect(await mounted.find({ text: 'engine drew this' })).toBeDefined()
})
