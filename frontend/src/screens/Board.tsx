import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, TextInput, View, useWindowDimensions } from 'react-native';
import { Body, Btn, Burst, Cap, H3, Note, Panel, Row, Tag } from '../components/ui';
import { request } from '../net';
import { MARK, TEAM, type Card, type RoomView } from '../protocol';
import { play } from '../sound';
import { go, me, now, playerName, useApp } from '../store';
import { FONT, INK, useTheme, type Palette } from '../theme';

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
  if (!t) return { bg: c.panel, fg: c.ink, stripe: null as string | null };
  if (revealed) return { bg: { r: c.red, b: c.blue, n: c.tan, x: INK }[t], fg: t === 'n' ? (c.tan === '#d9c79a' ? INK : c.ink) : t === 'x' ? '#ffd23c' : '#fff', stripe: null };
  // Spymaster key view (unrevealed)
  if (t === 'x') return { bg: INK, fg: '#ffd23c', stripe: null };
  if (t === 'n') return { bg: c.tan, fg: c.tan === '#d9c79a' ? INK : c.ink, stripe: null };
  return { bg: c.panel, fg: c.ink, stripe: t === 'r' ? c.red : c.blue };
}

function WordCard({ v, i, canGuess, size, onError }: { v: RoomView; i: number; canGuess: boolean; size: number; onError: (m: string) => void }) {
  const { c } = useTheme();
  const [busy, setBusy] = useState(false);
  const r = v.revealed[i];
  const t: Card | undefined = r ? r.type : v.key ? v.key[i] : undefined;
  const st = cardStyle(c, t, !!r);
  const disabled = !canGuess || !!r || busy;
  const word = v.words[i];

  async function guess() {
    setBusy(true);
    const res = await request<{ result: Card }>('guess', { index: i });
    setBusy(false);
    onError(res.ok ? '' : res.error.message);
  }

  return (
    <Pressable onPress={guess} disabled={disabled} accessibilityRole="button" accessibilityState={{ disabled }}
      accessibilityLabel={`${word}${t ? ', ' + CARD_NAME[t] : ''}${r ? ', revealed' : ''}`}
      style={{ width: '18.2%', aspectRatio: 1.05, marginBottom: '2%' }}>
      {({ pressed }) => (
        <View style={{ flex: 1 }}>
          {!r && <View style={{ position: 'absolute', left: 3, top: 3, right: -3, bottom: -3, backgroundColor: c.ink }} />}
          <View style={{ flex: 1, backgroundColor: st.bg, borderWidth: 3, borderColor: c.ink, alignItems: 'center', justifyContent: 'center', padding: 2, overflow: 'hidden', transform: r || pressed ? [{ translateX: 3 }, { translateY: 3 }] : undefined }}>
            {st.stripe && <View style={{ position: 'absolute', top: 0, left: 0, right: 0, height: 7, backgroundColor: st.stripe }} />}
            {t && <Text style={{ position: 'absolute', left: 3, top: st.stripe ? 8 : 1, fontSize: size * 0.8, color: st.stripe ?? st.fg }}>{MARK[t]}</Text>}
            <Text numberOfLines={2} adjustsFontSizeToFit style={{ fontFamily: r ? FONT.display : FONT.bold, fontSize: size, textTransform: 'uppercase', color: st.fg, textAlign: 'center', letterSpacing: 0.5 }}>{word}</Text>
          </View>
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
        <TextInput value={word} onChangeText={(t) => setWord(t.toUpperCase())} placeholder="CLUE" placeholderTextColor="#16130e66" maxLength={16} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Clue word" onSubmitEditing={send}
          style={{ fontFamily: FONT.display, fontSize: 38, letterSpacing: 2, textAlign: 'center', color: INK, borderBottomWidth: 3, borderBottomColor: INK }} />
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
      <View style={{ flexDirection: 'row', gap: 10 }}>
        {(['r', 'b'] as const).map((k) => (
          <View key={k} style={{ flexDirection: 'row', alignItems: 'baseline', gap: 6, backgroundColor: c.panel, borderWidth: 3, borderColor: c.ink, paddingHorizontal: 10 }}>
            <Cap>{TEAM[k].g} {TEAM[k].n.toUpperCase()}</Cap>
            <Text style={{ fontFamily: FONT.display, fontSize: 32, color: k === 'r' ? c.red : c.blue }}>{v ? v.remaining[k] : k === 'r' ? 9 : 8}</Text>
          </View>
        ))}
      </View>
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

  const can = perms(v), p = me(v), over = v.phase === 'over', cl = v.clue;
  const fontSize = Math.max(9, Math.min(18, (Math.min(width, 720) - 32) / 30));
  let role = 'Spectating. Join a team in the lobby before the next game.';
  if (p?.team) role = `You are the ${TEAM[p.team].n} ${p.role}. ` + (over ? '' :
    can.guess ? 'Tap a word to guess it.' : can.clue ? 'Send your clue below.' :
    p.team === v.turn ? (p.role === 'agent' ? 'Waiting for your spymaster.' : 'Your agents are guessing.') : 'The other team is playing.');

  return (
    <View style={{ gap: 16 }}>
      {header}
      <View accessibilityLiveRegion="polite" style={{ backgroundColor: c.panel, borderWidth: 3, borderColor: c.ink, borderLeftWidth: over ? 3 : 14, borderLeftColor: over ? c.ink : v.turn === 'r' ? c.red : c.blue, paddingVertical: 4, paddingHorizontal: 12 }}>
        <Text style={{ fontFamily: FONT.bold, fontSize: 18, textTransform: 'uppercase', letterSpacing: 1, color: c.ink }}>
          {over ? 'Game over' : `${TEAM[v.turn].g} ${TEAM[v.turn].n} team · ` + (cl ? `clue ${cl.word} ${cl.number} · ${cl.number === 0 ? 'no limit' : Math.max(0, cl.number + 1 - v.guessesThisTurn) + ' guesses left'}` : 'waiting for the spymaster')}
        </Text>
      </View>
      <TimerBar v={v} />
      <Cap>{role}</Cap>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between' }}>
        {v.words.map((_, i) => <WordCard key={i} v={v} i={i} canGuess={can.guess} size={fontSize} onError={setMsg} />)}
      </View>
      <Note text={msg} />
      {can.end && <Btn small variant="alt" label="End turn" onPress={async () => { const r = await request('turn:end'); setMsg(r.ok ? '' : r.error.message); }} />}
      {over && <Btn label="See the victory report" onPress={() => go('win')} />}
      {can.clue && <ClueForm v={v} />}
      <Panel>
        <Cap>Clues so far</Cap>
        {v.log.length ? v.log.map((e) => (
          <Row key={e.id} left={<Text style={{ fontFamily: FONT.display, fontSize: 22, letterSpacing: 1, color: c.ink }}><Text style={{ color: e.team === 'r' ? c.red : c.blue }}>{TEAM[e.team].g}</Text> {e.word} · {e.number}</Text>}
            right={<Tag>{playerName(e.by, v)} · {e.hits} hit{e.hits === 1 ? '' : 's'}</Tag>} />
        )) : <Cap>No clues yet</Cap>}
      </Panel>
    </View>
  );
}
