import { describe, expect, it } from 'vitest';
import { activeTarget, entityLabel, eventName, isEntityId, normalizeServerUrl, parseTarget, remaining, roundUpToMinute } from './countdown';

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

describe('activeTarget', () => {
  const target = new Date('2026-11-23T13:55:00Z');
  const at = (iso: string) => new Date(iso);

  it('counts down to the sensor time while it is ahead', () => {
    expect(activeTarget(target, at('2026-11-23T13:00:00Z'))).toBe(target);
  });

  it('holds the time for a minute after it passes, then lets go', () => {
    expect(activeTarget(target, at('2026-11-23T13:55:59Z'))).toBe(target);
    expect(activeTarget(target, at('2026-11-23T13:56:00Z'))).toBeNull();
  });

  it('is null when the sensor has no time', () => {
    expect(activeTarget(null, target)).toBeNull();
  });
});

describe('eventName', () => {
  it('reads the event attribute', () => {
    expect(eventName({ state: 'x', attributes: { event: ' Simon Swim ' } })).toBe('Simon Swim');
    expect(eventName({ attributes: { title: 'Piano' } }, 'title')).toBe('Piano');
  });

  it('is null when there is no usable name', () => {
    expect(eventName(null)).toBeNull();
    expect(eventName({ attributes: {} })).toBeNull();
    expect(eventName({ attributes: { event: '  ' } })).toBeNull();
    expect(eventName({ attributes: { event: { name: 'x' } } })).toBeNull();
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
