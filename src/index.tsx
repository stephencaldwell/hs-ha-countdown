import React from 'react';
import type { PluginComponentProps } from './hs-plugin';
import { hostFrameStyle } from './host-style';
import {
  entityLabel,
  isEntityId,
  normalizeServerUrl,
  pad2,
  activeTarget,
  eventName,
  parseTarget,
  remaining,
  roundUpToMinute,
  type HaState,
} from './countdown';

const PLUGIN_ID = 'hs-ha-countdown';
const DEFAULT_ENTITY = 'sensor.calendar_next_departure';

type Problem = 'no-server' | 'bad-sensor' | 'token' | 'not-found' | 'unreachable';

const PROBLEM_TEXT: Record<Problem, string> = {
  'no-server': 'Add your Home Assistant address in Plugin settings',
  'bad-sensor': 'Pick a sensor like sensor.calendar_next_departure',
  token: 'Home Assistant did not accept the access token',
  'not-found': 'Home Assistant has no sensor with that name',
  unreachable: 'Can’t reach Home Assistant right now',
};

/** Polls one entity's state through the host proxy. Keeps the last good
 *  answer through a failed poll so a network blip doesn't blank the wall. */
function useEntityState(entityId: string, refreshMs: number) {
  const [data, setData] = React.useState<HaState | null>(null);
  const [problem, setProblem] = React.useState<Problem | null>(null);
  const [loaded, setLoaded] = React.useState(false);

  React.useEffect(() => {
    let alive = true;
    const maybeSdk = window.__HS_SDK__;
    if (!maybeSdk) return;
    const sdk = maybeSdk;

    async function load() {
      const server = normalizeServerUrl(sdk.getPluginSettings?.(PLUGIN_ID)?.serverUrl);
      if (!server) { if (alive) { setProblem('no-server'); setLoaded(true); } return; }
      if (!isEntityId(entityId)) { if (alive) { setProblem('bad-sensor'); setLoaded(true); } return; }

      try {
        const res = await sdk.pluginFetch(PLUGIN_ID, {
          url: `${server}/api/states/${entityId.trim()}`,
          headers: { 'Content-Type': 'application/json' },
          secretInjections: { header: { Authorization: 'Bearer {{ha_token}}' } },
          // Let the proxy share one answer between every instance on the wall.
          cacheTtlMs: Math.max(5_000, refreshMs - 2_000),
        });
        if (!alive) return;
        if (res.status === 401 || res.status === 403) {
          // 403 from the proxy itself (domain/SSRF) carries a JSON error; HA's
          // own 401 is the token. Either way the family can't fix it from here
          // except by checking the setup, so lump them.
          setProblem('token');
        } else if (res.status === 404) {
          setProblem('not-found');
          setData(null);
        } else if (!res.ok) {
          setProblem('unreachable');
        } else {
          setData((await res.json()) as HaState);
          setProblem(null);
        }
      } catch {
        if (alive) setProblem('unreachable');
      }
      if (alive) setLoaded(true);
    }

    load();
    const id = setInterval(load, refreshMs);
    return () => { alive = false; clearInterval(id); };
  }, [entityId, refreshMs]);

  return { data, problem, loaded };
}

/** Re-renders once a second, lined up with the wall clock's second boundary
 *  so the seconds digit changes together with any clock beside it. */
function useNow(stepMs: number): Date {
  const [now, setNow] = React.useState(() => new Date());
  React.useEffect(() => {
    let timer: ReturnType<typeof setTimeout>;
    const tick = () => {
      const t = Date.now();
      setNow(new Date(t));
      timer = setTimeout(tick, stepMs - (t % stepMs) + 5);
    };
    timer = setTimeout(tick, stepMs - (Date.now() % stepMs) + 5);
    return () => clearTimeout(timer);
  }, [stepMs]);
  return now;
}

function Unit({ value, label }: { value: string; label: string }) {
  return (
    <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', minWidth: '1.6em' }}>
      <div style={{ fontSize: '2.6em', fontWeight: 700, lineHeight: 1, fontVariantNumeric: 'tabular-nums' }}>
        {value}
      </div>
      <div style={{ fontSize: '0.6em', opacity: 0.65, marginTop: '0.35em', textTransform: 'uppercase', letterSpacing: '0.08em' }}>
        {label}
      </div>
    </div>
  );
}

function Separator() {
  return <div style={{ fontSize: '2.2em', fontWeight: 300, opacity: 0.4, lineHeight: 1, alignSelf: 'flex-start' }}>:</div>;
}

export default function HaCountdown({ config, style }: PluginComponentProps) {
  const entityId = typeof config.entityId === 'string' && config.entityId.trim()
    ? config.entityId.trim()
    : DEFAULT_ENTITY;
  const refreshSeconds = Number(config.refreshSeconds);
  const refreshMs = (Number.isFinite(refreshSeconds) && refreshSeconds >= 10 ? refreshSeconds : 60) * 1000;
  const showSeconds = config.showSeconds !== false;
  const showTarget = config.showTarget !== false;
  const title = typeof config.title === 'string' ? config.title.trim() : '';
  const finishedText = typeof config.finishedText === 'string' && config.finishedText.trim()
    ? config.finishedText.trim()
    : 'It’s time!';
  const emptyText = typeof config.emptyText === 'string' && config.emptyText.trim()
    ? config.emptyText.trim()
    : 'Nothing coming up';

  const showEvent = config.showEvent !== false;

  const { data, problem, loaded } = useEntityState(entityId, refreshMs);
  const now = useNow(1000);
  // Parsed once per answer from Home Assistant, not on every tick.
  const departure = React.useMemo(() => parseTarget(data?.state), [data]);
  const target = activeTarget(departure, now);
  const event = showEvent && target ? eventName(data) : null;
  const heading = title || entityLabel(data, entityId);

  const titleLeft = config.titlePosition === 'left';

  const frame: React.CSSProperties = {
    ...hostFrameStyle(style, { baseFontSize: 24 }),
    display: 'flex',
    flexDirection: titleLeft ? 'row' : 'column',
    alignItems: 'center',
    justifyContent: 'center',
    gap: titleLeft ? '1.2em' : '0.6em',
    textAlign: titleLeft ? 'left' : 'center',
  };

  /** The card: title (and an optional line under it) beside or above the
   *  main content. In the left layout the title side takes the spare width
   *  and wraps, so a long name never pushes the clock out of the card. */
  const card = (main: React.ReactNode, footnote?: React.ReactNode) => {
    if (!titleLeft) {
      return (
        <div style={frame}>
          <div style={{ fontSize: '1em', fontWeight: 600 }}>{heading}</div>
          {event && <div style={{ fontSize: '1.2em', fontWeight: 600, lineHeight: 1.15 }}>{event}</div>}
          {main}
          {footnote}
        </div>
      );
    }
    return (
      <div style={frame}>
        <div style={{ flex: '1 1 0', minWidth: 0, display: 'flex', flexDirection: 'column', gap: '0.3em' }}>
          <div style={{ fontSize: '1.3em', fontWeight: 600, lineHeight: 1.15, overflowWrap: 'anywhere' }}>{heading}</div>
          {event && <div style={{ fontSize: '1em', fontWeight: 500, lineHeight: 1.2, overflowWrap: 'anywhere' }}>{event}</div>}
          {footnote}
        </div>
        <div style={{ flex: '0 0 auto', display: 'flex', justifyContent: 'flex-end' }}>{main}</div>
      </div>
    );
  };

  // A setup problem with nothing to show yet: say what to fix.
  if (problem && !target) {
    return card(<div style={{ fontSize: '0.75em', opacity: 0.7, maxWidth: titleLeft ? '14em' : undefined }}>{PROBLEM_TEXT[problem]}</div>);
  }

  if (!loaded) {
    return (
      <div style={frame}>
        <div style={{ fontSize: '0.8em', opacity: 0.5 }}>Loading…</div>
      </div>
    );
  }

  if (!target) {
    return card(<div style={{ fontSize: '0.85em', opacity: 0.7 }}>{emptyText}</div>);
  }

  const exact = remaining(target, now);
  const left = showSeconds ? exact : roundUpToMinute(exact);
  const formatDate = window.__HS_SDK__?.formatDate;
  const targetText = formatDate
    ? formatDate(target, "EEE, MMM d 'at' h:mm a")
    : target.toLocaleString();

  const clock = left.done ? (
    <div style={{ fontSize: '2.2em', fontWeight: 700, lineHeight: 1.1 }}>{finishedText}</div>
  ) : (
    <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'center', gap: '0.35em' }}>
      {left.days > 0 && (
        <>
          <Unit value={String(left.days)} label={left.days === 1 ? 'day' : 'days'} />
          <Separator />
        </>
      )}
      <Unit value={pad2(left.hours)} label="hrs" />
      <Separator />
      <Unit value={pad2(left.minutes)} label="min" />
      {showSeconds && (
        <>
          <Separator />
          <Unit value={pad2(left.seconds)} label="sec" />
        </>
      )}
    </div>
  );

  const footnote = showTarget ? (
    <div style={{ fontSize: '0.7em', opacity: 0.6 }}>
      {targetText}
      {problem === 'unreachable' ? ' · not updating' : ''}
    </div>
  ) : undefined;

  return card(clock, footnote);
}
