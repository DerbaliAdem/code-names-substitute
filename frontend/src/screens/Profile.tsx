import React, { useEffect, useRef, useState } from 'react';
import { Pressable, Text, View } from 'react-native';
import { Avatar, Btn, Burst, Cap, Field, Note, Panel } from '../components/ui';
import { enterRoom, request } from '../net';
import { getState, go, setProfile, useApp } from '../store';
import { ALIASES, BADGES, COLORS, FONT, useTheme } from '../theme';

export default function Profile() {
  const { profile: p, view } = useApp();
  const { c } = useTheme();
  const [err, setErr] = useState('');
  const timer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const first = useRef(true);

  // Push profile changes to the room, debounced.
  useEffect(() => {
    if (first.current) { first.current = false; return; }
    if (timer.current) clearTimeout(timer.current);
    timer.current = setTimeout(() => { if (getState().view) request('profile:update', { profile: getState().profile }); }, 400);
  }, [p]);

  async function enter() {
    if (view) { await request('profile:update', { profile: p }); go('lobby'); return; }
    const res = await enterRoom('room:create');
    if (res.ok) go('lobby'); else setErr(res.error.message);
  }

  const name = p.name.trim() || 'Agent';
  const swatch = (selected: boolean) => ({ width: 40, height: 40, borderWidth: 3, borderColor: c.ink, alignItems: 'center' as const, justifyContent: 'center' as const, outlineWidth: 0, ...(selected ? { borderColor: c.hl, borderWidth: 4 } : null) });

  return (
    <View style={{ gap: 18 }}>
      <Burst title="YOUR FILE" sub="Build your agent before you enter" />
      <View style={{ maxWidth: 480, width: '100%', alignSelf: 'center', gap: 18 }}>
        <Panel>
          <Cap>Preview</Cap>
          <View style={{ flexDirection: 'row', alignItems: 'center', gap: 14 }}>
            <Avatar name={name} color={p.color} badge={p.badge} />
            <View style={{ flexShrink: 1 }}>
              <Text style={{ fontFamily: FONT.display, fontSize: 30, color: c.ink }}>{name}</Text>
              <Cap>{p.alias}</Cap>
            </View>
          </View>
          <Cap>Agent name</Cap>
          <Field value={p.name} onChangeText={(t) => setProfile({ name: t })} maxLength={14} placeholder="Agent" autoCorrect={false} accessibilityLabel="Agent name" />
          <Cap>Alias</Cap>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {ALIASES.map((a) => (
              <Btn key={a} small variant={a === p.alias ? 'hl' : 'alt'} label={a} onPress={() => setProfile({ alias: a })} />
            ))}
          </View>
          <Cap>Colour</Cap>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {COLORS.map((col) => (
              <Pressable key={col} accessibilityRole="radio" accessibilityLabel={'Colour ' + col} accessibilityState={{ checked: p.color === col }} onPress={() => setProfile({ color: col })} style={[swatch(p.color === col), { backgroundColor: col }]} />
            ))}
          </View>
          <Cap>Badge</Cap>
          <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
            {BADGES.map((b) => (
              <Pressable key={b} accessibilityRole="radio" accessibilityLabel={'Badge ' + b} accessibilityState={{ checked: p.badge === b }} onPress={() => setProfile({ badge: b })} style={[swatch(p.badge === b), { backgroundColor: c.panel }]}>
                <Text style={{ fontSize: 18, color: c.ink }}>{b}</Text>
              </Pressable>
            ))}
          </View>
        </Panel>
        <Btn label={view ? 'Enter the hideout' : 'Create a room'} onPress={enter} />
        <Note text={err} />
      </View>
    </View>
  );
}
