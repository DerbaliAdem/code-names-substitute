// Lobby = "poster cards": a yellow room ticket, two stacked team cards with a VS badge between them,
// a mission-briefing checklist, language + timer controls and a big start button.
import * as Clipboard from 'expo-clipboard';
import React, { useEffect, useRef, useState } from 'react';
import { Platform, Pressable, Share, View, type GestureResponderEvent } from 'react-native';
import { Avatar, Body, Btn, Burst, Cap, H3, Note, Panel } from '../components/ui';
import { leaveRoom, request } from '../net';
import { TEAM, type Lang, type Player, type Role, type RoomView, type Team } from '../protocol';
import { go, me, useApp } from '../store';
import { FONT, useTheme } from '../theme';
import { Text } from '../components/Text';

const BG = '#161616', YELLOW = '#FFD23F', RED = '#FF5A47', BLUE = '#5B93F7', CREAM = '#F6EBC4', INK = '#111', WARN = '#b3261e';
const AGENT_SEATS = 3;
const MAX_TIMER = 120;

/** Same checks the server does for NOT_READY, to explain a disabled Begin button. */
export function notReady(v: RoomView): string {
  for (const k of ['r', 'b'] as Team[]) {
    const mem = v.players.filter((p) => p.team === k);
    if (!mem.some((p) => p.role === 'spymaster')) return `${TEAM[k].n} needs a spymaster`;
    if (!mem.some((p) => p.role === 'agent')) return `${TEAM[k].n} needs an agent`;
  }
  return '';
}

const fmt = (s: number) => (s ? `${s}s` : 'OFF');

/** A card with a hard offset-block shadow: a plain View behind it, no blur. */
function Offset({ shadow, children, style }: { shadow: string; children: React.ReactNode; style?: object }) {
  return (
    <View style={[{ position: 'relative' }, style]}>
      <View style={{ position: 'absolute', left: 6, top: 6, right: -6, bottom: -6, backgroundColor: shadow }} />
      <View style={{ borderWidth: 4, borderColor: INK }}>{children}</View>
    </View>
  );
}

function Seat({ p, you, spy }: { p: Player; you: boolean; spy?: boolean }) {
  return (
    <View style={{ alignItems: 'center', gap: 2, width: spy ? 72 : 56 }} accessibilityLabel={`${you ? 'You' : p.name}${spy ? ', spymaster' : ', agent'}`}>
      <View style={you ? { borderWidth: 3, borderColor: YELLOW, padding: 1 } : undefined}>
        <Avatar small={!spy} name={p.name} color={p.color} badge={p.badge} />
      </View>
      <Text numberOfLines={1} style={{ fontFamily: FONT.display, fontSize: 13, color: you ? YELLOW : '#fff', opacity: p.connected ? 1 : 0.6 }}>
        {you ? 'YOU' : p.name.toUpperCase()}{p.isHost ? ' ★' : ''}
      </Text>
    </View>
  );
}

function OpenSeat({ label, onPress, big }: { label: string; onPress?: () => void; big?: boolean }) {
  const size = big ? 72 : 56;
  return (
    <Pressable accessibilityRole="button" accessibilityLabel={label} onPress={onPress} disabled={!onPress} style={{ alignItems: 'center', gap: 2, width: size, opacity: onPress ? 1 : 0.4 }}>
      <View style={{ width: size, height: size, borderWidth: 3, borderStyle: 'dashed', borderColor: big ? INK : '#fff9e0', backgroundColor: big ? YELLOW : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
        <Text style={{ fontFamily: FONT.display, fontSize: big ? 13 : 26, lineHeight: big ? 14 : 28, color: big ? INK : '#fff9e0', textAlign: 'center' }}>{big ? 'TAKE\nSPY' : '+'}</Text>
      </View>
    </Pressable>
  );
}

/** One team's poster card: header, spymaster seat, agent seats, labels. */
function TeamCard({ v, k, onSeat }: { v: RoomView; k: Team; onSeat: (team: Team, role: Role) => void }) {
  const red = k === 'r';
  const lobby = v.phase === 'lobby';
  const you = me(v);
  const mine = you?.team === k;
  const mem = v.players.filter((p) => p.team === k);
  const spy = mem.find((p) => p.role === 'spymaster');
  const agents = mem.filter((p) => p.role === 'agent');
  const canJoinAgent = lobby && !(mine && you?.role === 'agent');
  const extra = agents.length - AGENT_SEATS;
  const bg = red ? RED : BLUE;
  return (
    <View style={{ backgroundColor: bg, borderWidth: 4, borderColor: INK, padding: 14, gap: 10 }}>
      <View>
        <Text style={{ fontFamily: FONT.display, fontSize: 24, letterSpacing: 1, color: '#fff', textShadowColor: INK, textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>
          {TEAM[k].n.toUpperCase()} · {mem.length}
        </Text>
        <Text style={{ fontFamily: FONT.bold, fontSize: 13, letterSpacing: 1, color: '#fff', opacity: 0.85 }}>{agents.length} / 1+ AGENTS</Text>
      </View>
      <View style={{ flexDirection: 'row', gap: 14, alignItems: 'flex-start' }}>
        <View style={{ alignItems: 'center', gap: 4 }}>
          {spy ? <Seat p={spy} you={spy.id === v.you} spy />
            : <OpenSeat big label={`Take the ${TEAM[k].n} spymaster seat`} onPress={lobby ? () => onSeat(k, 'spymaster') : undefined} />}
          <Text style={{ fontFamily: FONT.display, fontSize: 12, color: '#fff' }}>SPYMASTER</Text>
        </View>
        <View style={{ flex: 1, gap: 4 }}>
          <View style={{ flexDirection: 'row', gap: 10, flexWrap: 'wrap' }}>
            {Array.from({ length: AGENT_SEATS }, (_, i) => {
              const p = agents[i];
              return p ? <Seat key={i} p={p} you={p.id === v.you} /> : <OpenSeat key={i} label={`Join ${TEAM[k].n} as agent`} onPress={canJoinAgent ? () => onSeat(k, 'agent') : undefined} />;
            })}
          </View>
          <Text style={{ fontFamily: FONT.display, fontSize: 12, color: '#fff' }}>AGENTS{extra > 0 ? `  · +${extra} MORE` : ''}</Text>
        </View>
      </View>
    </View>
  );
}

/** Round yellow VS badge overlapping between the two team cards. */
function VsBadge() {
  return (
    <View style={{ alignItems: 'center', zIndex: 2 }}>
      <View style={{ width: 64, height: 64, borderRadius: 32, backgroundColor: YELLOW, borderWidth: 4, borderColor: INK, alignItems: 'center', justifyContent: 'center', marginTop: -32, marginBottom: -32 }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 22, color: INK }}>VS</Text>
      </View>
    </View>
  );
}

/** What's still missing before the mission can begin, ticking itself off as people sit down. */
function Briefing({ v }: { v: RoomView }) {
  const who = (team: Team, role: Role) => v.players.filter((p) => p.team === team && p.role === role).map((p) => p.name);
  const rows = (['r', 'b'] as const).flatMap((k) => {
    const spy = who(k, 'spymaster'), agents = who(k, 'agent'), n = TEAM[k].n;
    return [
      { ok: spy.length > 0, text: `${n} needs a spymaster` },
      { ok: agents.length > 0, text: `${n} needs 1+ agent` },
    ];
  });
  const done = rows.filter((r) => r.ok).length;
  return (
    <View style={{ backgroundColor: CREAM, borderWidth: 3, borderColor: INK, padding: 12, gap: 8 }}>
      <View style={{ flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' }}>
        <Text style={{ fontFamily: FONT.display, fontSize: 20, letterSpacing: 1, color: INK }}>MISSION BRIEFING</Text>
        <View style={{ backgroundColor: done === 4 ? YELLOW : INK, borderWidth: 2, borderColor: INK, paddingHorizontal: 8, paddingVertical: 2 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 14, color: done === 4 ? INK : YELLOW }}>{done} / 4</Text>
        </View>
      </View>
      <View accessibilityRole="list" style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8 }}>
        {rows.map((r) => (
          <View key={r.text} accessibilityLabel={(r.ok ? 'Done: ' : 'Missing: ') + r.text}
            style={{ flexBasis: '47%', flexDirection: 'row', alignItems: 'center', gap: 8 }}>
            <View style={{ width: 20, height: 20, borderWidth: 2, borderColor: INK, backgroundColor: r.ok ? YELLOW : 'transparent', alignItems: 'center', justifyContent: 'center' }}>
              {r.ok && <Text style={{ fontFamily: FONT.display, fontSize: 14, color: INK }}>✓</Text>}
            </View>
            <Text style={{ fontFamily: FONT.bold, fontSize: 14, color: r.ok ? INK : WARN, flexShrink: 1 }} numberOfLines={2}>{r.text}</Text>
          </View>
        ))}
      </View>
    </View>
  );
}

function LangSwitch({ value, enabled, onChange }: { value: Lang; enabled: boolean; onChange: (l: Lang) => void }) {
  const opt = (l: Lang, label: string) => {
    const on = value === l;
    return (
      <Pressable key={l} accessibilityRole="radio" accessibilityState={{ checked: on, disabled: !enabled }} accessibilityLabel={l === 'en' ? 'English words' : 'Arabic words'}
        disabled={!enabled || on} onPress={() => onChange(l)}
        style={{ flex: 1, alignItems: 'center', paddingVertical: 6, borderWidth: 3, borderColor: INK, backgroundColor: on ? INK : CREAM, opacity: enabled || on ? 1 : 0.5 }}>
        <Text style={{ fontFamily: l === 'ar' ? undefined : FONT.display, fontWeight: l === 'ar' ? '700' : undefined, fontSize: 18, color: on ? YELLOW : INK }}>{label}</Text>
      </Pressable>
    );
  };
  return (
    <View style={{ gap: 6 }}>
      <Cap style={{ color: INK }}>Words{enabled ? '' : ' · host only'}</Cap>
      <View accessibilityRole="radiogroup" style={{ flexDirection: 'row', gap: 8 }}>{opt('en', 'ENGLISH')}{opt('ar', 'العربية')}</View>
    </View>
  );
}

function TimerStepper({ value, enabled, note, onChange }: { value: number; enabled: boolean; note: string; onChange: (s: number) => void }) {
  const [pend, setPend] = useState<number | null>(null);
  const sendTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => { if (pend !== null && pend === value) setPend(null); }, [value]); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => () => { if (sendTimer.current) clearTimeout(sendTimer.current); }, []);
  const shown = pend ?? value;
  const f = Math.min(1, shown / MAX_TIMER);
  const step = (d: number) => {
    const s = Math.max(0, Math.min(MAX_TIMER, (pend ?? value) + d));
    setPend(s);
    if (sendTimer.current) clearTimeout(sendTimer.current);
    sendTimer.current = setTimeout(() => { if (s !== value) onChange(s); else setPend(null); }, 350);
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
        <Cap style={{ color: INK }}>Turn timer{note}</Cap>
        <Text style={{ fontFamily: FONT.display, fontSize: 22, color: INK }}>{fmt(shown)}</Text>
      </View>
      <View style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
        <Pressable accessibilityRole="button" accessibilityLabel="Less time" disabled={!enabled} onPress={() => step(-15)} style={{ width: 36, height: 36, borderWidth: 3, borderColor: INK, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 22, color: INK }}>−</Text>
        </Pressable>
        <View accessible accessibilityRole="adjustable" accessibilityLabel="Turn timer" accessibilityValue={{ text: fmt(value) }}
          onAccessibilityAction={(e) => step(e.nativeEvent.actionName === 'increment' ? 15 : -15)}
          accessibilityActions={[{ name: 'increment' }, { name: 'decrement' }]}
          style={{ flex: 1, height: 14, borderWidth: 3, borderColor: INK, backgroundColor: CREAM, justifyContent: 'center' }}>
          <View style={{ position: 'absolute', left: 0, top: 0, bottom: 0, width: `${f * 100}%`, backgroundColor: RED }} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel="More time" disabled={!enabled} onPress={() => step(15)} style={{ width: 36, height: 36, borderWidth: 3, borderColor: INK, backgroundColor: CREAM, alignItems: 'center', justifyContent: 'center', opacity: enabled ? 1 : 0.4 }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 22, color: INK }}>+</Text>
        </Pressable>
      </View>
    </View>
  );
}

export default function Lobby() {
  const { view: v } = useApp();
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
      Share.share({ message: `Join my room: ${v.code}` }).catch(() => {});
    }
  }
  const seat = async (team: Team, role: Role) => flash(await request('seat:take', { team, role }));

  let beginLabel = 'START GAME', beginOn = true;
  if (!lobby) beginLabel = 'BACK TO THE GAME';
  else if (why) { beginLabel = why.toUpperCase(); beginOn = false; }
  else if (!host) { beginLabel = 'WAITING FOR THE HOST'; beginOn = false; }

  const ticketBtn = (label: string, a11y: string, onPress: () => void) => (
    <Pressable accessibilityRole="button" accessibilityLabel={a11y} onPress={onPress}
      style={{ width: 84, height: 44, backgroundColor: '#fff', borderWidth: 3, borderColor: INK, alignItems: 'center', justifyContent: 'center' }}>
      <Text style={{ fontFamily: FONT.display, fontSize: 15, color: INK }}>{label}</Text>
    </Pressable>
  );

  return (
    <View style={{ gap: 16, backgroundColor: BG, padding: 12, borderRadius: 4 }}>
      {/* room ticket */}
      <Offset shadow={RED} style={{ transform: [{ rotate: '-1deg' }], marginRight: 6, marginBottom: 6 }}>
        <View style={{ backgroundColor: YELLOW, paddingVertical: 8, paddingHorizontal: 12, flexDirection: 'row', alignItems: 'center', gap: 12 }}>
          <View style={{ flex: 1 }}>
            <Text style={{ fontFamily: FONT.bold, fontSize: 11, letterSpacing: 2, color: INK }}>ADMIT YOUR FRIENDS · ROOM</Text>
            <Text selectable style={{ fontFamily: FONT.display, fontSize: 44, letterSpacing: 8, lineHeight: 48, color: INK }}>{v.code}</Text>
          </View>
          <View style={{ gap: 6 }}>
            {ticketBtn(Platform.OS === 'web' ? 'INVITE' : 'SHARE', Platform.OS === 'web' ? 'Copy the invite link' : 'Share the room code', invite)}
            {ticketBtn('LEAVE', 'Leave the room', leaveRoom)}
          </View>
        </View>
      </Offset>

      {/* team cards with VS badge between them */}
      <View>
        <TeamCard v={v} k="r" onSeat={seat} />
        <VsBadge />
        <TeamCard v={v} k="b" onSeat={seat} />
      </View>

      {lobby && you?.team && (
        <Btn small variant="alt" label={`Leave ${TEAM[you.team].n} team`} onPress={async () => flash(await request('seat:leave'))} />
      )}

      {unseated.length > 0 && (
        <View style={{ backgroundColor: CREAM, borderWidth: 3, borderColor: INK, padding: 10, gap: 8 }}>
          {unseated.map((p) => (
            <View key={p.id} style={{ flexDirection: 'row', alignItems: 'center', gap: 10 }}>
              <Avatar small name={p.name} color={p.color} badge={p.badge} />
              <Text style={{ fontFamily: FONT.bold, fontSize: 14, letterSpacing: 0.5, color: INK, flex: 1 }}>
                {p.id === v.you ? 'YOU' : p.name.toUpperCase()}, IN THE ROOM, NO TEAM YET
              </Text>
            </View>
          ))}
        </View>
      )}

      {/* bottom bar: briefing, language, timer, begin */}
      <View style={{ gap: 12 }}>
        {lobby && <Briefing v={v} />}
        <View style={{ backgroundColor: CREAM, borderWidth: 3, borderColor: INK, padding: 12, gap: 12 }}>
          <LangSwitch value={v.settings.lang ?? 'en'} enabled={lobby && host} onChange={async (lang) => flash(await request('settings:update', { settings: { lang } }))} />
          <TimerStepper value={v.settings.timer} enabled={lobby && host} note={!lobby ? ' · locked during the game' : host ? '' : ' · host only'} onChange={async (timer) => flash(await request('settings:update', { settings: { timer } }))} />
        </View>
        <Pressable accessibilityRole="button" accessibilityLabel={beginLabel} accessibilityState={{ disabled: !beginOn }} disabled={!beginOn}
          onPress={async () => { if (!lobby) go('board'); else flash(await request('game:start')); }}
          style={{ backgroundColor: beginOn ? RED : '#4a4a4a', borderWidth: 3, borderColor: INK, paddingVertical: 10, alignItems: 'center' }}>
          <Text style={{ fontFamily: FONT.display, fontSize: 24, letterSpacing: 1, color: beginOn ? '#fff' : '#bbb', textShadowColor: beginOn ? INK : 'transparent', textShadowOffset: { width: 2, height: 2 }, textShadowRadius: 0 }}>{beginLabel}</Text>
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
