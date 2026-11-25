// Lobby = "showdown table": room ticket, red half vs blue half around a round table, timer slider, begin bar.
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, Text, View, type GestureResponderEvent, type ViewStyle } from 'react-native';
import { Avatar, Body, Btn, Burst, Cap, H3, Note, Panel } from '../components/ui';
import { leaveRoom, request } from '../net';
import { TEAM, type Player, type Role, type RoomView, type Team } from '../protocol';
import { go, me, useApp } from '../store';
import { FONT, INK, useTheme } from '../theme';

/** Same checks the server does for NOT_READY, to explain a disabled Begin button. */
export function notReady(v: RoomView): string {
  for (const k of ['r', 'b'] as Team[]) {
    const mem = v.players.filter((p) => p.team === k);
    if (!mem.some((p) => p.role === 'spymaster')) return `${TEAM[k].n} needs a spymaster`;
    if (!mem.some((p) => p.role === 'agent')) return `${TEAM[k].n} needs an agent`;
  }
  return '';
}

const ARENA_H = 480;
const MAX_TIMER = 600;
const fmt = (s: number) => (s ? `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}` : 'OFF');

/** Seat spots inside one half (red uses top, blue mirrors to bottom). */
const AGENT_SPOTS: ViewStyle[] = [{ left: 12, top: 92 }, { right: 12, top: 92 }, { left: 12, top: 166 }, { right: 12, top: 166 }];

function Seat({ p, you, spy }: { p: Player; you: boolean; spy?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, width: 72 }}>
      <View style={you ? { borderWidth: 3, borderColor: '#ffd23c', padding: 1 } : undefined}>
        <Avatar small={!spy} name={p.name} color={p.color} badge={p.badge} />
      </View>
      {spy && <Text style={{ position: 'absolute', top: -10, right: 0, fontFamily: FONT.display, fontSize: 11, backgroundColor: INK, color: '#ffd23c', paddingHorizontal: 4 }}>SPY</Text>}
      <Text numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 15, color: you ? '#ffd23c' : '#fff', opacity: p.connected ? 1 : 0.6 }}>
        {you ? 'YOU' : p.name.toUpperCase()}{p.isHost ? ' ★' : ''}
      </Text>
    </View>
  );
}

function OpenSeat({ label, onPress, big }: { label: string; onPress?: () => void; big?: boolean }) {
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={!onPress} style={{ alignItems: 'center', gap: 2, width: 72, opacity: onPress ? 1 : 0.5 }}>
      <View style={{ width: big ? 56 : 44, height: big ? 56 : 44, borderWidth: 3, borderStyle: 'dashed', borderColor: big ? INK : '#fff9e0', backgroundColor: big ? '#ffd23c' : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: FONT.display, fontSize: big ? 13 : 24, lineHeight: big ? 14 : 26, color: big ? INK : '#fff9e0', textAlign: 'center' }}>{big ? 'TAKE\nSPY' : '+'}</Text>
      </View>
      <Text style={{ fontFamily: FONT.display, fontSize: 13, color: '#fff9e0' }}>{big ? 'SPYMASTER' : 'AGENT'}</Text>
    </Pressable>
  );
}

function Half({ v, k, onSeat }: { v: RoomView; k: Team; onSeat: (team: Team, role: Role) => void }) {
  const { c } = useTheme();
  const red = k === 'r';
  const lobby = v.phase === 'lobby';
  const you = me(v);
  const mine = you?.team === k;
  const mem = v.players.filter((p) => p.team === k);
  const spy = mem.find((p) => p.role === 'spymaster');
  const agents = mem.filter((p) => p.role === 'agent');
  const flip = (s: ViewStyle): ViewStyle => (red ? s : { ...s, top: undefined, bottom: s.top as number });
  const canJoinAgent = lobby && !(mine && you?.role === 'agent');
  const extra = agents.length - AGENT_SPOTS.length;
  return (
    <View style={{ flex: 1, backgroundColor: red ? c.red : c.blue }}>
      <Text style={{ position: 'absolute', [red ? 'top' : 'bottom']: 10, [red ? 'left' : 'right']: 12, fontFamily: FONT.display, fontSize: 28, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 3, height: 3 }, textShadowRadius: 0 } as never}>
        {red ? `${TEAM.r.g} RED · ${mem.length}` : `BLUE · ${mem.length} ${TEAM.b.g}`}
      </Text>
      {/* spymaster at the head of the table */}
      <View style={[{ position: 'absolute', left: 0, right: 0, alignItems: 'center' }, red ? { top: 14 } : { bottom: 14 }]}>
        {spy ? <Seat p={spy} you={spy.id === v.you} spy />
          : <OpenSeat big label={`Take the ${TEAM[k].n} spymaster seat`} onPress={lobby ? () => onSeat(k, 'spymaster') : undefined} />}
      </View>
      {AGENT_SPOTS.map((spot, i) => {
        const p = agents[i];
        const showJoin = !p && i === agents.length && canJoinAgent;
        if (!p && !showJoin) return null;
        return (
          <View key={i} style={[{ position: 'absolute' }, flip(spot)]}>
            {p ? <Seat p={p} you={p.id === v.you} /> : <OpenSeat label={`Join ${TEAM[k].n} as agent`} onPress={() => onSeat(k, 'agent')} />}
          </View>
        );
      })}
      {extra > 0 && <Text style={[{ position: 'absolute', fontFamily: FONT.display, fontSize: 15, color: '#fff' }, red ? { top: 236, left: 12 } : { bottom: 236, right: 12 }]}>+{extra} MORE</Text>}
    </View>
  );
}

/** 8-point comic burst with a label, built from two rotated squares. */
function VsBurst() {
  const sq = (rot: string) => ({ position: 'absolute' as const, width: 66, height: 66, backgroundColor: '#ffd23c', borderWidth: 4, borderColor: INK, transform: [{ rotate: rot }] });
  return (
    <View style={{ width: 96, height: 96, alignItems: 'center', justifyContent: 'center', transform: [{ rotate: '-8deg' }] }}>
      <View style={sq('0deg')} /><View style={sq('45deg')} />
      <View style={{ position: 'absolute', width: 60, height: 60, backgroundColor: '#ffd23c' }} />
      <Text style={{ fontFamily: FONT.display, fontSize: 32, color: INK }}>VS</Text>
    </View>
  );
}

function TimerSlider({ value, enabled, note, onChange }: { value: number; enabled: boolean; note: string; onChange: (s: number) => void }) {
  const { c } = useTheme();
  const [w, setW] = useState(1);
  const [drag, setDrag] = useState<number | null>(null);
  // Taps on − / + build on a local value and are sent once the player pauses, so quick taps are never lost
  // waiting for the server's answer.
  const [pend, setPend] = useState<number | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (pend !== null && pend === value) setPend(null); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (sendTimer.current) clearTimeout(sendTimer.current); }, []);
  const shown = drag ?? pend ?? value;
  const f = Math.min(1, shown / MAX_TIMER);
  const toSec = (e: GestureResponderEvent) => {
    const x = Math.max(0, Math.min(w, e.nativeEvent.locationX));
    const s = Math.round(((x / w) * MAX_TIMER) / 15) * 15;
    return s > 0 && s < 15 ? 15 : s;
  };
  const step = (d: number) => {
    let s = Math.max(0, Math.min(MAX_TIMER, (pend ?? value) + d));
    if (s > 0 && s < 15) s = d > 0 ? 15 : 0;
    setPend(s);
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => { if (s !== value) onChange(s); else setPend(null); }, 350);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Cap style={{ color: INK }}>Turn timer{note}</Cap>
        <Text style={{ fontFamily: FONT.display, fontSize: 24, color: INK }}>{fmt(shown)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Less time" disabled={!enabled} onPress={() => step(-15)} style={{ width: 36, height: 36, borderWidth: 3, borderColor: INK, backgroundColor: '#fff9e0', alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 22, color: INK }}>−</Text>
        </Pressable>
        <View onLayout={(e) => setW(e.nativeEvent.layout.width || 1)} style={{ flex: 1, height: 36, justifyContent: 'center' }}
          accessible accessibilityRole="adjustable" accessibilityLabel="Turn timer" accessibilityValue={{ text: fmt(value) }}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 15 : -15)}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          onStartShouldSetResponder={() => enabled} onMoveShouldSetResponder={() => enabled}
          onResponderGrant={(e) => setDrag(toSec(e))} onResponderMove={(e) => setDrag(toSec(e))}
          onResponderRelease={(e) => { const s = toSec(e); setDrag(null); if (s !== value) onChange(s); }}>
          <View pointerEvents="none" style={{ height: 14, borderWidth: 3, borderColor: INK, backgroundColor: '#fff9e0' }}>
            <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${f * 100}%`, backgroundColor: c.red }} />
          </View>
          <View pointerEvents="none" style={{ position: 'absolute', left: `${f * 100}%`, marginLeft: -13, width: 26, height: 26, borderRadius: 13, backgroundColor: '#ffd23c', borderWidth: 3, borderColor: INK, opacity: enabled ? 1 : 0.6 }} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="More time" disabled={!enabled} onPress={() => step(15)} style={{ width: 36, height: 36, borderWidth: 3, borderColor: INK, backgroundColor: '#fff9e0', alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 22, color: INK }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Lobby() {
  const { view: v } = useApp();
  const { c } = useTheme();
  const [msg, setMsg] = useState('');
  const [stopAsk, setStopAsk] = useState(false);
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
  const unseated = v.players.filter((p) => !p.team);

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
  const ticketBtn = (label: string, a11y: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress} style={{ backgroundColor: '#fff9e0', borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 2 }}>
      <Text style={{ fontFamily: FONT.display, fontSize: 16, color: INK }}>{label}</Text>
    </Pressable>
  );

  let beginLabel = 'BEGIN THE MISSION', beginOn = true;
  if (!lobby) beginLabel = 'BACK TO THE GAME';
  else if (why) { beginLabel = why.toUpperCase(); beginOn = false; }
  else if (!host) { beginLabel = 'WAITING FOR THE HOST'; beginOn = false; }

  return (
    <View style={{ gap: 16 }}>
      {/* room ticket */}
      <View style={{ transform: [{ rotate: '-1.5deg' }], marginRight: 6, marginBottom: 6 }}>
        <View style={{ position: 'absolute', left: 6, top: 6, right: -6, bottom: -6, backgroundColor: c.red }} />
        <View style={{ backgroundColor: '#ffd23c', borderWidth: 4, borderColor: INK, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONT.bold, fontSize: 11, letterSpacing: 2, color: INK }}>ADMIT YOUR FRIENDS · ROOM</Text>
            <Text selectable style={{ fontFamily: FONT.display, fontSize: 42, letterSpacing: 10, lineHeight: 46, color: INK }}>{v.code}</Text>
          </View>
          <View style={{ borderLeftWidth: 3, borderStyle: 'dashed', borderLeftColor: INK, paddingLeft: 10, gap: 6 }}>
            {ticketBtn(Platform.OS === 'web' ? 'INVITE' : 'SHARE', Platform.OS === 'web' ? 'Copy the invite link' : 'Share the room code', invite)}
            {ticketBtn('LEAVE', 'Leave the room', leaveRoom)}
          </View>
        </View>
      </View>

      {/* the showdown table */}
      <View style={{ height: ARENA_H, borderWidth: 4, borderColor: INK, overflow: 'hidden' }}>
        <Half v={v} k="r" onSeat={seat} />
        <Half v={v} k="b" onSeat={seat} />
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <View style={{ width: 170, height: 170, borderRadius: 85, borderWidth: 5, borderColor: INK, backgroundColor: '#2b2823', overflow: 'hidden' }}>
            <View style={{ flex: 1, backgroundColor: c.red, opacity: 0.35 }} />
            <View style={{ flex: 1, backgroundColor: c.blue, opacity: 0.35 }} />
          </View>
        </View>
        <View pointerEvents="none" style={{ position: 'absolute', left: 0, right: 0, top: 0, bottom: 0, alignItems: 'center', justifyContent: 'center' }}>
          <VsBurst />
        </View>
      </View>

      {lobby && you?.team && (
        <Btn small variant="alt" label={`Leave ${TEAM[you.team].n} team`} onPress={async () => flash(await request('seat:leave'))} />
      )}

      {unseated.length > 0 && (
        <Panel>
          <Cap>In the room, no team yet</Cap>
          <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 12 }}>
            {unseated.map((p) => (
              <View key={p.id} style={{ alignItems: 'center', gap: 2 }}>
                <Avatar small name={p.name} color={p.color} badge={p.badge} />
                <Text style={{ fontFamily: FONT.display, fontSize: 14, color: c.ink }}>{p.id === v.you ? 'YOU' : p.name.toUpperCase()}</Text>
              </View>
            ))}
          </View>
        </Panel>
      )}

      {/* bottom bar: timer + begin */}
      <View style={{ backgroundColor: '#f6e7a8', borderWidth: 4, borderColor: INK, padding: 12, gap: 10 }}>
        <TimerSlider value={v.settings.timer} enabled={lobby && host} note={!lobby ? ' · locked during the game' : host ? '' : ' · host only'} onChange={async (timer) => flash(await request('settings:update', { settings: { timer } }))} />
        <Pressable accessibilityRole="button" accessibilityState={{ disabled: !beginOn }} disabled={!beginOn}
          onPress={async () => { if (!lobby) go('board'); else flash(await request('game:start')); }}
          style={{ backgroundColor: beginOn ? c.red : '#d9c79a', borderWidth: 3, borderColor: INK, paddingVertical: 8, alignItems: 'center' }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 24, letterSpacing: 1, color: beginOn ? '#fff' : INK, textShadowColor: beginOn ? INK : 'transparent', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>{beginLabel}</Text>
        </Pressable>
      </View>
      {!lobby && host && (
        <Btn small variant="alt" label={stopAsk ? 'Tap again to stop the game for everyone' : 'Stop the game'}
          onPress={async () => { if (!stopAsk) { setStopAsk(true); setTimeout(() => setStopAsk(false), 4000); return; } setStopAsk(false); flash(await request('game:abort')); }} />
      )}
      <Note text={msg || (lobby && !you?.team ? 'Tap a + seat to join a team.' : '')} />
    </View>
  );
}
