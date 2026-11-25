import { describe, expect, it } from 'vitest';
import { schemas } from '../src/schemas.js';
import { profile } from './helpers.js';

const parseProfile = (patch: Record<string, unknown>) =>
  schemas['profile:update'].safeParse({ profile: { ...profile(), ...patch } });
const cleaned = (patch: Record<string, unknown>) => parseProfile(patch).data?.profile;

describe('profile', () => {
  it('trims the name and falls back to Agent', () => {
    expect(cleaned({ name: '  Ada ' })?.name).toBe('Ada');
    for (const name of ['', '   ', '​', '‍']) expect(cleaned({ name })?.name).toBe('Agent');
  });

  it('strips control and text-direction characters', () => {
    expect(cleaned({ name: 'A\u0000d‮a\n' })?.name).toBe('Ada');
    expect(cleaned({ alias: 'Night⁦ Owl' })?.alias).toBe('Night Owl');
  });

  it('keeps names in any script', () => {
    for (const name of ['آدم', 'Zoë', '张伟']) expect(cleaned({ name })?.name).toBe(name);
  });

  it('enforces the length limits', () => {
    expect(parseProfile({ name: 'x'.repeat(14) }).success).toBe(true);
    expect(parseProfile({ name: 'x'.repeat(15) }).success).toBe(false);
    expect(parseProfile({ alias: 'x'.repeat(20) }).success).toBe(true);
    expect(parseProfile({ alias: 'x'.repeat(21) }).success).toBe(false);
    expect(parseProfile({ badge: '12345' }).success).toBe(false);
  });

  it('only accepts #rrggbb colours', () => {
    expect(parseProfile({ color: '#A0b1C2' }).success).toBe(true);
    for (const color of ['red', '#fff', '#12345g', '#123456;x', 'url(x)', '']) {
      expect(parseProfile({ color }).success).toBe(false);
    }
  });

  it('accepts every badge of the prototype and refuses markup or blanks', () => {
    for (const badge of ['★', '⚡', '☾', '✦', '◆', '☀', '♠', '✿', '⚓', '♫', '☂', '⚙']) {
      expect(parseProfile({ badge }).success).toBe(true);
    }
    for (const badge of ['', ' ', '<b>', '"', '\u0000']) expect(parseProfile({ badge }).success).toBe(false);
  });

  it('drops unknown fields so they can never reach the player record', () => {
    expect(cleaned({ id: 'p_evil', token: 't', role: 'spymaster', isHost: true })).toEqual(profile());
  });

  it.each([undefined, null, 'x', 1, [], {}])('refuses the payload %s', (payload) => {
    expect(schemas['profile:update'].safeParse(payload).success).toBe(false);
  });
});

describe('other payloads', () => {
  it('accepts a missing payload where the contract says {}', () => {
    for (const event of ['room:leave', 'seat:leave', 'game:start', 'turn:end', 'game:abort'] as const) {
      for (const payload of [undefined, null, {}, { extra: 1 }]) {
        expect(schemas[event].safeParse(payload).success).toBe(true);
      }
    }
  });

  it('checks the team and role of a seat', () => {
    expect(schemas['seat:take'].safeParse({ team: 'r', role: 'agent' }).success).toBe(true);
    expect(schemas['seat:take'].safeParse({ team: 'x', role: 'agent' }).success).toBe(false);
    expect(schemas['seat:take'].safeParse({ team: 'r', role: 'admin' }).success).toBe(false);
  });

  it('leaves the range of the timer to the rules, which have their own error code', () => {
    const ok = (timer: unknown) => schemas['settings:update'].safeParse({ settings: { timer } }).success;
    expect([0, 45, 14, -1, 60.5, 9999].every(ok)).toBe(true);
    expect(['45', null, true, [45]].some(ok)).toBe(false);
    expect(schemas['settings:update'].safeParse({ settings: {} }).success).toBe(true);
    expect(schemas['settings:update'].safeParse({}).success).toBe(false);
  });

  it('accepts English and Arabic boards only', () => {
    const ok = (lang: unknown) => schemas['settings:update'].safeParse({ settings: { lang } }).success;
    expect(['en', 'ar'].every(ok)).toBe(true);
    expect(['fr', 'AR', '', null, 1].some(ok)).toBe(false);
  });

  it('takes an optional swap on rematch', () => {
    const parse = (p: unknown) => schemas['game:rematch'].safeParse(p);
    expect(parse({ swap: true }).data).toEqual({ swap: true });
    expect(parse(undefined).data).toEqual({ swap: false });
    expect(parse({}).data).toEqual({ swap: false });
    expect(parse({ swap: 'yes' }).success).toBe(false);
  });

  it('only accepts card indexes 0 to 24', () => {
    const ok = (index: unknown) => schemas.guess.safeParse({ index }).success;
    expect([0, 24].every(ok)).toBe(true);
    expect([-1, 25, 1.5, '1', null, undefined, [3]].some(ok)).toBe(false);
  });

  it('leaves the range of a clue number to the rules, which have their own error code', () => {
    expect(schemas['clue:give'].safeParse({ word: 'x', number: 99 }).success).toBe(true);
    expect(schemas['clue:give'].safeParse({ word: 'x', number: '2' }).success).toBe(false);
    expect(schemas['clue:give'].safeParse({ word: 7, number: 2 }).success).toBe(false);
    expect(schemas['clue:give'].safeParse({ word: 'x'.repeat(500), number: 2 }).success).toBe(false);
  });

  it('checks join payloads, with an optional or null token', () => {
    const ok = (patch: object) =>
      schemas['room:join'].safeParse({ code: 'ABCDE', profile: profile(), ...patch }).success;
    expect(ok({})).toBe(true);
    expect(ok({ token: 't' })).toBe(true);
    expect(ok({ token: null })).toBe(true);
    expect(ok({ token: 5 })).toBe(false);
    expect(ok({ code: 5 })).toBe(false);
    expect(ok({ code: 'A'.repeat(100) })).toBe(false);
  });
});
