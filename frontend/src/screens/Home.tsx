import React, { useState } from 'react';
import { Image, Text, View } from 'react-native';
import { Btn, Burst, Cap, Field, Note, Panel } from '../components/ui';
import { enterRoom } from '../net';
import { go, setState, useApp } from '../store';
import { FONT, useTheme } from '../theme';

const clean = (s: string) => s.toUpperCase().replace(/[^A-Z]/g, '').slice(0, 5);

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
    go('profile');
  }

  function join() {
    const k = clean(code);
    if (k.length !== 5) return say('Room codes have 5 letters.');
    run('room:join', { code: k, token: session?.code === k ? session.token : undefined });
  }

  return (
    <View style={{ gap: 18 }}>
      <Image source={require('../../assets/logo.png')} accessibilityIgnoresInvertColors accessible={false} style={{ width: 120, height: 120, alignSelf: 'center', marginBottom: -34, zIndex: 1, transform: [{ rotate: '8deg' }] }} />
      <Burst title="CODENAMES!" sub="Two teams. One key. Zero room for error." />
      <View style={{ gap: 14, maxWidth: 420, width: '100%', alignSelf: 'center' }}>
        <Btn label="Start a game" onPress={() => run('room:create', {})} disabled={busy} />
        <Panel>
          <Cap>Join with a room code</Cap>
          <View style={{ flexDirection: 'row', gap: 8, alignItems: 'center' }}>
            <Field value={code} onChangeText={(t) => setCode(clean(t))} placeholder="KAPOW" autoCapitalize="characters" autoCorrect={false} maxLength={5} accessibilityLabel="Room code" onSubmitEditing={join} style={{ flex: 1, letterSpacing: 4 }} />
            <Btn small label="Join" onPress={join} disabled={busy} />
          </View>
        </Panel>
        <Btn variant="alt" label="How to play" onPress={() => go('rules')} />
        <Note text={homeNote} />
      </View>
      {view && (
        <Panel>
          <Cap>You are in room</Cap>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 12, flexWrap: 'wrap' }}>
            <Text style={{ fontFamily: FONT.display, fontSize: 30, letterSpacing: 4, color: c.ink }}>{view.code}</Text>
            <Btn small label="Back to the lobby" onPress={() => go('lobby')} />
          </View>
        </Panel>
      )}
    </View>
  );
}
