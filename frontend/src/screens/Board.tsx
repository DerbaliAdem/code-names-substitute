import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing, Platform, Pressable, TextInput, View, useWindowDimensions } from 'react-native';
import { scrollInputIntoView } from '../keyboardScroll';
import { ND, useReducedMotion } from '../motion';
import { Body, Btn, Burst, Cap, H3, Note, Panel, Row, Tag } from '../components/ui';
import { leaveRoom, request } from '../net';
import VictoryReport from '../components/VictoryReport';
import { MARK, TEAM, type Card, type RoomView } from '../protocol';
import { play } from '../sound';
import { go, me, now, playerName, useApp } from '../store';
import { FONT, INK, useTheme, type Palette } from '../theme';
import { Text } from '../components/Text';

/** What the UI lets this player do. The server re-checks everything. */
export function perms(v: RoomView | null) {
  if (!v || v.phase !== 'play') return { guess: false, end: false, clue: false };
  const p = me(v), mine = !!p && p.team === v.turn;
  return {
    guess: mine && p!.role === 'agent' && !!v.clue,
    end: mine && p!.role === 'agent' && v.guessesThisTurn >= 1,
    clue: mine && p!.role === 'spymaster' && !v.clue,
  };
}

const CARD_NAME: Record<Card, string> = { r: 'red', b: 'blue', n: 'neutral', x: 'assassin' };

function cardStyle(c: Palette, t: Card | undefined, revealed: boolean) {
  const plain = { stripe: null as string | null, hatch: null as string | null, border: c.ink };
  if (!t) return { ...plain, bg: c.panel, fg: c.ink };
  if (revealed) return { ...plain, bg: { r: c.red, b: c.blue, n: '#fbf6e6', x: INK }[t], fg: t === 'n' ? INK : t === 'x' ? '#ffd23c' : '#fff' };
  // Spymaster key view (unrevealed): the whole card is hatched in its team colour, with a matching border.
  if (t === 'x') return { ...plain, bg: INK, fg: '#ffd23c', border: '#ffd23c' };
  if (t === 'n') return { ...plain, bg: c.panel, fg: c.ink, border: c.tan };
  const col = t === 'r' ? c.red : c.blue;
  return { ...plain, bg: c.panel, fg: c.ink, hatch: col, border: col };
}

const POP: Record<string, { word: string; color: (c: Palette) => string }> = {
  own: { word: 'BAM!', color: (c) => c.hl },
  wrong: { word: 'OOPS!', color: (c) => c.panel },
  n: { word: 'MEH', color: (c) => c.panel },
  x: { word: 'BOOM!', color: (c) => c.red },
};

/** One board card. When it gets revealed it flips over, bounces, and a comic word pops out of it. */
function WordCard({ v, i, canGuess, size, inner, onError }: { v: RoomView; i: number; canGuess: boolean; size: number; inner: number; onError: (m: string) => void }) {
  const { c } = useTheme();
  const reduced = useReducedMotion();
  const [busy, setBusy] = useState(false);
  const r = v.revealed[i];
  const [shown, setShown] = useState(!!r);        // revealed look on screen (switches at the middle of the flip)
  const flip = useRef(new Animated.Value(1)).current;
  const pop = useRef(new Animated.Value(0)).current;
  const shake = useRef(new Animated.Value(0)).current;
  // The comic stamp exists only while it animates, so an interrupted animation can never leave it over the word.
  const [popping, setPopping] = useState(false);
  useEffect(() => { if (!popping) return; const t = setTimeout(() => setPopping(false), 1400); return () => clearTimeout(t); }, [popping]);

  useEffect(() => {
    if (!r) { if (shown) setShown(false); return; }   // rematch: new board
    if (shown) return;
    if (reduced) { setShown(true); return; }
    Animated.timing(flip, { toValue: 0, duration: 140, easing: Easing.in(Easing.quad), useNativeDriver: ND }).start(() => {
      setShown(true);
      setPopping(true);
      const kick = (x: number) => Animated.timing(shake, { toValue: x, duration: 45, useNativeDriver: ND });
      Animated.parallel([
        Animated.spring(flip, { toValue: 1, friction: 4, tension: 170, useNativeDriver: ND }),
        Animated.sequence([
          Animated.timing(pop, { toValue: 1, duration: 240, easing: Easing.out(Easing.back(2.5)), useNativeDriver: ND }),
          Animated.delay(450),
          Animated.timing(pop, { toValue: 2, duration: 260, useNativeDriver: ND }),
        ]),
        r.type === 'x' ? Animated.sequence([kick(-6), kick(6), kick(-5), kick(5), kick(-3), kick(0)]) : Animated.delay(0),
      ]).start(() => { pop.setValue(0); setPopping(false); });
    });
    // Safety net: whatever interrupts the animation (a busy frame, a hidden tab), the card always ends fully flipped.
    const safety = setTimeout(() => {
      flip.stopAnimation(); shake.stopAnimation(); pop.stopAnimation();
      flip.setValue(1); shake.setValue(0); pop.setValue(0);
      setShown(true); setPopping(false);
    }, 2000);
    return () => clearTimeout(safety);
  }, [!!r]); // eslint-disable-line react-hooks/exhaustive-deps

  const t: Card | undefined = r && shown ? r.type : v.key ? v.key[i] : undefined;
  const st = cardStyle(c, t, !!r && shown);
  const disabled = !canGuess || !!r || busy;
  const word = v.words[i];
  const rtl = /[\u0590-\u08FF]/.test(word);   // Arabic (or Hebrew) word: right-to-left, no upper case
  // Biggest size that keeps the whole word on one line inside the card (condensed bold ≈ 0.55em per letter).
  const fit = Math.max(10, Math.min(size, inner / (word.length * (rtl ? 0.6 : 0.55) + 0.3)));
  const popKind = r ? (r.type === 'x' ? 'x' : r.type === 'n' ? 'n' : r.type === r.team ? 'own' : 'wrong') : 'n';

  async function guess() {
    setBusy(true);
    const res = await request<{ result: Card }>('guess', { index: i });
    setBusy(false);
    onError(res.ok ? '' : res.error.message);
  }

  return (
    <Pressable onPress={guess} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      accessibilityLabel={`${word}${t ? ', ' + CARD_NAME[t] : ''}${r ? ', revealed' : ''}`}
      style={{ width: '18.2%', aspectRatio: 1.05, marginBottom: '2%', zIndex: r && !shown ? 2 : undefined }}>
      {({ pressed }) => (
        <View style={{ flex: 1 }}>
          {!(r && shown) && <View style={{ position: 'absolute', left: 3, top: 3, right: -3, bottom: -3, backgroundColor: c.ink }} />}
          <Animated.View style={{ flex: 1, transform: [{ translateX: shake }, { scaleX: flip }] }}>
            <View style={{ flex: 1, backgroundColor: st.bg, borderWidth: 3, borderColor: st.border, alignItems: 'center', justifyContent: 'center', padding: 2, overflow: 'hidden', transform: (r && shown) || pressed || busy ? [{ translateX: 3 }, { translateY: 3 }] : undefined }}>
              {st.hatch && (
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0, opacity: 0.38 }}>
                  {[-60, -35, -10, 15, 40, 65, 90, 115].map((x) => (
                    <View key={x} style={{ position: 'absolute', top: -20, bottom: -20, left: `${x}%`, width: 6, backgroundColor: st.hatch!, transform: [{ rotate: '-35deg' }] }} />
                  ))}
                </View>
              )}
              {r && shown && r.type === 'n' && (
                // A picked white card stays remarkable: hatched paper.
                <View pointerEvents="none" style={{ position: 'absolute', left: 0, top: 0, right: 0, bottom: 0 }}>
                  {[-60, -30, 0, 30, 60, 90, 120].map((x) => (
                    <View key={x} style={{ position: 'absolute', top: -20, bottom: -20, left: `${x}%`, width: 5, backgroundColor: '#16130e1f', transform: [{ rotate: '35deg' }] }} />
                  ))}
                </View>
              )}
              {t && <Text style={{ position: 'absolute', left: 3, top: st.stripe ? 8 : 1, fontSize: size * 0.8, color: st.hatch ?? st.fg }}>{MARK[t]}</Text>}
              <Text numberOfLines={1} style={{ fontFamily: r && shown ? FONT.display : FONT.bold, fontSize: fit, lineHeight: Math.round(fit * 1.15), textTransform: rtl ? 'none' : 'uppercase', writingDirection: rtl ? 'rtl' : 'ltr', color: st.fg, textAlign: 'center', letterSpacing: rtl ? 0 : 0.5 }}>{word}</Text>
            </View>
          </Animated.View>
          {r && popping && (
            <Animated.View pointerEvents="none" style={{ position: 'absolute', left: -12, right: -12, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center',
              opacity: pop.interpolate({ inputRange: [0, 0.3, 1, 2], outputRange: [0, 1, 1, 0] }),
              transform: [{ scale: pop.interpolate({ inputRange: [0, 1, 2], outputRange: [0.2, 1, 1.35] }) }, { rotate: '-8deg' }] }}>
              <Text style={{ fontFamily: FONT.display, fontSize: size * 1.7, color: POP[popKind].color(c), letterSpacing: 1,
                textShadowColor: INK, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>{POP[popKind].word}</Text>
            </Animated.View>
          )}
        </View>
      )}
    </Pressable>
  );
}

function TimerBar({ v }: { v: RoomView }) {
  const { c } = useTheme();
  const [, setT] = useState(0);
  const lastTick = useRef(-1);
  useEffect(() => { const id = setInterval(() => setT((x) => x + 1), 250); return () => clearInterval(id); }, []);
  if (v.phase !== 'play' || !v.turnEndsAt || !v.settings.timer) return null;
  const left = v.turnEndsAt - now(), f = Math.max(0, Math.min(1, left / (v.settings.timer * 1000))), s = Math.max(0, Math.ceil(left / 1000));
  if (left > 0 && left <= 10000 && s !== lastTick.current) { lastTick.current = s; play('tick'); }
  return (
    <View accessibilityLabel={`${s} seconds left`} style={{ height: 24, borderWidth: 3, borderColor: c.ink, backgroundColor: c.panel, justifyContent: 'center' }}>
      <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${f * 100}%`, backgroundColor: left <= 10000 ? c.red : c.hl }} />
      <Text style={{ fontFamily: FONT.display, fontSize: 15, letterSpacing: 1.5, color: INK, textAlign: 'center' }}>{TEAM[v.turn].g} {s}s</Text>
    </View>
  );
}

function ClueForm({ v }: { v: RoomView }) {
  const { c } = useTheme();
  const [word, setWord] = useState('');
  const [n, setN] = useState(2);
  const [msg, setMsg] = useState('');
  async function send() {
    const w = word.trim().toUpperCase();
    if (!w) return setMsg('Type a one-word clue.');
    if (/\s/.test(w)) return setMsg('One word only.');
    setMsg('Sending…');
    const res = await request('clue:give', { word: w, number: n });
    if (!res.ok) return setMsg(res.error.message);
    setMsg(''); setWord('');
  }
  const step = (d: number) => setN((x) => Math.max(0, Math.min(9, x + d)));
  const numBtn = (label: string, d: number, a11y: string) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={() => step(d)} style={{ width: 44, height: 44, borderWidth: 3, borderColor: c.ink, backgroundColor: c.panel, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONT.display, fontSize: 28, color: c.ink }}>{label}</Text>
    </Pressable>
  );
  return (
    <Panel>
      <Cap>Your clue</Cap>
      <View style={{ backgroundColor: '#fff', borderWidth: 3, borderColor: INK, borderRadius: 60, paddingVertical: 10, paddingHorizontal: 24 }}>
        <TextInput value={word} onChangeText={(t) => { setWord(t.toUpperCase().replace(/\s+/g, '')); if (msg) setMsg(''); }} onFocus={scrollInputIntoView} placeholder="ONE WORD" placeholderTextColor="#16130e55"
          maxLength={16} autoCapitalize="characters" autoCorrect={false} spellCheck={false} autoComplete="off" returnKeyType="send" accessibilityLabel="Clue word" onSubmitEditing={send}
          style={[{ fontFamily: FONT.display, fontSize: word.length > 10 ? 30 : 38, letterSpacing: 2, textAlign: 'center', color: INK, paddingVertical: 0 }, Platform.OS === 'web' ? ({ outlineStyle: 'none' } as object) : null]} />
        <Text style={{ position: 'absolute', right: 16, bottom: 4, fontFamily: FONT.bold, fontSize: 11, letterSpacing: 1, color: '#16130e88' }}>{word.length}/16</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 14 }}>
        {numBtn('−', -1, 'Fewer')}
        <Text style={{ fontFamily: FONT.display, fontSize: 48, minWidth: 50, textAlign: 'center', color: c.ink }}>{n || '∞'}</Text>
        {numBtn('+', 1, 'More')}
      </View>
      <Cap style={{ textAlign: 'center' }}>0 means no limit on guesses</Cap>
      <Btn variant={v.turn} label="Send clue" onPress={send} />
      <Note text={msg} />
    </Panel>
  );
}

export default function Board() {
  const { view: v } = useApp();
  const { c } = useTheme();
  const { width } = useWindowDimensions();
  const [msg, setMsg] = useState('');

  const live = v && v.phase !== 'lobby';
  const header = (
    <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', flexWrap: 'wrap', gap: 12 }}>
      <Burst small title="THE BOARD" />
    </View>
  );
  if (!live || !v) {
    return (
      <View style={{ gap: 16 }}>
        {header}
        <Panel><H3>No game running</H3><Body>Start a game from Home, join a team in the lobby, then begin the mission.</Body><Btn label="Go home" onPress={() => go('home')} /></Panel>
      </View>
    );
  }

  const can = perms(v), p = me(v), over = v.phase === 'over';
  const boardW = Math.min(width, 720) - 32;
  const fontSize = Math.max(13, Math.min(27, boardW / 24));
  const cardInner = boardW * 0.182 - 12;   // card width minus borders and padding
  const waiting = !over && !!p?.team && p.team !== v.turn;   // the other team is playing
  let role = 'Spectating. Join a team in the lobby before the next game.';
  if (p?.team) role = `You are the ${TEAM[p.team].n} ${p.role}. ` + (over ? '' :
    can.guess ? 'Tap a word to guess it.' : can.clue ? 'Send your clue below.' :
    p.team === v.turn ? (p.role === 'agent' ? 'Waiting for your spymaster.' : 'Your agents are guessing.') : 'The other team is playing.');

  return (
    <View style={{ gap: 16 }}>
      {over && <VictoryReport v={v} />}
      {header}
      <Scoreboard v={v} />
      <TimerBar v={v} />
      <Cap>{role}</Cap>
      {waiting && <Meanwhile v={v} />}
      <View style={{ opacity: waiting ? 0.6 : 1 }}>
        <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
          {v.words.map((_, i) => <WordCard key={i} v={v} i={i} canGuess={can.guess} size={fontSize} inner={cardInner} onError={setMsg} />)}
        </View>
      </View>
      {!!v.key && !over && <KeyLegend />}
      <Note text={msg} />
      {can.clue && <ClueForm v={v} />}
      <Panel>
        <Cap>Clues so far</Cap>
        {v.log.length ? v.log.map((e) => (
          <Row key={e.id} left={<Text style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: 1, color: c.ink }}><Text style={{ color: e.team === 'r' ? c.red : c.blue }}>{TEAM[e.team].g}</Text> {e.word} · {e.number}</Text>}
            right={<Tag>{playerName(e.by, v)} · {e.hits} hit{e.hits === 1 ? '' : 's'}</Tag>} />
        )) : <Cap>No clues yet</Cap>}
      </Panel>
      <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
        <Btn small variant="alt" label="Lobby" onPress={() => go('lobby')} />
        <Btn small variant="alt" label="Leave the room" onPress={leaveRoom} />
      </View>
    </View>
  );
}

/** Idea 1: one pip per agent card, filled as the team finds them, and a tilted flag for whose turn it is. */
function Scoreboard({ v }: { v: RoomView }) {
  const { c } = useTheme();
  const over = v.phase === 'over';
  const side = (k: 'r' | 'b') => {
    const total = v.first === k ? 9 : 8, found = total - v.remaining[k], col = k === 'r' ? c.red : c.blue;
    return (
      <View accessibilityLabel={`${TEAM[k].n}: ${found} of ${total} agents found`} style={{ flexDirection: k === 'r' ? 'row' : 'row-reverse', alignItems: 'center', gap: 6, flexShrink: 1 }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: 1, color: col }}>{k === 'r' ? `${TEAM.r.g} RED` : `BLUE ${TEAM.b.g}`}</Text>
        <View style={{ flexDirection: k === 'r' ? 'row' : 'row-reverse', flexWrap: 'wrap', gap: 3, flexShrink: 1 }}>
          {Array.from({ length: total }, (_, i) => (
            <View key={i} style={{ width: 11, height: 18, borderWidth: 2, borderColor: c.ink, backgroundColor: i < found ? col : 'transparent', transform: [{ skewX: '-10deg' }] }} />
          ))}
        </View>
      </View>
    );
  };
  const col = v.turn === 'r' ? c.red : c.blue;
  return (
    <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: 8, flexWrap: 'wrap' }}>
      {side('r')}
      <View accessibilityLiveRegion="polite" style={{ backgroundColor: over ? c.ink : col, borderWidth: 3, borderColor: INK, paddingHorizontal: 12, paddingVertical: 1, transform: [{ rotate: v.turn === 'r' ? '-3deg' : '3deg' }] }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 20, letterSpacing: 1, color: '#fff' }}>{over ? 'GAME OVER' : `${TEAM[v.turn].n.toUpperCase()}'S TURN`}</Text>
      </View>
      {side('b')}
    </View>
  );
}

/** Idea 3: legend under the spymaster's key view. */
function KeyLegend() {
  const { c } = useTheme();
  const item = (label: string, bg: string, border: string) => (
    <View key={label} style={{ flexDirection: 'row', alignItems: 'center', gap: 5 }}>
      <View style={{ width: 14, height: 14, backgroundColor: bg, borderWidth: 2, borderColor: border }} />
      <Cap>{label}</Cap>
    </View>
  );
  return (
    <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 14 }}>
      {item('Red', c.red, c.red)}{item('Blue', c.blue, c.blue)}{item('Bystander', 'transparent', c.tan)}{item('Assassin', INK, '#ffd23c')}
    </View>
  );
}

/** Idea 4: comic caption while the other team plays. */
function Meanwhile({ v }: { v: RoomView }) {
  const t = TEAM[v.turn];
  const spy = v.players.find((p) => p.team === v.turn && p.role === 'spymaster');
  const left = v.clue ? (v.clue.number === 0 ? 'no limit' : `${Math.max(0, v.clue.number + 1 - v.guessesThisTurn)} guesses left`) : '';
  const what = v.clue ? `Guessing "${v.clue.word}" · ${left}` : `${spy?.name || 'Their spymaster'} is thinking`;
  return (
    <View accessibilityLiveRegion="polite" style={{ flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 12 }}>
      <View style={{ backgroundColor: '#ffd23c', borderWidth: 3, borderColor: INK, paddingHorizontal: 12, paddingVertical: 2, transform: [{ rotate: '-1.5deg' }] }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 20, letterSpacing: 1, color: INK }}>MEANWHILE, AT {t.n.toUpperCase()} HQ…</Text>
      </View>
      <View style={{ backgroundColor: '#fff', borderWidth: 3, borderColor: INK, borderRadius: 30, paddingHorizontal: 14, paddingVertical: 3, flexShrink: 1 }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 18, letterSpacing: 1, color: INK }}>{what}{v.clue ? '' : '…'}</Text>
      </View>
    </View>
  );
}

/** Idea 2: the clue dock, pinned under the scrolling page (rendered by App while the board is shown). */
export function BoardDock({ bottom }: { bottom: number }) {
  const { view: v } = useApp();
  const { c } = useTheme();
  const [msg, setMsg] = useState('');
  if (!v || v.phase !== 'play') return null;
  const can = perms(v), cl = v.clue, col = v.turn === 'r' ? c.red : c.blue;
  const total = cl ? cl.number + 1 : 0, used = v.guessesThisTurn;
  return (
    <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.panel, borderTopWidth: 4, borderTopColor: col, paddingTop: 8, paddingBottom: 8 + bottom, paddingHorizontal: 16 }}>
      <View style={{ width: '100%', maxWidth: 720, alignSelf: 'center', flexDirection: 'row', alignItems: 'center', gap: 10, flexWrap: 'wrap' }}>
        {cl ? (
          <>
            <Cap>{TEAM[cl.team].g} Clue</Cap>
            <Text style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: 2, color: c.ink, flexShrink: 1 }} numberOfLines={1}>{cl.word}</Text>
            <View style={{ backgroundColor: col, borderWidth: 3, borderColor: INK, paddingHorizontal: 8 }}>
              <Text style={{ fontFamily: FONT.display, fontSize: 22, color: '#fff' }}>{cl.number === 0 ? '∞' : cl.number}</Text>
            </View>
            <View style={{ flexDirection: 'row', gap: 4, marginLeft: 'auto' }} accessibilityLabel={cl.number === 0 ? 'No limit on guesses' : `${Math.max(0, total - used)} of ${total} guesses left`}>
              {cl.number === 0 ? <Cap>No limit</Cap> : Array.from({ length: total }, (_, i) => (
                <View key={i} style={{ width: 16, height: 16, borderRadius: 8, borderWidth: 3, borderColor: c.ink, backgroundColor: i < used ? c.ink : 'transparent' }} />
              ))}
            </View>
            {can.end && (
              <Pressable accessibilityRole="button" onPress={async () => { const r = await request('turn:end'); setMsg(r.ok ? '' : r.error.message); }}
                style={{ backgroundColor: '#ffd23c', borderWidth: 3, borderColor: INK, paddingHorizontal: 10, paddingVertical: 2 }}>
                <Text style={{ fontFamily: FONT.display, fontSize: 18, letterSpacing: 1, color: INK }}>END TURN</Text>
              </Pressable>
            )}
          </>
        ) : (
          <Text style={{ fontFamily: FONT.display, fontSize: 20, letterSpacing: 1, color: c.ink }}>
            {can.clue ? 'YOUR MOVE: SEND A CLUE BELOW ↓' : `${TEAM[v.turn].g} WAITING FOR THE ${TEAM[v.turn].n.toUpperCase()} SPYMASTER…`}
          </Text>
        )}
      </View>
      {!!msg && <Cap style={{ textAlign: 'center' }}>{msg}</Cap>}
    </View>
  );
}
