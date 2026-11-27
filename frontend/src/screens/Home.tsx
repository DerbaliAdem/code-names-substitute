// Home = "agent dossier": your agent file card, one big start button, room code in 5 letter boxes.
import React, { useEffect, useRef, useState } from 'react';
import { Pressable, TextInput, View } from 'react-native';
import { Btn, Cap, Inked, Note, Panel } from '../components/ui';
import { Hero, heroFor } from '../components/Hero';
import { scrollInputIntoView } from '../keyboardScroll';
import { enterRoom, request } from '../net';
import { getState, go, setProfile, setState, useApp } from '../store';
import { ALIASES, BADGES, COLORS, FONT, INK, useTheme } from '../theme';
import { Text } from '../components/Text';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

function Dossier() {
  const { profile: p } = useApp();
  const { c } = useTheme();
  const first = useRef(true);
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {   // live-update the room when the profile changes (debounced)
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (getState().view) request('profile:update', { profile: getState().profile }); }, 400);
  }, [p]);
  const name = p.name.trim() || 'Agent';
  const sw = (on: boolean) => ({ width: 32, height: 32, borderWidth: on ? 4 : 3, borderColor: on ? c.hl : c.ink, alignItems: 'center' as const, justifyContent: 'center' as const });

  return (
    <View style={{ marginTop: 22 }}>
      <View style={{ position: 'absolute', top: -24, left: 0, backgroundColor: c.tan, borderWidth: 3, borderBottomWidth: 0, borderColor: c.ink, paddingHorizontal: 14, paddingVertical: 2 }}>
        <Text style={{ fontFamily: FONT.bold, fontSize: 13, letterSpacing: 2, color: c.tan === '#d9c79a' ? INK : c.ink }}>TOP SECRET · AGENT FILE</Text>
      </View>
      <Panel>
        <View style={{ flexDirection: 'row', gap: 16, alignItems: 'center' }}>
          <Inked offset={3} rotate="-3deg" style={{ width: 96, height: 96, borderWidth: 3, borderColor: INK }}>
            <Hero badge={p.badge} color={p.color} size={90} />
          </Inked>
          <View style={{ flex: 1, gap: 4 }}>
            <Cap>Code name</Cap>
            <TextInput value={p.name} onChangeText={(t) => setProfile({ name: t })} onFocus={scrollInputIntoView} maxLength={14} placeholder="AGENT" placeholderTextColor={c.ink + '66'} autoCorrect={false} spellCheck={false} accessibilityLabel="Code name"
              style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: 1, color: c.ink, borderBottomWidth: 3, borderStyle: 'dashed', borderBottomColor: c.ink, paddingVertical: 0, textTransform: 'uppercase' }} />
            <Pressable accessibilityRole="button" accessibilityLabel={`Alias ${p.alias}, tap to change`} onPress={() => setProfile({ alias: ALIASES[(ALIASES.indexOf(p.alias) + 1) % ALIASES.length] })}>
              <Text style={{ fontFamily: FONT.bold, fontSize: 15, letterSpacing: 1, color: c.ink }}>ALIAS: {p.alias.toUpperCase()} ↻</Text>
            </Pressable>
          </View>
        </View>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
          {COLORS.map((col) => (
            <Pressable key={col} accessibilityRole="radio" accessibilityLabel={'Colour ' + col} accessibilityState={{ checked: p.color === col }} onPress={() => setProfile({ color: col })} style={[sw(p.color === col), { backgroundColor: col }]} />
          ))}
        </View>
        <Cap>Your gear: {heroFor(p.badge).name}</Cap>
        <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
          {BADGES.map((b) => {
            const on = p.badge === b;
            return (
              <Pressable key={b} accessibilityRole="radio" accessibilityLabel={heroFor(b).name} accessibilityState={{ checked: on }} onPress={() => setProfile({ badge: b })}
                style={{ borderWidth: on ? 4 : 2, borderColor: on ? c.red : INK, transform: on ? [{ rotate: '-4deg' }, { scale: 1.08 }] : undefined }}>
                <Hero badge={b} color={p.color} size={on ? 40 : 44} />
              </Pressable>
            );
          })}
        </View>
      </Panel>
    </View>
  );
}

/** Five letter boxes over one invisible input, so typing, pasting and the phone keyboard all just work. */
function CodeBoxes({ value, onChange, onSubmit }: { value: string; onChange: (v: string) => void; onSubmit: () => void }) {
  const { c } = useTheme();
  const [focus, setFocus] = useState(false);
  return (
    <View>
      <View style={{ flexDirection: 'row', gap: 8 }}>
        {[0, 1, 2, 3, 4].map((i) => {
          const active = focus && i === Math.min(value.length, 4);
          return (
            <View key={i} style={{ flex: 1, height: 56, borderWidth: 3, borderColor: active ? c.red : INK, backgroundColor: active ? '#ffd23c' : '#fff', alignItems: 'center', justifyContent: 'center' }}>
              <Text style={{ fontFamily: FONT.display, fontSize: 34, color: INK }}>{value[i] ?? ''}</Text>
            </View>
          );
        })}
      </View>
      <TextInput value={value} onChangeText={(t) => onChange(clean(t))} onFocus={(e) => { setFocus(true); scrollInputIntoView(e); }} onBlur={() => setFocus(false)} onSubmitEditing={onSubmit}
        maxLength={5} autoCapitalize="characters" autoCorrect={false} accessibilityLabel="Room code, 5 letters" caretHidden
        style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, opacity: 0.01, color: 'transparent', fontSize: 1 }} />
    </View>
  );
}

export default function Home() {
  const { view, inviteCode, homeNote, session } = useApp();
  const { c } = useTheme();
  const [code, setCode] = useState(inviteCode);
  useEffect(() => { if (inviteCode) setCode(inviteCode); }, [inviteCode]);   // the invite link is read after Home is on screen
  const [busy, setBusy] = useState(false);
  const say = (t: string) => setState({ homeNote: t });

  async function run(event: 'room:create' | 'room:join', payload: object) {
    setBusy(true);
    say(event === 'room:create' ? 'Opening a room…' : 'Joining…');
    const res = await enterRoom(event, payload);
    setBusy(false);
    if (!res.ok) return say(res.error.message);
    say('');
    go('lobby');
  }
  function join() {
    if (code.length !== 5) return say('Room codes have 5 letters.');
    run('room:join', { code, token: session?.code === code ? session.token : undefined });
  }

  return (
    <View style={{ gap: 20, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
      <Text accessibilityRole="header" style={{ fontFamily: FONT.display, fontSize: 44, letterSpacing: 1, color: c.ink, textShadowColor: c.red, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0, marginTop: -6 }}>CODENAMES!</Text>

      {view && (
        <Panel>
          <Cap>You are in room</Cap>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: 4, color: c.ink }}>{view.code}</Text>
            <Btn small label={view.phase === 'lobby' ? 'Back to the lobby' : 'Back to the game'} onPress={() => go(view.phase === 'lobby' ? 'lobby' : 'board')} />
          </View>
        </Panel>
      )}

      <Dossier />

      <Pressable accessibilityRole="button" disabled={busy} onPress={() => run('room:create', {})} style={{ transform: [{ rotate: '-1.5deg' }], opacity: busy ? 0.6 : 1 }}>
        {({ pressed }) => (
          <View style={{ marginRight: 6, marginBottom: 6 }}>
            {!pressed && <View style={{ position: 'absolute', left: 6, top: 6, right: -6, bottom: -6, backgroundColor: c.ink }} />}
            <View style={{ backgroundColor: c.red, borderWidth: 4, borderColor: INK, paddingVertical: 14, alignItems: 'center', transform: pressed ? [{ translateX: 6 }, { translateY: 6 }] : undefined }}>
              <Text style={{ fontFamily: FONT.display, fontSize: 34, letterSpacing: 2, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>START A MISSION</Text>
            </View>
          </View>
        )}
      </Pressable>

      <Panel>
        <Cap>Got a room code?</Cap>
        <CodeBoxes value={code} onChange={setCode} onSubmit={join} />
        <Btn label="Join the room" onPress={join} disabled={busy || code.length !== 5} />
      </Panel>
      <Note text={homeNote} />
    </View>
  );
}
