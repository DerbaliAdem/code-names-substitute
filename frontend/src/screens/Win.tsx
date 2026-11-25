import React, { useState } from 'react';
import { Text, View } from 'react-native';
import { Btn, Burst, Cap, Note, Panel, Row, Tag } from '../components/ui';
import { request } from '../net';
import { TEAM } from '../protocol';
import { go, me, playerName, useApp } from '../store';
import { FONT, INK, useTheme } from '../theme';

export default function Win() {
  const { view: v } = useApp();
  const { c } = useTheme();
  const [msg, setMsg] = useState('');
  const o = v?.phase === 'over' ? v.over : null;

  if (!v || !o) {
    return (
      <View style={{ gap: 18 }}>
        <Burst title="NO WINNER YET" sub="Finish a game to see the report" />
        <Btn label="Back to the board" onPress={() => go('board')} />
      </View>
    );
  }

  const s = v.stats ?? { turns: v.turnNo, found: { r: 0, b: 0 }, topFinders: [], bestClue: null };
  const host = !!me(v)?.isHost;
  const stat = (n: number, label: string, color?: string) => (
    <View style={{ flex: 1, alignItems: 'center' }}>
      <Text style={{ fontFamily: FONT.display, fontSize: 40, color: color ?? c.ink }}>{n}</Text>
      <Cap>{label}</Cap>
    </View>
  );
  const nameText = (t: string, you: boolean) => <Text style={{ fontFamily: FONT.display, fontSize: 22, color: you ? INK : c.ink }}>{t}</Text>;

  return (
    <View style={{ gap: 16 }}>
      <Burst title={`${TEAM[o.winner].n.toUpperCase()} WINS!`} glow={o.winner === 'r' ? c.red : c.blue}
        sub={o.reason === 'assassin' ? `${playerName(o.by, v)} tapped the assassin` : 'Every word found'} />
      <Panel>
        <View style={{ flexDirection: 'row' }}>
          {stat(s.turns, 'Turns')}
          {stat(s.found.r, '▲ Red found', c.red)}
          {stat(s.found.b, '● Blue found', c.blue)}
        </View>
      </Panel>
      <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 16 }}>
        <View style={{ flexGrow: 1, flexBasis: 240 }}>
          <Panel>
            <Cap>Most words found</Cap>
            {s.topFinders.length ? s.topFinders.map((f, k) => (
              <Row key={f.playerId} you={k === 0} left={nameText(playerName(f.playerId, v), k === 0)} right={<Tag>{f.count} word{f.count === 1 ? '' : 's'}</Tag>} />
            )) : <Cap>Nobody found a word</Cap>}
          </Panel>
        </View>
        <View style={{ flexGrow: 1, flexBasis: 240 }}>
          <Panel>
            <Cap>Best clue</Cap>
            {s.bestClue && s.bestClue.hits ? (
              <Row you left={nameText(`${TEAM[s.bestClue.team].g} ${s.bestClue.word} · ${s.bestClue.number}`, true)}
                right={<Tag>{s.bestClue.hits} hit{s.bestClue.hits === 1 ? '' : 's'} · {playerName(s.bestClue.by, v)}</Tag>} />
            ) : <Cap>No clue scored</Cap>}
          </Panel>
        </View>
      </View>
      <Btn label={host ? 'Rematch, same room' : 'Waiting for the host to rematch'} disabled={!host}
        onPress={async () => { const r = await request('game:rematch'); setMsg(r.ok ? '' : r.error.message); }} />
      <Btn variant="alt" label="See the board" onPress={() => go('board')} />
      <Note text={msg} />
    </View>
  );
}
