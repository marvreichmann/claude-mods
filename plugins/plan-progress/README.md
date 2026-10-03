# plan-progress

A Claude Code mod that draws live progress bars above the prompt in the terminal: a dithered, shimmering fill, a stage pill riding the head with sub-cell movement, stage and step tick marks, green "Done" and red "failed" states, and sounds on each step and at the finish.

Bars come from two places:

- **Task lists**: `TodoWrite`, `TaskCreate` and `TaskUpdate` get a bar on their own, one row per agent, so subagents run side by side.
- **Staged plans**: the `progress` tool (`mcp__plan-progress__progress`) lets Claude declare stages (Build 3 → Test 4 → Deploy 2) and advance through them.

Finished bars leave after 30 seconds; `×` dismisses one.

## Commands

- `/progress demo`: two demo plans
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
