const URL_PATTERN = /https?:\/\/[^\s<>()[\]{}"'`]+/g
const TRAILING_PUNCTUATION = /[.,;:!?*_~]+$/
/** Fenced code blocks and inline code spans, where a URL is example text. */
const CODE = /^(```|~~~)[^\n]*\n[\s\S]*?(?:^\1[^\n]*$|(?![\s\S]))|`[^`\n]+`/gm
/** The most links a `Markdown` element takes in `pressableLinks`. */
const MAX_LINKS = 256
const LABEL_LENGTH = 40

const isUrl = (text: string): boolean => {
  try {
    new URL(text)
    return true
  } catch {
    return false
  }
}

/** The distinct http(s) URLs a markdown text mentions outside code, as it writes them. */
export const findLinks = (text: string): string[] => {
  const found = (text.replace(CODE, ' ').match(URL_PATTERN) ?? [])
    .map(url => url.replace(TRAILING_PUNCTUATION, ''))
    .filter(isUrl)

  return [...new Set(found)].slice(0, MAX_LINKS)
}

/** A short name for a link: its host and path, cut to `LABEL_LENGTH`. */
export const labelOf = (url: string): string => {
  const { host, pathname } = new URL(url)
  const label = pathname === '/' ? host : `${host}${pathname}`

  return label.length > LABEL_LENGTH ? `${label.slice(0, LABEL_LENGTH - 1)}…` : label
}
