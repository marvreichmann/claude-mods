# Privacy policy

This policy covers the Claude Code plugins in this repository: **clickable-links** and **plan-progress**, published by Marvin Reichmann.

## In short

The plugins collect no personal data, send nothing over the network, and share nothing with the author or anyone else. Everything they do happens on your own machine, inside Claude Code.

## What the plugins use

- **clickable-links** reads the text of Claude's replies as Claude Code draws them, to find links. When you click a link, it passes that URL to your system's opener (`xdg-open`, `open` or `rundll32`), which opens it in your browser. It stores nothing.
- **plan-progress** reads Claude's task-list and `progress` tool calls to draw progress bars, and the Omarchy theme file on your machine for its colors. It passes only the path of its own sound files to your system's sound player. It stores two settings in Claude Code's plugin storage on your machine: the bar style you chose and whether sounds are muted.

Each plugin's README lists this in full under "What it runs and reads":

- [clickable-links](plugins/clickable-links/README.md#what-it-runs-and-reads)
- [plan-progress](plugins/plan-progress/README.md#what-it-runs-and-reads)

## What the plugins don't do

- No analytics, telemetry or tracking
- No network requests
- No data sent to the author or any third party
- No data kept beyond the two plan-progress settings above, which stay on your machine and which you can clear by uninstalling the plugin

Websites you open from a clicked link have their own privacy policies; the plugins have no part in what those sites collect.

## Contact

Questions or concerns: open an issue at [github.com/marvreichmann/claude-mods/issues](https://github.com/marvreichmann/claude-mods/issues).

## Changes

Changes to this policy are made in this file, and its history is in the repository's commits.
