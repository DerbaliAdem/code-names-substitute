// End-of-game report, shown at the top of the board when phase = 'over'.
import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { request } from '../net';
import { TEAM, type RoomView } from '../protocol';
import { me, playerName } from '../store';
import { FONT, INK, useTheme } from '../theme';
import { Btn, Burst, Cap, Note, Panel, Row, Tag } from './ui';

export default function VictoryReport({ v }: { v: RoomView }) {
  const { c } = useTheme();
  const [msg, setMsg] = useState('');
  const o = v.over!;
  const s = v.stats ?? { turns: v.turnNo, found: { r: 0, b: 0 }, topFinders: [], bestClue: null };
  const host = !!me(v)?.isHost;
  const stat = (n: number, label: string, color?: string) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: FONT.display, fontSize: 38, color: color ?? c.ink }}>{n}</Text>
      <Cap>{label}</Cap>
    </View>
  );
  const nameText = (t: string, you: boolean) => <Text style={{ fontFamily: FONT.display, fontSize: 20, color: you ? INK : c.ink }}>{t}</Text>;

  return (
    <View style={{ gap: 14 }}>
      <Burst title={`${TEAM[o.winner].n.toUpperCase()} WINS!`} glow={o.winner === 'r' ? c.red : c.blue}
        sub={o.reason === 'assassin' ? `${playerName(o.by, v)} tapped the assassin` : 'Every word found'} />
      <Panel>
        <View style={{ flexDirection: 'row' }}>
          {stat(s.turns, 'Turns')}
          {stat(s.found.r, '▲ Red found', c.red)}
          {stat(s.found.b, '● Blue found', c.blue)}
        </View>
        <Cap>Most words found</Cap>
        {s.topFinders.length ? s.topFinders.map((f, k) => (
          <Row key={f.playerId} you={k === 0} left={nameText(playerName(f.playerId, v), k === 0)} right={<Tag>{f.count} word{f.count === 1 ? '' : 's'}</Tag>} />
        )) : <Cap>Nobody found a word</Cap>}
        <Cap>Best clue</Cap>
        {s.bestClue && s.bestClue.hits ? (
          <Row you left={nameText(`${TEAM[s.bestClue.team].g} ${s.bestClue.word} · ${s.bestClue.number}`, true)}
            right={<Tag>{s.bestClue.hits} hit{s.bestClue.hits === 1 ? '' : 's'} · {playerName(s.bestClue.by, v)}</Tag>} />
        ) : <Cap>No clue scored</Cap>}
      </Panel>
      <Btn label={host ? 'Rematch, same room' : 'Waiting for the host to rematch'} disabled={!host}
        onPress={async () => { const r = await request('game:rematch'); setMsg(r.ok ? '' : r.error.message); }} />
      <Note text={msg} />
    </View>
  );
}
