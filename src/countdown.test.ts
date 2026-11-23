import { describe, expect, it } from 'vitest';
import { entityLabel, isEntityId, nextDeparture, normalizeServerUrl, parseTarget, remaining, roundUpToMinute, scheduleDepartures } from './countdown';

describe('parseTarget', () => {
  it('reads an ISO timestamp with an offset', () => {
    expect(parseTarget('2026-11-21T08:00:00+00:00')?.toISOString()).toBe('2026-11-21T08:00:00.000Z');
    expect(parseTarget('2026-11-21T08:00:00-05:00')?.toISOString()).toBe('2026-11-21T13:00:00.000Z');
  });

  it('treats Home Assistant placeholders and junk as no value', () => {
    for (const s of ['unknown', 'unavailable', 'Unknown', '', '  ', 'none', 'not a date', undefined, null]) {
      expect(parseTarget(s as string)).toBeNull();
    }
  });
});

describe('remaining', () => {
  const target = new Date('2026-11-21T08:00:00Z');

  it('splits time into days, hours, minutes and seconds', () => {
    const now = new Date(target.getTime() - ((2 * 86400 + 3 * 3600 + 4 * 60 + 5) * 1000));
    expect(remaining(target, now)).toEqual({ done: false, days: 2, hours: 3, minutes: 4, seconds: 5 });
  });

  it('rounds a part second up so zero lands on the target', () => {
    const now = new Date(target.getTime() - 400);
    expect(remaining(target, now)).toEqual({ done: false, days: 0, hours: 0, minutes: 0, seconds: 1 });
  });

  it('is done at and after the target', () => {
    expect(remaining(target, target).done).toBe(true);
    expect(remaining(target, new Date(target.getTime() + 60_000)).done).toBe(true);
  });
});

describe('normalizeServerUrl', () => {
  it('drops trailing slashes and keeps http(s) only', () => {
    expect(normalizeServerUrl('http://ha.local:8123/')).toBe('http://ha.local:8123');
    expect(normalizeServerUrl(' https://x.ui.nabu.casa ')).toBe('https://x.ui.nabu.casa');
    expect(normalizeServerUrl('ha.local:8123')).toBeNull();
    expect(normalizeServerUrl('')).toBeNull();
    expect(normalizeServerUrl(undefined)).toBeNull();
  });
});

describe('isEntityId', () => {
  it('accepts domain.object_id only', () => {
    expect(isEntityId('sensor.calendar_text_announce')).toBe(true);
    expect(isEntityId('sensor')).toBe(false);
    expect(isEntityId('sensor.a/../b')).toBe(false);
  });
});

describe('entityLabel', () => {
  it('prefers the friendly name', () => {
    expect(entityLabel({ attributes: { friendly_name: 'Next announcement' } }, 'sensor.x')).toBe('Next announcement');
  });

  it('falls back to the object id', () => {
    expect(entityLabel(null, 'sensor.calendar_text_announce')).toBe('Calendar text announce');
  });
});

describe('scheduleDepartures', () => {
  const data = (schedule: unknown) => ({ state: 'x', attributes: { schedule } });

  it('reads departure times from the schedule list, soonest first', () => {
    const list = scheduleDepartures(data([
      { departure: '2026-11-21T09:30:00-06:00', route: 'B' },
      { departure: '2026-11-21T09:00:00-06:00', route: 'A' },
    ]));
    expect(list.map((d) => d.toISOString())).toEqual(['2026-11-21T15:00:00.000Z', '2026-11-21T15:30:00.000Z']);
  });

  it('accepts the list as a JSON string and epoch numbers', () => {
    const list = scheduleDepartures(data(JSON.stringify([{ departure: 1795262400 }, { departure: 1795262400000 }])));
    expect(list).toHaveLength(2);
    expect(list[0].getTime()).toBe(1795262400000);
  });

  it('skips entries without a readable departure', () => {
    const list = scheduleDepartures(data([{ departure: 'unknown' }, { other: 1 }, null, 'x', { departure: '2026-11-21T09:00:00Z' }]));
    expect(list).toHaveLength(1);
  });

  it('is empty when the attribute is missing or not a list', () => {
    expect(scheduleDepartures(null)).toEqual([]);
    expect(scheduleDepartures(data(undefined))).toEqual([]);
    expect(scheduleDepartures(data('not json'))).toEqual([]);
    expect(scheduleDepartures(data({ departure: '2026-11-21T09:00:00Z' }))).toEqual([]);
  });

  it('honours a different attribute and key', () => {
    const d = { attributes: { trains: [{ leaves: '2026-11-21T09:00:00Z' }] } };
    expect(scheduleDepartures(d, 'trains', 'leaves')).toHaveLength(1);
  });
});

describe('nextDeparture', () => {
  const at = (iso: string) => new Date(iso);
  const list = [at('2026-11-21T09:00:00Z'), at('2026-11-21T09:30:00Z')];

  it('picks the soonest departure still ahead', () => {
    expect(nextDeparture(list, at('2026-11-21T08:00:00Z'))?.toISOString()).toBe('2026-11-21T09:00:00.000Z');
  });

  it('holds a departure for a minute after it leaves, then moves on', () => {
    expect(nextDeparture(list, at('2026-11-21T09:00:59Z'))?.toISOString()).toBe('2026-11-21T09:00:00.000Z');
    expect(nextDeparture(list, at('2026-11-21T09:01:00Z'))?.toISOString()).toBe('2026-11-21T09:30:00.000Z');
  });

  it('is null once every departure has gone', () => {
    expect(nextDeparture(list, at('2026-11-21T10:00:00Z'))).toBeNull();
    expect(nextDeparture([], at('2026-11-21T10:00:00Z'))).toBeNull();
  });
});

describe('roundUpToMinute', () => {
  it('rounds part minutes up and carries', () => {
    expect(roundUpToMinute({ done: false, days: 0, hours: 0, minutes: 0, seconds: 27 }))
      .toEqual({ done: false, days: 0, hours: 0, minutes: 1, seconds: 0 });
    expect(roundUpToMinute({ done: false, days: 0, hours: 23, minutes: 59, seconds: 1 }))
      .toEqual({ done: false, days: 1, hours: 0, minutes: 0, seconds: 0 });
  });

  it('leaves whole minutes and done alone', () => {
    const whole = { done: false, days: 0, hours: 1, minutes: 5, seconds: 0 };
    expect(roundUpToMinute(whole)).toBe(whole);
    const done = { done: true, days: 0, hours: 0, minutes: 0, seconds: 0 };
    expect(roundUpToMinute(done)).toBe(done);
  });
});
