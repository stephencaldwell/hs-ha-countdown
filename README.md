# Home Assistant Countdown

A Home Screens plugin that counts down to the next departure in a Home Assistant
sensor's `schedule` attribute. Out of the box it watches `sensor.calendar_text_announce`
and expects an attribute like:

```yaml
schedule:
  - departure: "2026-11-21T09:00:00-06:00"
  - departure: "2026-11-21T09:30:00-06:00"
```

It counts down to the soonest departure still ahead. When one leaves, the finished text
shows for a minute and then the countdown moves to the next. The list may be a real list
or a JSON string, and times may be ISO strings or epoch seconds or milliseconds; entries
without a readable time are skipped. The sensor's own state is not used.

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
| `entityId` | `sensor.calendar_text_announce` | Sensor that holds the schedule |
| `scheduleAttribute` | `schedule` | Attribute holding the list of departures |
| `departureKey` | `departure` | Field in each list item that holds its time |
| `refreshSeconds` | 60 | How often to ask Home Assistant for the time (the countdown itself ticks every second) |
| `title` | empty | Heading; empty uses the sensor's friendly name |
| `finishedText` | `It's time!` | Shown for a minute after a departure leaves |
| `emptyText` | `Nothing coming up` | Shown when the schedule is empty or every departure has left |
| `titlePosition` | `above` | `above` puts the title over the clock; `left` puts it (and the date) to the left of the clock |
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
