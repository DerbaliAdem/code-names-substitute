import { describe, expect, it } from 'vitest';
import { WORDS, WORDS_AR } from '../src/words.js';

describe('word list', () => {
  it('has at least 400 words', () => expect(WORDS.length).toBeGreaterThanOrEqual(400));
  it('has no duplicates', () => expect(WORDS.filter((w, i) => WORDS.indexOf(w) !== i)).toEqual([]));
  it('contains only single uppercase words that fit a card', () => {
    expect(WORDS.filter((w) => !/^[A-Z]{2,10}$/.test(w))).toEqual([]);
  });
});

describe('Arabic word list', () => {
  it('has at least 400 words', () => expect(WORDS_AR.length).toBeGreaterThanOrEqual(400));
  it('has no duplicates', () => expect(WORDS_AR.filter((w, i) => WORDS_AR.indexOf(w) !== i)).toEqual([]));
  it('contains only single Arabic words without diacritics or tatweel', () => {
    expect(WORDS_AR.filter((w) => !/^[ء-غف-ي]{2,9}$/u.test(w))).toEqual([]);
  });
});
