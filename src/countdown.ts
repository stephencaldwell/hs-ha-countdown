// Pure rules for the countdown, kept apart from React so they can be tested.

/** What a Home Assistant entity state response looks like, as far as we care. */
export interface HaState {
  entity_id?: string;
  state?: string;
  attributes?: { friendly_name?: string; [key: string]: unknown };
}

/** States Home Assistant uses for "there is no value right now". */
const NO_VALUE = new Set(['', 'unknown', 'unavailable', 'none', 'null']);

/** The instant a timestamp sensor's state names, or null when it names none.
 *  Timestamp sensors report ISO 8601 with an offset ("2026-11-21T08:00:00+00:00"),
 *  so the parsed instant is exact whatever clock the display runs on. */
export function parseTarget(state: string | undefined | null): Date | null {
  if (typeof state !== 'string') return null;
  const value = state.trim();
  if (NO_VALUE.has(value.toLowerCase())) return null;
  const ms = Date.parse(value);
  return Number.isFinite(ms) ? new Date(ms) : null;
}

export interface Remaining {
  done: boolean;
  days: number;
  hours: number;
  minutes: number;
  seconds: number;
}

/** Time left from `now` to `target`, split into parts. Rounds up to the next
 *  whole second so the display reaches 0 exactly at the target, not a second
 *  early. */
export function remaining(target: Date, now: Date): Remaining {
  const ms = target.getTime() - now.getTime();
  if (ms <= 0) return { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
  let total = Math.ceil(ms / 1000);
  const days = Math.floor(total / 86400);
  total -= days * 86400;
  const hours = Math.floor(total / 3600);
  total -= hours * 3600;
  const minutes = Math.floor(total / 60);
  const seconds = total - minutes * 60;
  return { done: false, days, hours, minutes, seconds };
}

/** The base URL with no trailing slash, or null if it isn't an http(s) URL. */
export function normalizeServerUrl(raw: unknown): string | null {
  if (typeof raw !== 'string') return null;
  const value = raw.trim().replace(/\/+$/, '');
  if (!value) return null;
  try {
    const url = new URL(value);
    if (url.protocol !== 'http:' && url.protocol !== 'https:') return null;
    return value;
  } catch {
    return null;
  }
}

/** Entity ids are `domain.object_id`; anything else would build a bad URL. */
export function isEntityId(value: unknown): value is string {
  return typeof value === 'string' && /^[a-z_]+\.[a-z0-9_]+$/.test(value.trim());
}

/** The friendly name of an entity, falling back to a tidied object id. */
export function entityLabel(data: HaState | null, entityId: string): string {
  const name = data?.attributes?.friendly_name;
  if (typeof name === 'string' && name.trim()) return name.trim();
  const objectId = entityId.split('.')[1] ?? entityId;
  const words = objectId.replace(/_/g, ' ').trim();
  return words ? words[0].toUpperCase() + words.slice(1) : entityId;
}

export function pad2(n: number): string {
  return n < 10 ? `0${n}` : String(n);
}

/** How long a departure that just passed keeps the wall on the finished text
 *  before the countdown moves on to the next one. */
export const JUST_LEFT_MS = 60_000;

/** One departure value as Home Assistant may hand it over: an ISO string, or
 *  epoch seconds or milliseconds. */
function parseInstant(value: unknown): Date | null {
  if (typeof value === 'number' && Number.isFinite(value) && value > 0) {
    return new Date(value < 1e12 ? value * 1000 : value);
  }
  return typeof value === 'string' ? parseTarget(value) : null;
}

/** Every departure in the entity's schedule attribute, soonest first. The
 *  attribute is normally a list already; a template sensor can also store it
 *  as a JSON string, so that is accepted too. Entries without a readable time
 *  are skipped rather than failing the whole list. */
export function scheduleDepartures(
  data: HaState | null,
  attribute = 'schedule',
  key = 'departure',
): Date[] {
  let list: unknown = data?.attributes?.[attribute];
  if (typeof list === 'string') {
    try { list = JSON.parse(list); } catch { return []; }
  }
  if (!Array.isArray(list)) return [];
  const out: Date[] = [];
  for (const entry of list) {
    if (!entry || typeof entry !== 'object') continue;
    const when = parseInstant((entry as Record<string, unknown>)[key]);
    if (when) out.push(when);
  }
  return out.sort((a, b) => a.getTime() - b.getTime());
}

/** The departure to count down to: the soonest one still ahead, or one that
 *  left under a minute ago so the finished text gets its moment. Null when
 *  nothing is left. */
export function nextDeparture(departures: Date[], now: Date): Date | null {
  const cutoff = now.getTime() - JUST_LEFT_MS;
  return departures.find((d) => d.getTime() > cutoff) ?? null;
}

/** The same time left, rounded up to a whole minute, for a countdown that
 *  hides its seconds: 27 seconds to go reads as 1 minute, never as 00:00. */
export function roundUpToMinute(r: Remaining): Remaining {
  if (r.done || r.seconds === 0) return r;
  let { days, hours, minutes } = r;
  minutes += 1;
  if (minutes === 60) { minutes = 0; hours += 1; }
  if (hours === 24) { hours = 0; days += 1; }
  return { done: false, days, hours, minutes, seconds: 0 };
}
