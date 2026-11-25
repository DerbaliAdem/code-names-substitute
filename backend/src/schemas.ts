/** Shape of every client payload. Unknown fields are dropped; game rules are checked elsewhere. */
import { z } from 'zod';

/** Control, private, unassigned and invisible formatting characters, except the joiners some scripts need. */
const UNSAFE_CHARS = /(?![‌‍])[\p{Cc}\p{Cf}\p{Co}\p{Cn}\p{Cs}]/gu;
const VISIBLE_CHAR = /[\p{L}\p{N}\p{P}\p{S}]/u;

const cleanText = (text: string) => text.replace(UNSAFE_CHARS, '').trim();

const name = z
  .string()
  .max(200)
  .transform(cleanText)
  .transform((text) => (VISIBLE_CHAR.test(text) ? text : 'Agent'))
  .refine((text) => text.length <= 14, 'A name can be at most 14 characters.');

const alias = z
  .string()
  .max(200)
  .transform(cleanText)
  .refine((text) => text.length <= 20, 'An alias can be at most 20 characters.');

const profile = z.object({
  name,
  alias,
  color: z.string().regex(/^#[0-9a-f]{6}$/i, 'That colour is not valid.'),
  badge: z
    .string()
    .max(4, 'That badge is not valid.')
    .refine((text) => VISIBLE_CHAR.test(text) && !/[\p{Cc}<>&"']/u.test(text), 'That badge is not valid.'),
});

const nothing = z
  .object({})
  .nullish()
  .transform(() => ({}));

export const schemas = {
  'room:create': z.object({ profile }),
  'room:join': z.object({
    code: z.string().max(32),
    profile,
    token: z
      .string()
      .max(64)
      .nullish()
      .transform((token) => token ?? undefined),
  }),
  'room:leave': nothing,
  'profile:update': z.object({ profile }),
  'seat:take': z.object({ team: z.enum(['r', 'b']), role: z.enum(['spymaster', 'agent']) }),
  'seat:leave': nothing,
  'settings:update': z.object({
    settings: z.object({
      timer: z.union([z.literal(0), z.literal(45), z.literal(90), z.literal(150)]).optional(),
    }),
  }),
  'game:start': nothing,
  'game:abort': nothing,
  'game:rematch': nothing,
  'clue:give': z.object({ word: z.string().max(200), number: z.number() }),
  guess: z.object({ index: z.number().int().min(0).max(24) }),
  'turn:end': nothing,
};

export type ClientEvent = keyof typeof schemas;
export type Payload<E extends ClientEvent> = z.output<(typeof schemas)[E]>;
