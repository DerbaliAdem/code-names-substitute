// Home = your agent card + start a game + join by code, all on one page.
import React, { useEffect, useRef, useState } from 'react';
import { Image, Pressable, Text, View } from 'react-native';
import { Avatar, Btn, Burst, Cap, Field, Note, Panel } from '../components/ui';
import { enterRoom, request } from '../net';
import { getState, go, setProfile, setState, useApp } from '../store';
import { ALIASES, BADGES, COLORS, FONT, useTheme } from '../theme';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

function AgentCard() {
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
  const sw = (on: boolean) => ({ width: 36, height: 36, borderWidth: on ? 4 : 3, borderColor: on ? c.hl : c.ink, alignItems: 'center' as const, justifyContent: 'center' as const });
  return (
    <Panel>
      <Cap>Your agent</Cap>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
        <Avatar name={name} color={p.color} badge={p.badge} />
        <View style={{ flex: 1, gap: 4 }}>
          <Field value={p.name} onChangeText={(t) => setProfile({ name: t })} maxLength={14} placeholder="Agent name" autoCorrect={false} accessibilityLabel="Agent name" />
          <Pressable accessibilityRole="button" accessibilityLabel={'Alias ' + p.alias + ', tap to change'} onPress={() => setProfile({ alias: ALIASES[(ALIASES.indexOf(p.alias) + 1) % ALIASES.length] })}>
            <Cap>{p.alias} ↻</Cap>
          </Pressable>
        </View>
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {COLORS.map((col) => (
          <Pressable key={col} accessibilityRole="radio" accessibilityLabel={'Colour ' + col} accessibilityState={{ checked: p.color === col }} onPress={() => setProfile({ color: col })} style={[sw(p.color === col), { backgroundColor: col }]} />
        ))}
      </View>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {BADGES.map((b) => (
          <Pressable key={b} accessibilityRole="radio" accessibilityLabel={'Badge ' + b} accessibilityState={{ checked: p.badge === b }} onPress={() => setProfile({ badge: b })} style={[sw(p.badge === b), { backgroundColor: c.panel }]}>
            <Text style={{ fontSize: 16, color: c.ink }}>{b}</Text>
          </Pressable>
        ))}
      </View>
    </Panel>
  );
}

export default function Home() {
  const { view, inviteCode, homeNote, session } = useApp();
  const { c } = useTheme();
  const [code, setCode] = useState(inviteCode);
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
    const k = clean(code);
    if (k.length !== 5) return say('Room codes have 5 letters.');
    run('room:join', { code: k, token: session?.code === k ? session.token : undefined });
  }

  return (
    <View style={{ gap: 18 }}>
      <Image source={require('../../assets/logo.png')} accessible={false} style={{ width: 110, height: 110, alignSelf: 'center', marginBottom: -30, zIndex: 1, transform: [{ rotate: '8deg' }] }} />
      <Burst title="CODENAMES!" sub="Two teams. One key. Zero room for error." />
      {view && (
        <Panel>
          <Cap>You are in room</Cap>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: 4, color: c.ink }}>{view.code}</Text>
            <Btn small label={view.phase === 'lobby' ? 'Back to the lobby' : 'Back to the game'} onPress={() => go(view.phase === 'lobby' ? 'lobby' : 'board')} />
          </View>
        </Panel>
      )}
      <View style={{ gap: 14, maxWidth: 480, width: '100%', alignSelf: 'center' }}>
        <AgentCard />
        <Btn label="Start a game" onPress={() => run('room:create', {})} disabled={busy} />
        <Panel>
          <Cap>Join with a room code</Cap>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Field value={code} onChangeText={(t) => setCode(clean(t))} placeholder="KAPOW" autoCapitalize="characters" autoCorrect={false} maxLength={5} accessibilityLabel="Room code" onSubmitEditing={join} style={{ flex: 1, letterSpacing: 4 }} />
            <Btn small label="Join" onPress={join} disabled={busy} />
          </View>
        </Panel>
        <Note text={homeNote} />
      </View>
    </View>
  );
}
