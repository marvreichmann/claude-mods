# plan-progress

A Claude Code mod that draws live progress bars above the prompt in the terminal: an animated fill, a stage pill riding the head with sub-cell movement, stage and step tick marks, green "Done" and red "failed" states, and sounds on each step and at the finish.

![plan-progress in the Claude Code terminal: a release plan and a task list fill their flow-style bars above the prompt, stage by stage, and both finish green](https://raw.githubusercontent.com/marvreichmann/claude-mods/main/media/plan-progress.gif)

Bars come from two places:

- **Task lists**: `TodoWrite`, `TaskCreate` and `TaskUpdate` get a bar on their own, one row per agent, so subagents run side by side.
- **Staged plans**: the `progress` tool (`mcp__plan-progress__progress`) lets Claude declare stages (Build 3 → Test 4 → Deploy 2) and advance through them.

Finished bars leave after 30 seconds; `×` dismisses one.

On Omarchy, running bars take the active theme's `accent` color, and the empty track its `background` and `foreground`, (from `~/.local/state/omarchy/current/theme/colors.toml`) and follow theme switches within a few seconds; elsewhere they stay purple. Done is always green, failed red.

## Styles

- `flow` (default): braille particles streaming toward the head, smooth spring easing; solid green when done
- `comet`: the pill leads a glowing trail shedding sparks, stars ahead; solid green when done
- `pixel`: a grid of dots four rows deep on a tinted bar, filling in toward the pill, each dot switching on and off on its own
- `rain`: digital rain falling through the dot grid, heavier toward the pill
- `ripple`: sonar rings pulsing out from the pill back through the dot grid

## Commands

- `/progress demo`: two demo plans
- `/progress style`: open a picker with a live sample of each style
- `/progress style <name>`: pick a style directly (remembered)
- `/progress try [name|stop]`: loop one style; again for the next
- `/progress styles`: play every style once, one after the other
- `/progress clear`: remove all bars
- `/progress mute` / `/progress unmute`: sounds off / on (remembered)

## Install

In Claude Code:

```
/plugin marketplace add marvreichmann/claude-mods
/plugin install plan-progress@reichmann-mods
```

Or load a checkout for one session with `claude --plugin-dir /path/to/plan-progress`, or list the folder in `CLAUDE_CODE_PLUGIN_DIRS`.

On Linux, sounds play through `pw-play`, `paplay` or `aplay`; on macOS through `afplay`.

## What it runs and reads

- **Runs:** only local programs, to play the plugin's own two sounds (`sounds/tick.wav` on each step, `sounds/done.wav` at the finish), unless you `/progress mute`. Claude Code's own player plays nothing in a Linux terminal, so the plugin uses the system's:
  - once per session, to find a player: `which pw-play`, `which paplay`, `which afplay`, `which aplay`, stopping at the first that exists
  - for each sound: that player with the sound file's path, `pw-play <plugin folder>/sounds/tick.wav` (or `paplay`, `afplay`, `aplay -q`). With none found, Claude Code's own player plays the file instead
- **Sends:** nothing leaves your machine. The only thing the plugin passes outside itself is the path of one of its own sound files, to the player above. No conversation text, task text, theme data or anything else is passed to any program or sent anywhere. No network access
- **Reads:**
  - the input and result of Claude's `TodoWrite`, `TaskCreate` and `TaskUpdate` calls, to draw task lists
  - the calls Claude makes to the `progress` tool this plugin adds, to draw staged plans
  - the session's list of subagents, to give each agent's task list its own row
  - the environment variables `HOME` and `XDG_STATE_HOME`, only to build the path of the Omarchy theme file `~/.local/state/omarchy/current/theme/colors.toml`, which it reads every 3 seconds for its `accent`, `background` and `foreground` colors. These are not credentials and are not passed anywhere. Without Omarchy the file is missing and the bars stay purple
- **Stores:** two settings in Claude Code's plugin storage on your machine: the bar style you pick and whether sounds are muted. Nothing else is saved or collected

## Tools, hooks and commands

- **The `progress` tool:** the plugin adds this tool (`mcp__plan-progress__progress`) and answers its calls itself: it updates the bar and returns a one-line confirmation to Claude. It stands in for no other tool
- **`TodoWrite`, `TaskCreate`, `TaskUpdate`:** the plugin watches these calls to draw task-list bars. Each call runs exactly as it would without the plugin; the plugin reads its input and result afterwards and never changes or blocks it
- **`/progress`:** the command the plugin adds, with the subcommands under [Commands](#commands)

## Requirements

- Claude Code 2.1.287 or later. Mods (function hooks) are an early-access API that may change between releases
- The terminal: the bars are drawn in terminal cells, so the desktop app and the IDE extensions keep their own prompt area

## Develop

```sh
claude plugin validate .
claude plugin test .
```

The demo clip is rendered from `media/src/plan-progress/demo.html`, which draws its bars with this folder's `hooks/bar.ts`: `node media/src/plan-progress/build-bar.mjs plugins/plan-progress/hooks/bar.ts`, then `node media/src/render.mjs plan-progress`.

## License

MIT
