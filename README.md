# Gaming Steam Status

A Home Assistant Lovelace custom card that auto-discovers Steam entities and displays them in a compact grid layout with game backgrounds.

## Features

- Auto-discovers all `sensor.steam_*` entities
- Shows online status and current game
- Toggle offline visibility
- Optional Steam level badge
- Compact mode

## Installation

### HACS (recommended)

Add this repository as a custom repository in HACS, then install "Gaming Steam Status".

### Manual

1. Copy `gaming-steam-status.js` to `/config/www/community/discord-compact-card/`
2. Add the resource in Lovelace:
   ```yaml
   resources:
     - url: /local/community/discord-compact-card/gaming-steam-status.js
       type: module
   ```

## Configuration

```yaml
type: custom:gaming-steam-card
title: "Steam"
hide_offline: true
show_toggle: true
show_steam_level: false
compact_mode: false
sort_by: "status"
click_action: "popup"
```

### Options

| Option | Default | Description |
|--------|---------|-------------|
| `title` | `"Steam"` | Card title |
| `auto_populate` | `true` | Auto-discover all `sensor.steam_*` entities |
| `entities` | `[]` | Manual entity list when `auto_populate: false` |
| `hide_offline` | `false` | Hide offline users by default |
| `show_toggle` | `true` | Show toggle button for offline visibility |
| `show_steam_level` | `false` | Show Steam level badge on avatar |
| `compact_mode` | `false` | Compact display mode |
| `sort_by` | `"status"` | Sort order (`status`, `name`, `game`) |
| `click_action` | `"popup"` | Click action (`popup`, `navigate`, `toggle`) |
| `max_online` | `0` | Max online users to show (0 = all) |
| `max_offline` | `0` | Max offline users to show (0 = all) |
