# Claude Code mods

Mods for Claude Code (function-hook plugins), in one marketplace:

- [clickable-links](#clickable-links): click links in Claude's replies to open them in your browser
- [plan-progress](#plan-progress): live progress bars above the prompt, in five animated styles

```
/plugin marketplace add marvreichmann/claude-mods
```

## clickable-links

Click a link in Claude's reply and it opens in your browser, in Claude Code's fullscreen terminal. Each reply with links also ends with a dim row of them that underline on hover. URLs in code are left alone. See [its README](plugins/clickable-links/README.md).

![clickable-links: a click on a link in Claude's reply opens it in the browser; the row of links under the reply underlines on hover](media/clickable-links.gif)

[Watch as MP4 (5 s)](media/clickable-links.mp4)

```
/plugin install clickable-links@reichmann-mods
```

## plan-progress

Live progress bars above the Claude Code prompt, in the terminal: an animated fill, a stage pill riding the head, stage and step tick marks, green when done and red when a step fails, and sounds on each step and at the finish. See [its README](plugins/plan-progress/README.md).

![plan-progress in the Claude Code terminal: a release plan and a task list fill their flow-style bars above the prompt, stage by stage, and both finish green](media/plan-progress.gif)

[Watch as MP4 (9 s)](media/plan-progress.mp4)

- **Task lists**: `TodoWrite`, `TaskCreate` and `TaskUpdate` get a bar of their own, one row per agent
- **Staged plans**: the `progress` tool lets Claude declare stages (Build 3 → Test 4 → Deploy 2) and advance through them
- **Five styles**: `flow` (the default, braille particles streaming toward the head), `comet`, `pixel`, `rain` and `ripple`; `/progress style` opens a picker with a live sample of each
- **Omarchy themes**: running bars take the active theme's accent; elsewhere they stay purple

```
/plugin install plan-progress@reichmann-mods
```

Version 1.0.0 replaces the earlier fork of [zycck/claude-mods](https://github.com/zycck/claude-mods) published here as 0.5.x: a new mod, drawn in terminal cells, with different commands (`/progress style`, `/progress demo`, `/progress clear`, `/progress mute`).

## Demo clips

The clips in `media/` are HTML/CSS mock-ups, rendered frame by frame from `media/src/<name>/demo.html` with `node media/src/render.mjs <name>` (needs Node 22+, Chromium and ffmpeg).

## License

MIT, see [LICENSE](LICENSE).

## Privacy

Neither plugin collects data or uses the network; see [PRIVACY.md](PRIVACY.md).
