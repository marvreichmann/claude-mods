# Clickable Links

Click a link in Claude's reply and it opens in your browser. Claude Code's fullscreen terminal takes over the mouse, so the terminal's own link handling doesn't reach the links in a reply; this mod opens them on a plain click.

![clickable-links: a click on a link in Claude's reply opens it in the browser; the row of links under the reply underlines on hover](https://raw.githubusercontent.com/marvreichmann/claude-mods/main/media/clickable-links.gif)

Each reply that has links also ends with a dim row of them, host and path only:

```
↳ example.com  docs.anthropic.com/en/docs/claude-code/overview
```

Hover an entry and it underlines; click it and it opens.

- Plain click opens a link, inline or in the row. Ctrl- and alt-click still work as before
- URLs inside code blocks and inline code are left alone
- Opens with `xdg-open` on Linux, `open` on macOS and `rundll32` on Windows; a toast says so when none works
- Terminal only: the desktop app and the IDE extensions already open links on a click, so their replies stay as they are
- No network calls, no stored data

## What it runs and reads

- **Runs:** your system's URL opener, with the URL of the link you clicked as its only argument, when you click: `xdg-open <url>` on Linux, `open <url>` on macOS, `rundll32 url.dll,FileProtocolHandler <url>` on Windows. It tries them in that order and stops at the first that succeeds. Nothing runs until you click
- **Reads:** the text of Claude's replies as Claude Code draws them, to find the `http` and `https` links in them
- **Network:** none. The plugin fetches nothing; your browser opens the link
- **Stores:** nothing. No files written, no settings saved, no data collected or sent anywhere

## Install

In Claude Code:

```
/plugin marketplace add marvreichmann/claude-mods
/plugin install clickable-links@reichmann-mods
```

## Requirements

- Claude Code 2.1.287 or later. Mods (function hooks) are an early-access API that may change between releases
- Fullscreen terminal mode, where Claude Code reports mouse clicks and hovers

## Known limits

- Another mod that redraws Claude's replies (for example [claude-mdview](https://github.com/xuanji86/claude-mdview)) competes for the same drawing; only one of them draws a given reply
- Links are found by pattern: a URL with parentheses in it is cut at the first one

## Demo clip

`media/clickable-links.gif` and `.mp4` are rendered from `media/src/clickable-links/demo.html`, a mock-up of the terminal, with `node media/src/render.mjs clickable-links` (needs Chromium and ffmpeg).

## Tests

```
claude plugin test plugins/clickable-links
```

## License

MIT
