# Home Assistant Countdown

A Home Screens plugin that counts down to the time in a Home Assistant timestamp
sensor, and can show the event's name with it. Out of the box it watches
`sensor.calendar_next_departure` and expects something like:

```yaml
state: "2026-11-23T13:55:00+00:00"
attributes:
  event: "Simon Swim"
```

The countdown uses the sensor's state. The name comes from the `event` attribute and
can be turned off with **Show the event's name**. When the time comes, the finished
text shows for a minute; after that the card shows the empty text until Home Assistant
moves the sensor on to the next departure.

## Setup

1. Install the plugin (`npm run pack` makes `plugin.tar.gz`; use **Install from URL…**
   or copy `manifest.json` and `dist/bundle.js` into `data/plugins/hs-ha-countdown/`).
2. In the editor's plugin manager, open **Plugin settings** and set the Home Assistant
   address, for example `http://homeassistant.local:8123`.
3. Add the **Long-lived access token** secret (Home Assistant: your profile, Security tab).
4. Drop **Home Assistant Countdown** on a screen. Change the sensor in its panel if needed.

## Module options

| Field | Default | What it does |
|---|---|---|
| `entityId` | `sensor.calendar_next_departure` | Timestamp sensor to count down to |
| `refreshSeconds` | 60 | How often to ask Home Assistant for the time (the countdown itself ticks every second) |
| `title` | empty | Heading; empty uses the sensor's friendly name |
| `finishedText` | `It's time!` | Shown for a minute after a departure leaves |
| `emptyText` | `Nothing coming up` | Shown when the sensor has no time, or a minute after it passes |
| `titlePosition` | `above` | `above` puts the title over the clock; `left` puts it (with the event and the date) to the left of the clock |
| `showEvent` | on | Show the event's name from the sensor's `event` attribute |
| `showSeconds` | on | Show the seconds column |
| `showTarget` | on | Show the date and time under the countdown |

The request goes through the hub's plugin proxy (`localNetwork` permission, `*` domains),
so the token never reaches the display.

## Develop

```bash
npm install
npm test        # countdown rules
npm run build   # dist/bundle.js
npm run dev     # serve on :5173 for the editor's Developer tab
```

## Releases

`.github/workflows/release.yml` runs on every push to `main`: it installs, type-checks,
runs the tests and runs `npm run pack`. When the `version` in `manifest.json` has no
release yet, it publishes release `v<version>` with `plugin.tar.gz` and its SHA-256
attached (a version with a `-` such as `1.1.0-beta.1` is marked as a pre-release).
A push that doesn't bump the version builds and tests but publishes nothing.

To ship a new version, bump `version` in both `manifest.json` and `package.json`
(the workflow fails if they differ) and push. Install it from the release's
`plugin.tar.gz` link with **Install from URL…**, or use
`https://github.com/<owner>/<repo>/releases/download/v{version}/plugin.tar.gz`
so the editor can follow later versions.
