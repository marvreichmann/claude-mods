# plan-progress

A Claude Code mod that draws live progress bars above the prompt in the terminal: an animated fill, a stage pill riding the head with sub-cell movement, stage and step tick marks, green "Done" and red "failed" states, and sounds on each step and at the finish.

Bars come from two places:

- **Task lists**: `TodoWrite`, `TaskCreate` and `TaskUpdate` get a bar on their own, one row per agent, so subagents run side by side.
- **Staged plans**: the `progress` tool (`mcp__plan-progress__progress`) lets Claude declare stages (Build 3 → Test 4 → Deploy 2) and advance through them.

Finished bars leave after 30 seconds; `×` dismisses one.

On Omarchy, running bars take the active theme's `accent` color, and the empty track its `background` and `foreground`, (from `~/.local/state/omarchy/current/theme/colors.toml`) and follow theme switches within a few seconds; elsewhere they stay purple. Done is always green, failed red.

## Styles

- `flow` (default): braille particles streaming toward the head, smooth spring easing; solid green when done
- `comet`: the pill leads a glowing trail shedding sparks, stars ahead; solid green when done
- `pixel`: a grid of dots four rows deep on a tinted bar, filling in toward the pill, each dot switching on and off on its own

## Commands

- `/progress demo`: two demo plans
- `/progress style`: open a picker with a live sample of each style
- `/progress style <name>`: pick a style directly (remembered)
- `/progress try [name|stop]`: loop one style; again for the next
- `/progress styles`: play every style once, one after the other
- `/progress clear`: remove all bars
- `/progress mute` / `/progress unmute`: sounds off / on (remembered)

## Install

```sh
claude --plugin-dir /path/to/plan-progress
```

or list the folder in `CLAUDE_CODE_PLUGIN_DIRS`.

On Linux, sounds play through `pw-play`, `paplay` or `aplay`; on macOS through `afplay`.

## Develop

```sh
claude plugin validate .
claude plugin test .
```
