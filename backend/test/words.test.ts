import { describe, expect, it } from 'vitest';
import { WORDS } from '../src/words.js';

describe('word list', () => {
  it('has at least 400 words', () => expect(WORDS.length).toBeGreaterThanOrEqual(400));
  it('has no duplicates', () => expect(WORDS.filter((w, i) => WORDS.indexOf(w) !== i)).toEqual([]));
  it('contains only single uppercase words that fit a card', () => {
    expect(WORDS.filter((w) => !/^[A-Z]{2,10}$/.test(w))).toEqual([]);
  });
});
