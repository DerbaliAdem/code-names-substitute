import * as Clipboard from 'expo-clipboard';
import React, { useState } from 'react';
import { Platform, Share, Text, View } from 'react-native';
import { Avatar, Body, Btn, Burst, Cap, H3, Note, Panel, Row, Tag } from '../components/ui';
import { leaveRoom, request } from '../net';
import { TEAM, type Player, type Role, type RoomView, type Settings, type Team } from '../protocol';
import { go, me, useApp } from '../store';
import { FONT, INK, useTheme } from '../theme';

/** Same checks the server does for NOT_READY, to explain a disabled Start button. */
export function notReady(v: RoomView): string {
  for (const k of ['r', 'b'] as Team[]) {
    const mem = v.players.filter((p) => p.team === k);
    if (!mem.some((p) => p.role === 'spymaster')) return `${TEAM[k].n} needs a spymaster.`;
    if (!mem.some((p) => p.role === 'agent')) return `${TEAM[k].n} needs at least one agent.`;
  }
  return '';
}

export function PlayerRow({ p, you }: { p: Player; you: boolean }) {
  const { c } = useTheme();
  return (
    <Row you={you} left={<>
      <Avatar small name={p.name} color={p.color} badge={p.badge} />
      <Text style={{ fontFamily: FONT.bold, fontSize: 17, color: you ? INK : c.ink, opacity: p.connected ? 1 : 0.55, flexShrink: 1 }}>
        {p.name}{you ? ' (you)' : ''}{p.connected ? '' : ' · away'}
      </Text>
      {p.isHost ? <Text style={{ fontFamily: FONT.display, fontSize: 12, backgroundColor: '#ffd23c', color: INK, paddingHorizontal: 5, borderWidth: 2, borderColor: INK }}>HOST</Text> : null}
    </>} right={<Tag>{p.role ? p.role.toUpperCase() : 'WAITING'}</Tag>} />
  );
}

const TIMERS: Settings['timer'][] = [0, 45, 90, 150];

export default function Lobby() {
  const { view: v } = useApp();
  const { c } = useTheme();
  const [msg, setMsg] = useState('');
  const flash = (res: { ok: boolean; error?: { message: string } }) => setMsg(res.ok ? '' : res.error!.message);

  if (!v) {
    return (
      <View style={{ gap: 18 }}>
        <Burst title="THE HIDEOUT" sub="No room yet" />
        <Panel><H3>No room yet</H3><Body>Start a game or join with a code from Home.</Body><Btn label="Go home" onPress={() => go('home')} /></Panel>
      </View>
    );
  }

  const lobby = v.phase === 'lobby', you = me(v), host = !!you?.isHost, why = lobby ? notReady(v) : '';

  async function invite() {
    if (!v) return;
    if (Platform.OS === 'web') {
      const url = `${window.location.origin}${window.location.pathname}?room=${v.code}`;
      try { await Clipboard.setStringAsync(url); setMsg('Invite link copied.'); } catch { setMsg('Share this link: ' + url); }
    } else {
      Share.share({ message: `Join my Codenames room: ${v.code}` }).catch(() => {});
    }
  }

  const seat = async (team: Team, role: Role) => flash(await request('seat:take', { team, role }));

  return (
    <View style={{ gap: 16 }}>
      <Burst title="THE HIDEOUT" sub={lobby ? 'Waiting for agents' : 'Mission in progress'} />
      <Panel>
        <Cap>Room code · tell your friends</Cap>
        <View style={{ borderWidth: 3, borderStyle: 'dashed', borderColor: c.ink, padding: 4 }}>
          <Text selectable style={{ fontFamily: FONT.display, fontSize: 48, letterSpacing: 10, textAlign: 'center', color: c.ink }}>{v.code}</Text>
        </View>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          <Btn small variant="alt" label={Platform.OS === 'web' ? 'Copy invite link' : 'Share code'} onPress={invite} />
          <Btn small variant="alt" label="Leave room" onPress={leaveRoom} />
        </View>
      </Panel>
      <Note text={msg || (lobby ? why || (you?.team ? '' : 'Pick a team and a role first.') : '')} />

      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        {(['r', 'b'] as Team[]).map((k) => {
          const mem = v.players.filter((p) => p.team === k).sort((a, b) => (a.role === 'spymaster' ? 0 : 1) - (b.role === 'spymaster' ? 0 : 1));
          const taken = mem.some((p) => p.role === 'spymaster' && p.id !== v.you);
          return (
            <View key={k} style={{ flexGrow: 1, flexBasis: 240 }}>
              <Panel top={k === 'r' ? c.red : c.blue}>
                <H3>{TEAM[k].g} {TEAM[k].n} team</H3>
                {mem.length ? mem.map((p) => <PlayerRow key={p.id} p={p} you={p.id === v.you} />) : <Cap>Empty</Cap>}
                {lobby && (you?.team === k
                  ? <Btn variant="alt" label="Leave team" onPress={async () => flash(await request('seat:leave'))} />
                  : <>
                    <Btn variant={k} label={taken ? 'Spymaster seat taken' : 'Join as spymaster'} disabled={taken} onPress={() => seat(k, 'spymaster')} />
                    <Btn variant="alt" label="Join as agent" onPress={() => seat(k, 'agent')} />
                  </>)}
              </Panel>
            </View>
          );
        })}
      </View>

      {v.players.some((p) => !p.team) && (
        <Panel>
          <Cap>In the room, no team yet</Cap>
          {v.players.filter((p) => !p.team).map((p) => <PlayerRow key={p.id} p={p} you={p.id === v.you} />)}
        </Panel>
      )}

      <Panel>
        <Cap>Game settings{host ? '' : ' · host only'}</Cap>
        <Body style={{ fontFamily: FONT.bold }}>Turn timer</Body>
        <View style={{ flexDirection: 'row', gap: 8, flexWrap: 'wrap' }}>
          {TIMERS.map((t) => (
            <Btn key={t} small variant={v.settings.timer === t ? 'hl' : 'alt'} label={t ? `${t}s` : 'Off'} disabled={!lobby || !host}
              onPress={async () => flash(await request('settings:update', { settings: { timer: t } }))} />
          ))}
        </View>
      </Panel>

      {lobby
        ? <Btn label={host ? 'Begin the mission' : 'Waiting for the host to begin'} disabled={!host || !!why} onPress={async () => flash(await request('game:start'))} />
        : <Btn label="Back to the board" onPress={() => go('board')} />}
    </View>
  );
}
