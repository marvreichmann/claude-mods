import type { EngineInterface, Register } from 'claude-code'

import { findLinks, labelOf } from './links'

/** Commands that hand a URL to the default browser: Linux, macOS, Windows. */
const OPENERS = [['xdg-open'], ['open'], ['rundll32', 'url.dll,FileProtocolHandler']]

const openInBrowser = async ($: EngineInterface, url: string) => {
  for (const opener of OPENERS) {
    try {
      const ran = await $.process.run([...opener, url], { timeoutMs: 5000 })
      if (ran.exitCode === 0) return
    } catch {
      // try the next opener
    }
  }
  $.ui.toast(`Could not open ${url}`)
}

export const register: Register = on => {
  // Other surfaces already open links on a plain click.
  on('ui.render', { component: 'AssistantMessage', surface: 'terminal' }, async ($, e, next) => {
    const links = findLinks(e.props.text)
    if (links.length === 0) return next(e)

    const { Box, Button, Markdown, Text } = $.ui.resolve(e)

    return (
      <Box flexDirection="column">
        <Markdown
          key="reply"
          text={e.props.text}
          pressableLinks={links}
          onLinkPress={link => void openInBrowser($, link.href)}
        />
        <Box flexDirection="row" flexWrap="wrap" columnGap={1}>
          <Text dimColor>↳</Text>
          {links.map((url, index) => (
            <Box key={`link-${index}`}>
              <Button
                key={`open-${index}`}
                plain
                dimColor
                label={labelOf(url)}
                hover={{ underline: true, dimColor: false }}
                onPress={() => void openInBrowser($, url)}
              />
            </Box>
          ))}
        </Box>
      </Box>
    )
  })
}
